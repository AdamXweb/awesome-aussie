#!/usr/bin/env node
/**
 * Mirror recent GitHub issues labelled "Addition" into Baserow.
 *
 * This gives curators a Baserow inbox of community submissions without making
 * the GitHub Issues table responsible for publishing. Promotion still happens
 * by creating/updating a row in the Providers table.
 */
const dotenv = require("dotenv");
dotenv.config();

const { Octokit } = require("@octokit/core");
const { paginateRest } = require("@octokit/plugin-paginate-rest");
const { buildClient } = require("./lib/baserow");

const OWNER = process.env.GH_OWNER || "AdamXweb";
const REPO = process.env.GH_REPO || "awesome-aussie";
const LOOKBACK_DAYS = Number(process.env.GH_LOOKBACK_DAYS || 14);
const DRY_RUN = process.argv.includes("--dry-run");

function getEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) throw new Error(`Missing required env var ${name}`);
  return value;
}

function labelNames(issue) {
  return issue.labels.map((label) => label.name);
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : "";
}

function indexSelectOptions(fields, fieldName) {
  const field = fields.find((item) => item.name === fieldName);
  const options = new Map();
  for (const option of field?.select_options || []) {
    options.set(String(option.value).toLowerCase(), option.id);
  }
  return options;
}

function optionId(options, value) {
  if (!value) return null;
  return options.get(String(value).toLowerCase()) || null;
}

async function indexExistingIssues(baserow, tableId) {
  const rows = await baserow.listRows(tableId);
  const byNumber = new Map();
  for (const row of rows) {
    if (row.Number) {
      byNumber.set(String(row.Number), row);
    }
  }
  return byNumber;
}

async function main() {
  const tableId = getEnv("BASEROW_GITHUB_ISSUES_TABLE_ID");
  const baserow = buildClient();
  const octokit = new (Octokit.plugin(paginateRest))({
    auth: getEnv("GH_API_TOKEN"),
  });

  const since = new Date();
  since.setDate(since.getDate() - LOOKBACK_DAYS);

  const ghIssues = [];
  for await (const response of octokit.paginate.iterator(
    "GET /repos/{owner}/{repo}/issues",
    {
      owner: OWNER,
      repo: REPO,
      since: since.toISOString(),
      labels: "Addition",
      per_page: 100,
      state: "all",
    }
  )) {
    for (const issue of response.data) {
      if (issue.pull_request) continue;
      ghIssues.push(issue);
    }
  }

  console.log(`Fetched ${ghIssues.length} GitHub issues to sync.`);

  const fields = await baserow.listFields(tableId);
  const labelOptions = indexSelectOptions(fields, "Labels");
  const milestoneOptions = indexSelectOptions(fields, "Milestone");
  const stateOptions = indexSelectOptions(fields, "State");
  const priorityOptions = indexSelectOptions(fields, "Priority");

  const existingByNumber = DRY_RUN
    ? new Map()
    : await indexExistingIssues(baserow, tableId);

  let created = 0;
  let updated = 0;
  for (const issue of ghIssues) {
    const labels = labelNames(issue);
    const labelIds = labels
      .map((label) => optionId(labelOptions, label))
      .filter(Boolean);
    const skippedLabels = labels.filter(
      (label) => !optionId(labelOptions, label)
    );
    if (skippedLabels.length) {
      console.warn(
        `Skipping labels not present in Baserow options for #${issue.number}: ${skippedLabels.join(", ")}`
      );
    }

    const milestone = optionId(milestoneOptions, issue.milestone?.title);
    const state = optionId(stateOptions, issue.state);

    const payload = {
      Number: issue.number,
      Title: issue.title || "",
      Labels: labelIds,
      Milestone: milestone,
      Link: issue.html_url || "",
      Body: issue.body || "",
      CreatedAt: dateOnly(issue.created_at),
      UpdatedAt: dateOnly(issue.updated_at),
      State: state,
      Priority: optionId(priorityOptions, issue.labels.find((label) => /^P[0-4]$/i.test(label.name))?.name),
    };

    const existing = existingByNumber.get(String(issue.number));
    if (DRY_RUN) {
      console.log(
        `[dry-run] ${existing ? "update" : "create"} GitHub issue #${issue.number}`
      );
    } else if (existing) {
      await baserow.updateRow(tableId, existing.id, payload);
      updated += 1;
    } else {
      await baserow.createRow(tableId, payload);
      created += 1;
    }
  }

  console.log(
    DRY_RUN ? "Dry run complete - no changes written." : `Created ${created}, updated ${updated}.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
