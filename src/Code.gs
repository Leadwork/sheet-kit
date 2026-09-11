/** @OnlyCurrentDoc */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('SheetKit').addItem('Open tools', 'showSheetKit').addToUi();
}
function showSheetKit() {
  SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutputFromFile('Sidebar').setTitle('SheetKit'));
}
function selection_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var list = ss.getActiveRangeList();
  if (!list || list.getRanges().length !== 1) throw new Error('Select one rectangular range first.');
  var range = list.getRanges()[0];
  if (range.getNumRows() * range.getNumColumns() > 20000) throw new Error('Select up to 20,000 cells at a time.');
  if (range.isPartOfMerge()) throw new Error('Unmerge the selected cells first.');
  if (!range.canEdit()) throw new Error('You need permission to edit every selected cell.');
  return range;
}
function digest_(range) {
  var data = JSON.stringify([range.getValues(), range.getFormulas(), range.getDisplayValues()]);
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, data));
}
function previewSheetKit(input) {
  var range = selection_();
  var options = options_(input);
  var rows = range.getNumRows() - (options.header ? 1 : 0);
  if (rows < 1) throw new Error('Select at least one data row below the header.');
  var data = options.header ? range.offset(1, 0, rows, range.getNumColumns()) : range;
  var values = data.getValues(), formulas = data.getFormulas(), display = data.getDisplayValues();
  var plan = plan_(values, formulas, display, options);
  checkDuplicateRows_(range.getSheet(), data, plan, options);
  if (!plan.count) throw new Error('No changes needed for this selection.');
  if (options.tool === 'case' && plan.writes.length > 500) throw new Error('Select a smaller range: at most 500 text cells can change per run.');
  var token = Utilities.getUuid();
  var record = {version: 2, sheetId: range.getSheet().getSheetId(), a1: range.getA1Notation(), digest: digest_(range), options: options};
  CacheService.getUserCache().put('sheetkit:' + token, JSON.stringify(record), 300);
  return {token: token, location: range.getSheet().getName() + '!' + range.getA1Notation(), summary: plan.summary, sample: plan.sample};
}
function applySheetKit(token) {
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(10000)) throw new Error('Another SheetKit operation is running. Try again.');
  var backup = null;
  try {
    var cache = CacheService.getUserCache(), key = 'sheetkit:' + token;
    var raw = cache.get(key);
    if (!raw) throw new Error('Preview expired or already used. Preview again.');
    cache.remove(key);
    var record = JSON.parse(raw), ss = SpreadsheetApp.getActiveSpreadsheet();
    if (record.version !== 2) throw new Error('SheetKit was updated. Close the sidebar, reopen it and preview again.');
    var sheet = ss.getSheets().filter(function(s) { return s.getSheetId() === record.sheetId; })[0];
    if (!sheet) throw new Error('The source sheet no longer exists.');
    var range = sheet.getRange(record.a1);
    if (!range.canEdit() || range.isPartOfMerge()) throw new Error('Selection permissions or merged cells changed. Preview again.');
    if (digest_(range) !== record.digest) throw new Error('The source data changed. Preview again before applying.');
    var o = record.options;
    var data = o.header ? range.offset(1, 0, range.getNumRows() - 1, range.getNumColumns()) : range;
    var plan = plan_(data.getValues(), data.getFormulas(), data.getDisplayValues(), o);
    checkDuplicateRows_(sheet, data, plan, o);
    if (!plan.count) return 'No changes needed.';
    backup = sheet.copyTo(ss);
    backup.setName('SK Backup ' + Utilities.formatDate(new Date(), 'Etc/UTC', 'yyyyMMdd HHmmss') + ' ' + Utilities.getUuid().slice(0, 6));
    if (o.tool === 'dedupe') {
      applyDuplicates_(sheet, data, plan.duplicates, o.action);
    } else if (o.tool === 'merge') {
      applyMerge_(sheet, range, data, plan, o);
    } else {
      plan.writes.forEach(function(w) { writeText_(data.getCell(w.row + 1, w.col + 1), w.text); });
    }
    SpreadsheetApp.flush();
    ss.setActiveSheet(sheet);
    if (o.tool === 'dedupe' && o.action !== 'highlight') {
      sheet.getRange(Math.min(range.getRow(), sheet.getMaxRows()), range.getColumn()).activate();
    } else range.activate();
    return plan.summary + ' Backup: ' + backup.getName();
  } catch (error) {
    throw new Error(error.message + (backup ? ' Your original data is in "' + backup.getName() + '".' : ''));
  } finally {
    lock.releaseLock();
  }
}
function duplicateGroups_(indexes) {
  var groups = [];
  indexes.forEach(function(index) {
    var last = groups[groups.length - 1];
    if (last && last.start + last.count === index) last.count++;
    else groups.push({start: index, count: 1});
  });
  return groups;
}
function checkDuplicateRows_(sheet, data, plan, options) {
  if (options.tool !== 'dedupe') return;
  var groups = duplicateGroups_(plan.duplicates);
  if (groups.length > 500) throw new Error('Select a smaller range: at most 500 separate duplicate groups per run.');
  if (options.action === 'highlight') return;
  groups.forEach(function(group) {
    var fullRows = sheet.getRange(data.getRow() + group.start, 1, group.count, sheet.getMaxColumns());
    if (!fullRows.canEdit()) throw new Error('A duplicate row contains protected cells outside your selection. Use highlighting or change permissions.');
    if (fullRows.isPartOfMerge()) throw new Error('A duplicate row contains merged cells. Unmerge those cells or use highlighting.');
  });
}
function applyDuplicates_(sheet, data, indexes, action) {
  var groups = duplicateGroups_(indexes);
  // Delete bottom-up so earlier row numbers stay valid.
  groups.reverse().forEach(function(group) {
    var row = data.getRow() + group.start;
    if (action === 'highlight') {
      sheet.getRange(row, data.getColumn(), group.count, data.getNumColumns()).setBackground('#fff2cc');
    } else sheet.deleteRows(row, group.count);
  });
}
function applyMerge_(sheet, range, data, plan, options) {
  var target = data;
  if (options.destination === 'newColumns') {
    var width = options.direction === 'columns' ? data.getNumColumns() : 1;
    var column = range.getLastColumn() + 1;
    sheet.insertColumnsAfter(range.getLastColumn(), width);
    target = sheet.getRange(data.getRow(), column, data.getNumRows(), width);
    if (options.header) {
      for (var c = 0; c < width; c++) {
        writeText_(sheet.getRange(range.getRow(), column + c), width === 1 ? 'Merged values' : 'Merged values ' + (c + 1));
      }
    }
  } else data.clearContent();
  plan.writes.forEach(function(w) { writeText_(target.getCell(w.row + 1, w.col + 1), w.text); });
}
function writeText_(cell, text) {
  // Rich text stores literal strings, including leading =, without executing formulas.
  if (text === '') cell.clearContent();
  else cell.setRichTextValue(SpreadsheetApp.newRichTextValue().setText(text).build());
}
