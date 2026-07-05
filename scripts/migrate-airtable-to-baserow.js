#!/usr/bin/env node
/**
 * One-time migration: Airtable -> Baserow.
 *
 * Reads:
 *   - Airtable table 'Awesome Aussies'
 *   - Airtable view 'Extended List'
 *   - Airtable table 'README'
 *
 * Writes:
 *   - Baserow Providers table
 *   - Baserow Readme Blocks table (optional)
 *
 * Idempotency:
 *   - Providers are matched by "Airtable Record ID".
 *   - Readme blocks are matched by "Name".
 *
 * Usage:
 *   AIRTABLE_API_KEY=... AIRTABLE_BASE_ID=... BASEROW_API_TOKEN=... \
 *   BASEROW_PROVIDERS_TABLE_ID=... BASEROW_README_BLOCKS_TABLE_ID=... \
 *   node scripts/migrate-airtable-to-baserow.js --dry-run
 */
const dotenv = require("dotenv");
dotenv.config();

const Airtable = require("airtable");
const { buildClient } = require("./lib/baserow");
const { BOILERPLATE_MAP } = require("./lib/baserow-schema");

const DRY_RUN = process.argv.includes("--dry-run");

function getEnv(name, { required = true } = {}) {
  const v = process.env[name];
  if (required && (!v || !v.trim())) {
    throw new Error(`Missing required env var ${name}`);
  }
  return v;
}

function normalizeCell(value) {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === "object") {
          return item.name || item.value || item.id || JSON.stringify(item);
        }
        return String(item);
      })
      .join(", ");
  }
  if (typeof value === "object") {
    return value.name || value.value || JSON.stringify(value);
  }
  return String(value);
}

async function fetchAll(table, opts = {}) {
  const out = [];
  await new Promise((resolve, reject) => {
    table
      .select({ view: opts.view, filterByFormula: opts.filterByFormula })
      .eachPage(
        (records, next) => {
          out.push(...records);
          next();
        },
        (err) => (err ? reject(err) : resolve())
      );
  });
  return out;
}

async function indexRowsByField(baserow, tableId, fieldName) {
  const rows = await baserow.listRows(tableId);
  const byField = new Map();
  for (const row of rows) {
    const value = row[fieldName];
    if (value !== undefined && value !== null && String(value).trim()) {
      byField.set(String(value), row);
    }
  }
  return byField;
}

async function upsertRow(baserow, tableId, existing, payload, label) {
  if (DRY_RUN) {
    console.log(`[dry-run] ${existing ? "update" : "create"} ${label}`);
    return existing || payload;
  }
  if (existing) {
    return baserow.updateRow(tableId, existing.id, payload);
  }
  return baserow.createRow(tableId, payload);
}

async function migrateReadmeBlocks(base, baserow) {
  const tableId = process.env.BASEROW_README_BLOCKS_TABLE_ID;
  if (!tableId) {
    console.log("Skipping README blocks (BASEROW_README_BLOCKS_TABLE_ID not set).");
    return;
  }

  const existingByName = DRY_RUN
    ? new Map()
    : await indexRowsByField(baserow, tableId, "Name");
  const records = await fetchAll(base("README"), { view: "Grid view" });

  let created = 0;
  let updated = 0;
  for (const record of records) {
    const name = normalizeCell(record.get("Name"));
    const slug = BOILERPLATE_MAP[name];
    if (!slug) continue;

    const existing = existingByName.get(name);
    const payload = {
      Name: name,
      Slug: slug,
      Body: normalizeCell(record.get("Notes")),
    };
    await upsertRow(baserow, tableId, existing, payload, `README block '${name}'`);
    if (existing) updated += 1;
    else created += 1;
  }

  console.log(`README blocks: created ${created}, updated ${updated}.`);
}

async function migrateProviders(base, baserow) {
  const tableId = getEnv("BASEROW_PROVIDERS_TABLE_ID");
  const existingByAirtableId = DRY_RUN
    ? new Map()
    : await indexRowsByField(baserow, tableId, "Airtable Record ID");

  const extendedRecords = await fetchAll(base("Awesome Aussies"), {
    view: "Extended List",
  });
  const extendedIds = new Set(extendedRecords.map((record) => record.id));

  const allRecords = await fetchAll(base("Awesome Aussies"), {
    view: "Awesome Aussie",
  });
  const seen = new Set(allRecords.map((record) => record.id));
  for (const record of extendedRecords) {
    if (!seen.has(record.id)) allRecords.push(record);
  }

  console.log(
    `Migrating ${allRecords.length} provider rows (${extendedIds.size} extended)...`
  );

  let created = 0;
  let updated = 0;
  for (const record of allRecords) {
    const provider = normalizeCell(record.get("Provider")) || "(untitled)";
    const existing = existingByAirtableId.get(record.id);
    const payload = {
      Name: provider,
      URL: normalizeCell(record.get("URL")),
      Description: normalizeCell(record.get("Description")),
      HQ: normalizeCell(record.get("HQ")),
      "Alternative to": normalizeCell(record.get("Alternative to")),
      Category: normalizeCell(record.get("Categories")),
      "In Extended List": extendedIds.has(record.id),
      "Reason in Extended List": normalizeCell(
        record.get("Reason in Extended List")
      ),
      Status: "Published",
      "Airtable Record ID": record.id,
      "Stale URL": false,
      "Last Link Check Status": "",
      "Last Link Checked At": "",
    };

    await upsertRow(baserow, tableId, existing, payload, `provider '${provider}'`);
    if (existing) updated += 1;
    else created += 1;
    if (!DRY_RUN && (created + updated) % 25 === 0) {
      console.log(`  ${created + updated} processed...`);
    }
  }

  console.log(`Providers: created ${created}, updated ${updated}.`);
}

async function main() {
  const base = new Airtable({ apiKey: getEnv("AIRTABLE_API_KEY") }).base(
    getEnv("AIRTABLE_BASE_ID")
  );
  const baserow = buildClient();

  await migrateReadmeBlocks(base, baserow);
  await migrateProviders(base, baserow);

  console.log(
    DRY_RUN ? "Dry run complete - no changes written." : "Migration complete."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
