#!/usr/bin/env node
/**
 * Walk every provider row in Baserow and verify that its URL still resolves.
 *
 * Updates these fields:
 *   - Stale URL
 *   - Last Link Check Status
 *   - Last Link Checked At
 */
const fs = require("fs");
const dotenv = require("dotenv");
dotenv.config();

const { buildClient } = require("./lib/baserow");
const { LINK_CHECK_FIELDS } = require("./lib/baserow-schema");

const DRY_RUN = process.argv.includes("--dry-run");
const REPORT_ARG = process.argv.find((arg) => arg.startsWith("--report="));
const REPORT_PATH = REPORT_ARG ? REPORT_ARG.split("=")[1] : null;
const TIMEOUT_MS = Number(process.env.LINK_CHECK_TIMEOUT_MS || 15000);
const CONCURRENCY = Number(process.env.LINK_CHECK_CONCURRENCY || 8);
const ALIVE_STATUSES = new Set([200, 201, 202, 203, 204, 301, 302, 307, 308, 401, 403]);

function getEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) throw new Error(`Missing required env var ${name}`);
  return value;
}

async function fetchOnce(url, method) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      redirect: "follow",
      headers: {
        "user-agent":
          "awesome-aussie-link-checker/1.0 (+https://github.com/AdamXweb/awesome-aussie)",
        accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      },
      signal: controller.signal,
    });
    return { ok: ALIVE_STATUSES.has(res.status), status: res.status };
  } catch (err) {
    return { ok: false, status: 0, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

async function checkUrl(url) {
  if (!url) return { ok: false, status: 0, error: "no URL set" };
  let result = await fetchOnce(url, "HEAD");
  if (!result.ok && (result.status === 405 || result.status === 0 || result.status === 404)) {
    result = await fetchOnce(url, "GET");
  }
  return result;
}

async function pool(items, fn, concurrency) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      out[index] = await fn(items[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker)
  );
  return out;
}

function statusText(result) {
  if (result.ok) return String(result.status);
  return String(result.status || result.error || "error");
}

async function main() {
  const tableId = getEnv("BASEROW_PROVIDERS_TABLE_ID");
  const baserow = buildClient();
  const fields = await baserow.listFields(tableId);
  const fieldNames = new Set(fields.map((field) => field.name));
  const missingLinkFields = LINK_CHECK_FIELDS.filter(
    (fieldName) => !fieldNames.has(fieldName)
  );
  const canWriteLinkFields = missingLinkFields.length === 0;

  if (!canWriteLinkFields) {
    console.warn("Link-check fields are missing in Baserow:");
    for (const fieldName of missingLinkFields) console.warn(`  - ${fieldName}`);
    console.warn("Running in report-only mode.");
  }

  const providers = await baserow.listRows(tableId);

  console.log(
    `Checking ${providers.length} provider URLs with concurrency ${CONCURRENCY}...`
  );

  const checkedAt = new Date().toISOString();
  const results = await pool(
    providers,
    async (row) => {
      const result = await checkUrl(row.URL);
      return { row, url: row.URL, ...result };
    },
    CONCURRENCY
  );

  const stale = results.filter((result) => !result.ok);
  const alive = results.filter((result) => result.ok);
  console.log(`Alive: ${alive.length}, Stale/no-url: ${stale.length}`);

  let changed = 0;
  for (const result of results) {
    const payload = {
      "Stale URL": !result.ok,
      "Last Link Check Status": statusText(result),
      "Last Link Checked At": checkedAt,
    };
    const alreadySame =
      Boolean(result.row["Stale URL"]) === payload["Stale URL"] &&
      String(result.row["Last Link Check Status"] || "") ===
        payload["Last Link Check Status"];

    if (!alreadySame) {
      const marker = result.ok ? "FIXED" : "STALE";
      console.log(
        `${marker} ${result.row.Provider || "(untitled)"} <- ${
          result.url || "(no url)"
        } (${payload["Last Link Check Status"]})`
      );
      changed += 1;
    }

    if (!DRY_RUN && canWriteLinkFields) {
      try {
        await baserow.updateRow(tableId, result.row.id, payload);
      } catch (err) {
        console.warn(
          `Could not update link-check fields for ${
            result.row.Provider || result.row.id
          }: ${err.message}`
        );
      }
    }
  }

  console.log(`Rows changed: ${changed}.`);

  if (REPORT_PATH) {
    const summary = {
      checkedAt,
      total: results.length,
      alive: alive.length,
      stale: stale.length,
      changed,
      staleProviders: stale.map((result) => ({
        id: result.row.id,
        name: result.row.Provider,
        url: result.url,
        status: result.status,
        error: result.error,
      })),
    };
    fs.writeFileSync(REPORT_PATH, JSON.stringify(summary, null, 2));
    console.log(`Wrote report to ${REPORT_PATH}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
