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
  if (!plan.count) throw new Error('No changes needed for this selection.');
  if (options.tool === 'case' && plan.writes.length > 500) throw new Error('Select a smaller range: at most 500 text cells can change per run.');
  var token = Utilities.getUuid();
  var record = {sheetId: range.getSheet().getSheetId(), a1: range.getA1Notation(), digest: digest_(range), options: options};
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
    var sheet = ss.getSheets().filter(function(s) { return s.getSheetId() === record.sheetId; })[0];
    if (!sheet) throw new Error('The source sheet no longer exists.');
    var range = sheet.getRange(record.a1);
    if (!range.canEdit() || range.isPartOfMerge()) throw new Error('Selection permissions or merged cells changed. Preview again.');
    if (digest_(range) !== record.digest) throw new Error('The source data changed. Preview again before applying.');
    var o = record.options;
    var data = o.header ? range.offset(1, 0, range.getNumRows() - 1, range.getNumColumns()) : range;
    var plan = plan_(data.getValues(), data.getFormulas(), data.getDisplayValues(), o);
    if (!plan.count) return 'No changes needed.';
    backup = sheet.copyTo(ss);
    backup.setName('SK Backup ' + Utilities.formatDate(new Date(), 'Etc/UTC', 'yyyyMMdd HHmmss') + ' ' + Utilities.getUuid().slice(0, 6));
    if (o.tool === 'dedupe') {
      // Native operation compacts only this range; cells outside it are untouched.
      data.removeDuplicates();
    } else if (o.tool === 'merge') {
      data.clearContent();
      plan.writes.forEach(function(w) { writeText_(data.getCell(w.row + 1, w.col + 1), w.text); });
    } else {
      plan.writes.forEach(function(w) { writeText_(data.getCell(w.row + 1, w.col + 1), w.text); });
    }
    SpreadsheetApp.flush();
    ss.setActiveSheet(sheet);
    range.activate();
    return plan.summary + ' Backup: ' + backup.getName();
  } catch (error) {
    throw new Error(error.message + (backup ? ' Your original data is in "' + backup.getName() + '".' : ''));
  } finally {
    lock.releaseLock();
  }
}
function writeText_(cell, text) {
  // Rich text stores literal strings, including leading =, without executing formulas.
  if (text === '') cell.clearContent();
  else cell.setRichTextValue(SpreadsheetApp.newRichTextValue().setText(text).build());
}
