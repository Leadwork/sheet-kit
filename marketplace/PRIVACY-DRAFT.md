# SheetKit privacy policy — draft for publisher review

Publisher and contact details must be completed before this policy is published.

## Information processed

SheetKit reads selected spreadsheet cells, including values, formulas, displayed
text, and range information, to preview and perform the operation you select.
It can edit text and background colors, delete matching sheet rows, and insert
columns for merged results. It does not create automatic backup sheets.

The add-on runs on Google Apps Script and displays results in a Google Sheets
sidebar. Its code does not send spreadsheet contents to the publisher, an external
API, an advertising service, or an analytics service.

## Temporary storage

A preview record is stored in Google's Apps Script user cache with a requested
expiration of five minutes. The record contains spreadsheet and sheet identifiers,
the selected range, operation settings (including a custom separator when supplied),
and a digest of the selected data. It does not contain a copy of the cell values.
The record is removed when used and may be evicted earlier by Google.
Preview examples remain visible in the sidebar until replaced or closed.

## Permissions

The current-spreadsheet permission is used to read the selection and apply changes.
The container UI permission is used to show the sidebar. SheetKit does not request
access to Gmail, contacts, or the rest of your Google Drive.

## Service logs and support

Google may process operational metadata and exception logs as part of Apps Script.
The publisher may have access to project execution diagnostics. The app does not
intentionally log spreadsheet cell values. Do not include private cell data when
reporting an issue through a public support channel.

If you contact support, the publisher receives the information you choose to send.
The publisher must specify its contact address and support retention practices
before this draft is finalized.

## User controls

You can close the sidebar, uninstall the add-on, and revoke its Google account
access. These actions do not reverse changes already made to a spreadsheet.
The publisher does not maintain a separate database of your spreadsheet contents.

## Google API data

SheetKit's use and transfer of information received from Google APIs will adhere
to the Google API Services User Data Policy, including the Limited Use requirements.

## Contact

To be completed with the confirmed publisher and public support email.
