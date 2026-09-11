const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
function context(extra = {}) {
  const c = vm.createContext({Date, ...extra});
  for (const file of ['Core.gs','Code.gs']) vm.runInContext(fs.readFileSync(path.join(root, 'src', file), 'utf8'), c);
  return c;
}
const c = context();
const plain = x => JSON.parse(JSON.stringify(x));
test('case modes handle apostrophes, accents, punctuation and Bengali', () => {
  assert.equal(c.changeCase_("JOHN'S CAFÉ", 'title'), "John's Café");
  assert.equal(c.changeCase_('hELLO. hOW ARE YOU? “GOOD!”', 'sentence'), 'Hello. How are you? “Good!”');
  assert.equal(c.changeCase_('বাংলা HELLO', 'lower'), 'বাংলা hello');
});
test('case skips formulas, numeric and date values', () => {
  const p = c.plan_([['HELLO', 12, new Date(0), 'RESULT']], [['','','','=UPPER(A1)']], [[]], {tool:'case',mode:'lower'});
  assert.deepEqual(plain(p.writes), [{row:0,col:0,text:'hello'}]);
});
test('duplicates ignore letter case, keep typed values distinct and match dates', () => {
  const p = c.plan_([['A',new Date(0)],['a',new Date(0)],['1',2],[1,2]], [], [['a']], {tool:'dedupe'});
  assert.equal(p.count, 1);
});
test('merge directions, empty cells and literal formulas', () => {
  const data = [['=A1',''],['b','c']];
  const p = direction => plain(c.plan_(data,[],data,{tool:'merge',direction,separator:'|',skipEmpty:true}).writes);
  assert.deepEqual(p('rows'),[{row:0,col:0,text:'=A1'},{row:1,col:0,text:'b|c'}]);
  assert.deepEqual(p('columns'),[{row:0,col:0,text:'=A1|b'},{row:0,col:1,text:'c'}]);
  assert.deepEqual(p('all'),[{row:0,col:0,text:'=A1|b|c'}]);
  assert.equal(c.plan_(data,[],data,{tool:'merge',direction:'all',separator:'\n',skipEmpty:false}).writes[0].text,'=A1\n\nb\nc');
});
test('reject invalid options, one-cell merges and oversized output', () => {
  assert.throws(()=>c.options_({tool:'unknown'}));
  assert.throws(()=>c.options_({tool:'case',mode:'unknown'}));
  assert.throws(()=>c.plan_([['x']],[],[['x']],{tool:'merge',direction:'all'}));
  assert.throws(()=>c.plan_([['x','y']],[],[['x'.repeat(50000),'y']],{tool:'merge',direction:'all',separator:','}));
});
function harness({changed=false, backupFailure=false, writeFailure=false} = {}) {
  const calls = [];
  const data = {
    getValues:()=>[['HELLO']],getFormulas:()=>[['']],getDisplayValues:()=>[['HELLO']],
    removeDuplicates:()=>calls.push('dedupe'),clearContent:()=>calls.push('clear'),
    getCell:()=>({setRichTextValue:value=>{calls.push(['write',value]);if(writeFailure)throw Error('Write failed');},clearContent:()=>calls.push('clear-cell')})
  };
  const range = {...data,canEdit:()=>true,isPartOfMerge:()=>false,getNumRows:()=>2,getNumColumns:()=>1,offset:()=>data,activate:()=>calls.push('activate')};
  const backup = {setName:n=>calls.push('name'),getName:()=> 'SK Backup test'};
  const sheet = {getSheetId:()=>1,getRange:()=>range,copyTo:()=>{calls.push('backup');if(backupFailure)throw Error('Copy failed');return backup;}};
  const ss = {getSheets:()=>[sheet],setActiveSheet:()=>{}};
  let record = JSON.stringify({sheetId:1,a1:'A1:A2',digest:'original',options:{tool:'case',mode:'lower',header:true}});
  const ctx = context({
    LockService:{getDocumentLock:()=>({tryLock:()=>true,releaseLock:()=>calls.push('unlock')})},
    CacheService:{getUserCache:()=>({get:()=>record,remove:()=>{record=null;}})},
    SpreadsheetApp:{getActiveSpreadsheet:()=>ss,flush:()=>{},newRichTextValue:()=>({setText(text){this.text=text;return this;},build(){return {text:this.text};}})},
    Utilities:{formatDate:()=> 'date',getUuid:()=> 'abcdef'}
  });
  ctx.digest_ = () => changed ? 'changed' : 'original';
  return {ctx,calls};
}
test('apply backs up before writing and consumes the preview', () => {
  const {ctx,calls} = harness();
  assert.match(ctx.applySheetKit('token'), /Backup: SK Backup test/);
  assert.ok(calls.indexOf('backup') < calls.findIndex(x=>Array.isArray(x)));
  assert.deepEqual(plain(calls.find(x=>Array.isArray(x))),['write',{text:'hello'}]);
  assert.throws(()=>ctx.applySheetKit('token'),/expired or already used/);
});
test('stale source rejects before backup or mutation and releases lock', () => {
  const {ctx,calls} = harness({changed:true});
  assert.throws(()=>ctx.applySheetKit('token'),/source data changed/);
  assert.deepEqual(calls,['unlock']);
});
test('backup failure leaves source unchanged', () => {
  const {ctx,calls} = harness({backupFailure:true});
  assert.throws(()=>ctx.applySheetKit('token'),/Copy failed/);
  assert.deepEqual(calls,['backup','unlock']);
});
test('partial write failure reports recovery sheet and releases lock', () => {
  const {ctx,calls} = harness({writeFailure:true});
  assert.throws(()=>ctx.applySheetKit('token'),/original data is in "SK Backup test"/);
  assert.equal(calls.at(-1),'unlock');
});
test('sidebar JavaScript parses and manifest scopes are limited', () => {
  const html = fs.readFileSync(path.join(root,'src/Sidebar.html'),'utf8');
  new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'src/appsscript.json'),'utf8'));
  assert.equal(manifest.oauthScopes.length,2);
  assert.ok(manifest.oauthScopes.includes('https://www.googleapis.com/auth/spreadsheets.currentonly'));
});
