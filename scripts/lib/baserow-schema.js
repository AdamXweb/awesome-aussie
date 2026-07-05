const PROVIDER_FIELDS = [
  "Provider",
  "URL",
  "Description",
  "Size",
  "HQ",
  "Categories",
  "Alternative to",
  "Status",
  "LinkedIn",
  "crunchbase",
  "Association Disclosure",
  "Start date",
  "Also / Previously known as",
  "Notes",
  "Company Type",
  "Github Issue URL",
  "Reason in Extended List",
];

const LINK_CHECK_FIELDS = [
  "Stale URL",
  "Last Link Check Status",
  "Last Link Checked At",
];

const README_BLOCK_FIELDS = ["Name", "Notes"];

const CATEGORY_FIELDS = ["Category"];

const GITHUB_ISSUE_FIELDS = [
  "Number",
  "Title",
  "Labels",
  "Milestone",
  "Link",
  "Body",
  "CreatedAt",
  "UpdatedAt",
  "State",
  "Priority",
];

const DEFAULT_README_STATUSES = ["Active - Awesome List"];
const DEFAULT_EXTENDED_STATUSES = ["Active - Extended List"];

const BOILERPLATE_MAP = {
  GithubAbout: "github-about",
  GithubAboutExtended: "github-about-extended",
  LICENSE: "license",
  Contributing: "contributing",
  "Thank You": "thank-you",
};

module.exports = {
  PROVIDER_FIELDS,
  LINK_CHECK_FIELDS,
  README_BLOCK_FIELDS,
  CATEGORY_FIELDS,
  GITHUB_ISSUE_FIELDS,
  DEFAULT_README_STATUSES,
  DEFAULT_EXTENDED_STATUSES,
  BOILERPLATE_MAP,
};
