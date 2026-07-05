#!/usr/bin/env node
/**
 * Verify that the Baserow tables have the fields expected by this repo.
 *
 * This does not create or change anything. It is safe to run with a read-only
 * database token, and should be the first command after creating the Baserow
 * base/tables by hand.
 */
const dotenv = require("dotenv");
dotenv.config();

const { buildClient } = require("./lib/baserow");
const {
  PROVIDER_FIELDS,
  LINK_CHECK_FIELDS,
  README_BLOCK_FIELDS,
  CATEGORY_FIELDS,
  GITHUB_ISSUE_FIELDS,
} = require("./lib/baserow-schema");

const TABLES = [
  {
    env: "BASEROW_PROVIDERS_TABLE_ID",
    label: "Providers",
    required: PROVIDER_FIELDS,
    recommended: LINK_CHECK_FIELDS,
    optional: false,
  },
  {
    env: "BASEROW_CATEGORIES_TABLE_ID",
    label: "Categories",
    required: CATEGORY_FIELDS,
    optional: true,
  },
  {
    env: "BASEROW_README_BLOCKS_TABLE_ID",
    label: "Readme Blocks",
    required: README_BLOCK_FIELDS,
    optional: true,
  },
  {
    env: "BASEROW_GITHUB_ISSUES_TABLE_ID",
    label: "GitHub Issues",
    required: GITHUB_ISSUE_FIELDS,
    optional: true,
  },
];

async function checkTable(baserow, table) {
  const tableId = process.env[table.env];
  if (!tableId) {
    if (table.optional) {
      console.log(`Skipping optional ${table.label} table (${table.env} not set).`);
      return true;
    }
    console.error(`Missing ${table.env} for ${table.label}.`);
    return false;
  }

  const fields = await baserow.listFields(tableId);
  const existing = new Set(fields.map((field) => field.name));
  const missing = table.required.filter((name) => !existing.has(name));
  const missingRecommended = (table.recommended || []).filter(
    (name) => !existing.has(name)
  );

  if (missing.length === 0) {
    console.log(`OK ${table.label}: all ${table.required.length} fields found.`);
    if (missingRecommended.length) {
      console.warn(`Recommended fields missing in ${table.label}:`);
      for (const name of missingRecommended) console.warn(`  - ${name}`);
      console.warn(
        "  Link checking will run in report-only mode until these fields exist."
      );
    }
    return true;
  }

  console.error(`Missing fields in ${table.label}:`);
  for (const name of missing) console.error(`  - ${name}`);
  return false;
}

async function main() {
  const baserow = buildClient();
  const results = [];
  for (const table of TABLES) {
    results.push(await checkTable(baserow, table));
  }
  if (results.every(Boolean)) {
    console.log("Baserow schema check passed.");
  } else {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
