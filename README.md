<p align="center"><a href="https://github.com/adamxweb/awesome-aussie"><img src="https://user-images.githubusercontent.com/6800453/186379269-07a5a3d0-7c83-4db6-98cf-ca62d77b6303.png" /></a></p>

*<p align="center">The branch that manages automations between Github and Airtable for Awesome Aussie 🦘🇦🇺</p>*


## Intro 
Awesome lists are great to discover information and grow resources in a community.

What I find to be overlooked is the management of the data and ability to share it with other projects.

Airtable has been a good free option to host data that has a great API.

The below provides an outline of the workflows and code that keep everything in sync.


## Scripts

### Readme

#### Awesome aussie Readme
`readme/app.js` connects to Airtable's API to build the Readme.

It checks for data filtered by Airtable that are active in the 'Awesome Aussie' view that are relevant to the list.

The script also ensures that only the categories with an entry are added to the list


#### Extended list
`readme/extended.js` connects to Airtable's API to build the extended list.

It works similarly to the above, and filters data by the 'Extended' view


### Github

#### Issues
`issues/app.js` connects to Github's API and Airtable's API. It syncs recent Github Issues to Airtable.
This allows the Airtable automations to quickly see if a new submission is a duplicate.

#### Pull Requests
`pull/app.js` connects to Github's API and Airtable's API. It syncs recent Github Pull Requests to Airtable.


### Workflows
- Issues: Runs the issues script on schedule
- Readme: Builds both normal Readme and Extended list and creates a pull request to update main branch.
- Sync Mirror: Syncs commits to Codeberg
- Sync Website: Syncs commits to the gh-pages branch which hosts [awesome-aussie.com](https://awesome-aussie.com)

TBC
- Credits: Creates a MD file in .github of contributors
- Spell check: Spell checks the readme to pick up on any errors
- PR labeler: Automatically adds labels to a Pull Request based on the title
- Issue validator and labeler: Automatically adds labels to an Issue based on the title and checks to see if default ticket titles are up to quality
- Welcome non stargazers: any issues where someone hasn't starred, request it
- Github projects issue sync: add new Issues to the github project for easier management.


### Mirrors
The data is available here on Github, but is also mirrored to [Codeberg](https://codeberg.org/adamxweb/awesome-aussie)., and is syncable / downloadable as a CSV from [Airtable ](https://airtable.com/shrZWCu5DHbHFezJl).
