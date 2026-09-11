# SheetKit

Three focused tools in a Google Sheets sidebar, built with Google Apps Script.
No paid API, hosting, or Ablebits subscription required. Google account quotas apply.

## Install in your spreadsheet

1. Open the Google Sheet where you want SheetKit.
2. Choose **Extensions → Apps Script** and name the project **SheetKit**.
3. Replace the default `Code.gs` content with [src/Code.gs](src/Code.gs).
4. Click **+ → Script**, name it **Core**, and paste [src/Core.gs](src/Core.gs).
5. Click **+ → HTML**, name it **Sidebar**, and paste [src/Sidebar.html](src/Sidebar.html).
6. In **Project Settings**, enable **Show "appsscript.json" manifest file in editor**.
   Replace its contents with [src/appsscript.json](src/appsscript.json).
7. Save all files and reload your spreadsheet.
8. Choose **SheetKit → Open tools**. On first use, authorize your own script with Google.

This is a script attached to one spreadsheet, not a Marketplace installation.
No web-app deployment is needed. Repeat the setup for other existing spreadsheets,
or make a copy of a spreadsheet that already contains SheetKit.
Managed Workspace accounts may require administrator permission to run scripts.
If Google shows an unverified-app screen, check that the project is the one you
created and that it requests only the spreadsheet and sidebar permissions.

## Use

Select a rectangular range, choose a tool, review **First selected row is a header**,
then click **Preview selection → Back up & apply**.

- **Remove duplicate rows:** compares every selected column and keeps the first
  occurrence, using Google's native case-insensitive duplicate removal. The preview
  count is an estimate; Google's matching semantics determine the result.
  Only selected cells compact upward. Select your entire table to avoid misaligning
  columns outside the selection. Blank duplicate rows are included.
- **Merge values:** join each row, each column, or the whole selection. Supports
  comma, space, newline, semicolon, no separator, and custom separators.
  Uses displayed text, including formatted dates/numbers and formula results.
  Writes to the leftmost/top/top-left cell and clears remaining selected contents.
  It does not physically merge spreadsheet cells.
- **Change case:** lowercase, title case, or sentence case. Skips formulas, numbers
  and dates. Title case capitalizes every word, not editorial headline style.
  Sentence case uses punctuation followed by whitespace as sentence boundaries;
  names, abbreviations and acronyms are not detected. Changed text cells lose
  hyperlinks and mixed character formatting; cell-level formatting stays.

Preview is tied to its original sheet and range and expires after five minutes.
Editing the source values, formulas, or display values invalidates it.
Changing the selection alone does not retarget the pending operation.

## Backups and limits

Before writing, SheetKit copies the whole source sheet into the same spreadsheet,
named `SK Backup <timestamp> <id>`. If copying fails, no source changes are made.
For recovery, open the backup and copy the needed original cells back to the source
sheet. Keep the source sheet when other sheets reference it. Delete backup tabs
manually when you no longer need them.

Apps Script edits are not guaranteed to work with normal Ctrl+Z. A failed operation
may partially apply; its error identifies the backup. Backups are ordinary copies,
not an automatic transactional rollback.

- Maximum 20,000 selected cells per run.
- Maximum 500 changed text cells per case run.
- Maximum 500 merged output cells per run.
- Merged values cannot exceed 50,000 characters per output cell.
- Merged source cells and multiple selections are rejected.
- The document lock serializes SheetKit runs, but cannot block edits by other people.
  Avoid simultaneous editing of the range during an operation.
- Google execution time and spreadsheet cell limits still apply. Large sheets may
  lack enough room for a full backup; reduce sheet size or work in a smaller copy.

No external network calls, telemetry, API keys, or paid dependencies are included.

## Development

Node.js 18 or newer:

```sh
npm test
```

Tests exercise transformation behavior and mocked Apps Script integration. A real
Google account is still needed for authorization and the live sidebar smoke test.

### Live smoke test

Use a disposable sheet with a header and several rows:
duplicate rows with different text case, blank cells, a formula, a date,
mixed-case text, and a literal string starting with `=`.

1. Remove duplicates across the whole table; check the first row remains and
   columns stay aligned.
2. Merge in each direction with a newline separator and empty-cell skipping.
   Check source contents are cleared and formula-like output remains literal text.
3. Run all case modes; confirm formulas and typed numbers/dates stay unchanged.
4. Check each backup contains the original data.
5. Preview, edit a source cell, and apply: expect a stale-preview error.
6. Preview, change selection, and apply: expect the original preview range to change.

## References

- [Google Apps Script sidebars](https://developers.google.com/apps-script/guides/dialogs)
- [Range API](https://developers.google.com/apps-script/reference/spreadsheet/range)
- [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas)
