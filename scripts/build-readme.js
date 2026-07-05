#!/usr/bin/env node
/**
 * Build README.md (and EXTENDED.md when --extended) from Baserow.
 *
 * Source of truth in Baserow:
 *   - Providers table: one row per provider
 *   - Readme Blocks table: optional boilerplate prose
 *
 * Usage:
 *   node scripts/build-readme.js
 *   node scripts/build-readme.js --extended
 *
 * Required env:
 *   BASEROW_API_TOKEN
 *   BASEROW_PROVIDERS_TABLE_ID
 *
 * Optional env:
 *   BASEROW_API_BASE_URL
 *   BASEROW_CATEGORIES_TABLE_ID
 *   BASEROW_README_BLOCKS_TABLE_ID
 *   README_STATUSES="Active - Awesome List"
 *   EXTENDED_STATUSES="Active - Extended List"
 */
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config();

const { buildClient } = require("./lib/baserow");
const {
  BOILERPLATE_MAP,
  DEFAULT_EXTENDED_STATUSES,
  DEFAULT_README_STATUSES,
} = require("./lib/baserow-schema");

function readLocalBoilerplate(slug) {
  const file = path.join(__dirname, "..", "boilerplate", `${slug}.md`);
  if (!fs.existsSync(file)) return "";
  return fs.readFileSync(file, "utf8");
}

function markdownBlock(text) {
  const body = String(text || "").trimEnd();
  return body ? `${body}\n\n` : "";
}

function escapeCell(s) {
  return String(s ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|");
}

function anchor(category) {
  return String(category).replace(/\s+/g, "-");
}

function asBool(value) {
  if (typeof value === "boolean") return value;
  return /^(true|yes|1)$/i.test(String(value || ""));
}

function cellValue(value) {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) {
    return value.map(cellValue).filter(Boolean).join(", ");
  }
  if (typeof value === "object") {
    return value.value || value.name || "";
  }
  return String(value);
}

function statusIsPublishable(row, publishable) {
  const status = cellValue(row.Status).trim();
  return publishable.includes(status.toLowerCase());
}

function categoryFor(row) {
  return cellValue(row.Categories) || "Uncategorised";
}

function categoriesFor(row) {
  const categories = Array.isArray(row.Categories)
    ? row.Categories.map(cellValue).filter(Boolean)
    : [cellValue(row.Categories)].filter(Boolean);
  return categories.length ? categories : ["Uncategorised"];
}

async function loadReadmeBlocks(baserow) {
  const tableId = process.env.BASEROW_README_BLOCKS_TABLE_ID;
  const bySlug = new Map();

  if (tableId) {
    const rows = await baserow.listRows(tableId);
    for (const row of rows) {
      const slug = BOILERPLATE_MAP[row.Name];
      if (slug) bySlug.set(slug, String(row.Notes || ""));
    }
  }

  for (const slug of Object.values(BOILERPLATE_MAP)) {
    if (!bySlug.has(slug)) bySlug.set(slug, readLocalBoilerplate(slug));
  }

  return bySlug;
}

async function loadCategoryOrder(baserow) {
  const tableId = process.env.BASEROW_CATEGORIES_TABLE_ID;
  if (!tableId) return [];
  const rows = await baserow.listRows(tableId);
  return rows.map((row) => cellValue(row.Category)).filter(Boolean);
}

async function main() {
  const extended = process.argv.includes("--extended");
  const filename = extended ? "EXTENDED.md" : "README.md";

  const baserow = buildClient();
  const providersTableId = process.env.BASEROW_PROVIDERS_TABLE_ID;
  if (!providersTableId) {
    throw new Error("Missing BASEROW_PROVIDERS_TABLE_ID env var");
  }

  const publishable = (
    extended
      ? process.env.EXTENDED_STATUSES
        ? process.env.EXTENDED_STATUSES.split(",")
        : DEFAULT_EXTENDED_STATUSES
      : process.env.README_STATUSES
        ? process.env.README_STATUSES.split(",")
        : DEFAULT_README_STATUSES
  )
    .map((status) => status.trim().toLowerCase())
    .filter(Boolean);

  const allRows = await baserow.listRows(providersTableId);
  const rows = allRows
    .filter((row) => statusIsPublishable(row, publishable))
    .filter((row) => (extended ? true : !asBool(row["In Extended List"])));

  console.log(
    `Fetched ${allRows.length} providers from Baserow; ${rows.length} are rendered ` +
      `(statuses: ${publishable.join(", ")}).`
  );

  const blocks = await loadReadmeBlocks(baserow);
  const categoryOrder = await loadCategoryOrder(baserow);

  rows.sort(
    (a, b) =>
      String(categoryFor(a)).localeCompare(String(categoryFor(b))) ||
      cellValue(a.Provider).localeCompare(cellValue(b.Provider))
  );

  const rowCategories = Array.from(
    new Set(rows.flatMap((row) => categoriesFor(row)))
  );
  const categories = [
    ...categoryOrder.filter((category) => rowCategories.includes(category)),
    ...rowCategories
      .filter((category) => !categoryOrder.includes(category))
      .sort((a, b) => String(a).localeCompare(String(b))),
  ];

  let out = "";
  out += markdownBlock(
    blocks.get(extended ? "github-about-extended" : "github-about")
  );

  out += `### Categories\n`;
  for (const category of categories) {
    out += `- [${category}](#${anchor(category)})\n`;
  }
  out += `<hr>\n\n`;

  for (const category of categories) {
    out += `## ${category}\n`;
    if (extended) {
      out += `| Provider | Description | HQ | Alternative to | Reason in Extended List |\n`;
      out += `| --- | --- | --- | --- | --- |\n`;
    } else {
      out += `| Provider | Description | HQ | Alternative to |\n`;
      out += `| --- | --- | --- | --- |\n`;
    }

    for (const row of rows.filter((item) =>
      categoriesFor(item).includes(category)
    )) {
      const providerName = cellValue(row.Provider);
      const provider = row.URL ? `[${providerName}](${row.URL})` : providerName;
      if (extended) {
        out += `| ${provider} | ${escapeCell(
          cellValue(row.Description)
        )} | ${escapeCell(cellValue(row.HQ))} | ${escapeCell(
          cellValue(row["Alternative to"])
        )} | ${escapeCell(cellValue(row["Reason in Extended List"]))} |\n`;
      } else {
        out += `| ${provider} | ${escapeCell(
          cellValue(row.Description)
        )} | ${escapeCell(cellValue(row.HQ))} | ${escapeCell(
          cellValue(row["Alternative to"])
        )} |\n`;
      }
    }
  }

  for (const name of ["LICENSE", "Contributing", "Thank You"]) {
    const slug = BOILERPLATE_MAP[name];
    const body = blocks.get(slug);
    if (!body || !body.trim()) continue;
    out += `### ${name}\n${markdownBlock(body)}`;
  }

  fs.writeFileSync(filename, out);
  console.log(`Wrote ${filename} (${out.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
