# List available commands
default:
    @just --list

# Install dependencies with pnpm (frozen lockfile, matching CI)
[group("dev")]
setup:
    pnpm install --frozen-lockfile

# Rebuild README.md and EXTENDED.md from Airtable (needs AIRTABLE_API_KEY + AIRTABLE_BASE_ID)
[group("ship")]
build:
    pnpm run readme
    pnpm run extended

# Sync GitHub issues to Airtable (needs Airtable secrets + GH_API_TOKEN)
[group("ship")]
issues:
    pnpm run issues
