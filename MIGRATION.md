# Baserow Migration Notes

The Airtable data has been imported directly into Baserow. The repo now treats
Baserow as the editable source of truth and rebuilds `README.md` plus
`EXTENDED.md` from the imported Baserow tables.

## Connected Tables

These IDs were discovered from the authenticated Baserow database token.

| Purpose | Baserow table | Table ID |
| --- | --- | --- |
| Provider directory | `Awesome Aussies` | `1061296` |
| Categories lookup | `Categories` | `1061297` |
| Games list | `Awesome Aussie - Games` | `1061298` |
| GitHub issue inbox | `Github Issues` | `1061299` |
| README boilerplate | `README` | `1061300` |
| Import report | `Airtable import report` | `1061301` |

## Publishing Rules

`scripts/build-readme.js` uses the imported `Status` field:

- `README.md`: rows where `Status = Active - Awesome List`
- `EXTENDED.md`: rows where `Status = Active - Extended List`

Override locally if needed:

```bash
README_STATUSES="Active - Awesome List" pnpm run readme
EXTENDED_STATUSES="Active - Extended List" pnpm run extended
```

## Field Mapping

### Providers

The provider table keeps the Airtable-imported field names:

| README field | Baserow field |
| --- | --- |
| Provider | `Provider` |
| URL | `URL` |
| Description | `Description` |
| HQ | `HQ` |
| Alternative to | `Alternative to` |
| Category | `Categories` |
| Extended reason | `Reason in Extended List` |
| Publishing gate | `Status` |

`Categories` is a linked-row field and `HQ` is a multi-select field. The scripts
normalise both into plain text for Markdown output.

### README Blocks

Boilerplate prose is read from the imported `README` table:

| Baserow field | Usage |
| --- | --- |
| `Name` | Block key, e.g. `GithubAbout`, `GithubAboutExtended`, `LICENSE` |
| `Notes` | Markdown body |

If a block is missing in Baserow, the scripts fall back to `boilerplate/*.md`.

### GitHub Issues

The GitHub issue sync writes to the imported `Github Issues` table using:

`Number`, `Title`, `Labels`, `Milestone`, `Link`, `Body`, `CreatedAt`,
`UpdatedAt`, `State`, `Priority`.

## Local Environment

The local `.env` should contain:

```bash
BASEROW_API_TOKEN=...
BASEROW_PROVIDERS_TABLE_ID=1061296
BASEROW_CATEGORIES_TABLE_ID=1061297
BASEROW_README_BLOCKS_TABLE_ID=1061300
BASEROW_GITHUB_ISSUES_TABLE_ID=1061299
README_STATUSES=Active - Awesome List
EXTENDED_STATUSES=Active - Extended List
GH_API_TOKEN=...
GH_OWNER=AdamXweb
GH_REPO=awesome-aussie
```

`BASEROW_API_BASE_URL` is only needed for self-hosted Baserow.

## API Key Handling

Keep the Baserow token in local `.env` and GitHub Actions secrets only. Do not
commit it. Use a dedicated database token rather than a personal password, and
rotate it after setup if it was shared during migration.

The token tested successfully against Baserow's database-token check endpoint.
It can read rows and fields, but it cannot create schema fields.

## One Schema Gap

The weekly link checker can already produce a JSON report. To let it write the
results back into Baserow, add these fields to the `Awesome Aussies` table:

| Field | Suggested type |
| --- | --- |
| `Stale URL` | Boolean |
| `Last Link Check Status` | Single line text |
| `Last Link Checked At` | Single line text |

Until those fields exist, `pnpm run check-links` runs in report-only mode.

## Verification

Run these after `.env` is filled:

```bash
pnpm run check-schema
pnpm run readme
pnpm run extended
pnpm run check-links -- --dry-run
```

Then add the same Baserow values to GitHub Actions secrets:

- `BASEROW_API_TOKEN`
- `BASEROW_API_BASE_URL` optional
- `BASEROW_PROVIDERS_TABLE_ID`
- `BASEROW_CATEGORIES_TABLE_ID`
- `BASEROW_README_BLOCKS_TABLE_ID`
- `BASEROW_GITHUB_ISSUES_TABLE_ID`
- `GH_API_TOKEN`

The old Airtable secrets can be removed once the Baserow-generated README and
EXTENDED output are verified.

## Automation Cutover

The repo automations now use Baserow instead of Airtable.

| Automation | Schedule | Source | Destination |
| --- | --- | --- | --- |
| Rebuild README/EXTENDED | Daily and manual | Baserow `Awesome Aussies`, `Categories`, and `README` tables | Pull request against `main` |
| Sync GitHub submissions | Hourly and manual | GitHub issues labelled `Addition` | Baserow `Github Issues` table |
| Link checking | Weekly and manual | Baserow `Awesome Aussies` table | JSON report, plus Baserow fields once added |
| Codeberg mirror | Push/manual/weekly | `main` branch | Codeberg mirror |
| Website branch sync | After README workflow | `main` branch | `gh-pages` branch |

GitHub Actions no longer watches the old `airtable` branch, and contributor
forms no longer point users to Airtable submission forms.

The README and issue workflows run `pnpm run check-schema` before touching data.
If a Baserow field is renamed or a table secret is missing, the automation fails
before generating stale output.

The old Airtable-branch entrypoints are also covered:

- `readme/app.js` delegates to the Baserow README builder.
- `readme/extended.js` delegates to the Baserow EXTENDED builder.
- `issues/app.js` delegates to the Baserow GitHub issue sync.

That keeps the old branch layout understandable while the active implementation
lives in `scripts/`.

## Community View

The public README/EXTENDED boilerplate no longer links to Airtable. If you want
readers to browse or download the source data directly from Baserow, create
shared Baserow views and add those URLs to the `GithubAbout` and
`GithubAboutExtended` rows in the Baserow `README` table.

Create public read-only Baserow views for:

- `Awesome Aussies` filtered to `Active - Awesome List`
- `Awesome Aussies` filtered to `Active - Extended List`
- Optional public category/game views

Use the public link for anonymous read-only access, or a private/passworded link
if the data should only be visible to invited curators. The current database
token can update Baserow rows, but view sharing is managed from the Baserow UI or
with a user/JWT-scoped API token.
