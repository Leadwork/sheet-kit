# Publishing SheetKit

This release is not yet installed as a public add-on, submitted, or approved.
Keep the working personal installation while testing the separate public build.

## 1. Build and test

Run:

    node scripts/build-marketplace.cjs
    node --test tests/*.test.cjs

Create a separate Apps Script project named SheetKit. Copy the four files from
marketplace/apps-script into it. Code.gs uses createAddonMenu and onInstall for
the Editor add-on lifecycle. The source under src keeps the personal menu.
Do not add a card-based Workspace add-on manifest or deploy this as a web app.

Use Deploy → Test deployments and select Editor add-on. Select a disposable
spreadsheet and test installed/enabled authorization states. Confirm the menu
appears under Extensions and opens the sidebar. Repeat the README smoke tests,
including a second Google account, two open spreadsheets, protected cells,
hidden rows, large selections, and denied/revoked authorization.

## 2. Connect Google Cloud

Create a standard Google Cloud project owned by the publisher. In Apps Script
Project Settings, associate its project number. Enable Google Workspace
Marketplace SDK in that same Cloud project.

Configure Google Auth Platform branding, audience, contact information, and
data-access scopes. Public distribution uses an External audience.
Use the same app name and branding as the listing. Configure test users while
testing and complete any OAuth verification Google requires.

Keep these exact scopes aligned across the Apps Script manifest, OAuth
configuration, and Marketplace integration:

- https://www.googleapis.com/auth/spreadsheets.currentonly
- https://www.googleapis.com/auth/script.container.ui

The first reads and modifies the spreadsheet in which the add-on is used.
The second displays its sidebar. No external account or paid API is involved.

## 3. Public pages and listing

Confirm the publisher name, support email and website/domain. Finalize the privacy
draft and terms with the publisher's actual practices. Publish working homepage,
privacy, terms, and support pages. Complete domain verification where Google
requires it; a repository link alone is not a substitute for verified ownership.

Prepare a logo and genuine screenshots from synthetic test data. Confirm name
availability and use the current Marketplace console's asset specifications.
Use LISTING.md as the listing text, filling remaining owner-specific fields.

In Marketplace SDK configure a public Sheets Editor add-on using its Apps Script
ID and the tested script version number. Record that version before submission.
Choose individual installation as well as administrator installation if desired.
Do not mistake a script ID for a Cloud project ID or a version number.

## 4. Submit only after the release is complete

All public links must work; the OAuth and add-on installation flow must pass.
Complete required OAuth review and submit the Marketplace listing for Google's
review. Approval is not guaranteed or immediate. Organization administrators may
restrict installation even after public approval.

Record the eventual listing URL here only after it exists. Future source changes
must be released through a new tested Apps Script version and updated integration.

## Official references

- https://developers.google.com/workspace/add-ons/concepts/editor-auth-lifecycle
- https://developers.google.com/workspace/add-ons/how-tos/testing-editor-addons
- https://developers.google.com/workspace/marketplace/how-to-publish
- https://developers.google.com/workspace/marketplace/create-listing
- https://developers.google.com/workspace/marketplace/about-app-review
