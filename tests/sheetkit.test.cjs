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
test('duplicate plan identifies only later matches across all selected columns', () => {
  const data = [['A',1],['a',1],['a',2],['A',1],['', ''],['', '']];
  const p = c.plan_(data, [], data, {tool:'dedupe',action:'highlight'});
  assert.deepEqual(plain(p.duplicates), [1,3,5]);
  assert.match(p.summary, /Highlight 3/);
});
test('full row deletion uses absolute row offsets and bottom-up groups', () => {
  const rows = Array.from({length:12}, (_,i)=>['selected '+i,'outside '+i]);
  const original = rows.slice();
  const calls = [];
  const sheet = {deleteRows:(start,count)=>{calls.push([start,count]);rows.splice(start-1,count);}};
  c.applyDuplicates_(sheet,{getRow:()=>4},[1,2,5],'deleteRows');
  assert.deepEqual(calls,[[9,1],[5,2]]);
  assert.deepEqual(rows, original.filter((_,i)=>![4,5,8].includes(i)));
});
test('highlight targets only selected columns and never deletes data', () => {
  const calls=[];
  const sheet={getRange:(...args)=>({setBackground:color=>calls.push([...args,color])})};
  c.applyDuplicates_(sheet,{getRow:()=>4,getColumn:()=>2,getNumColumns:()=>3},[1,2,5],'highlight');
  assert.deepEqual(calls,[[9,2,1,3,'#fff2cc'],[5,2,2,3,'#fff2cc']]);
});
test('protected or merged cells outside selection prevent full row deletion', () => {
  const data={getRow:()=>3}, plan={duplicates:[1]}, options={tool:'dedupe',action:'deleteRows'};
  assert.throws(()=>c.checkDuplicateRows_({getMaxColumns:()=>10,getRange:()=>({canEdit:()=>false})},data,plan,options),/protected/);
  assert.throws(()=>c.checkDuplicateRows_({getMaxColumns:()=>10,getRange:()=>({canEdit:()=>true,isPartOfMerge:()=>true})},data,plan,options),/merged/);
});
test('new column merges preserve source and existing neighbor in all directions', () => {
  for (const direction of ['rows','columns','all']) {
    for (const header of [true,false]) {
      const rows=[['H1','H2','NEIGHBOR'],['=literal','b','keep1'],['c','d','keep2']];
      const before=JSON.parse(JSON.stringify(rows));
      const first=header?2:1;
      const dataValues=rows.slice(first-1).map(row=>row.slice(0,2));
      const o={tool:'merge',direction,destination:'newColumns',header,separator:'|',skipEmpty:true};
      const plan=c.plan_(dataValues,[],dataValues,o);
      const ctx=context();
      ctx.writeText_=(cell,text)=>{rows[cell.r-1][cell.c-1]=text;};
      const makeRange=(r,col)=>({r,c:col,getCell:(dr,dc)=>({r:r+dr-1,c:col+dc-1})});
      const sheet={
        insertColumnsAfter:(col,width)=>rows.forEach(row=>row.splice(col,0,...Array(width).fill(''))),
        getRange:(r,col)=>makeRange(r,col)
      };
      ctx.applyMerge_(sheet,{getLastColumn:()=>2,getRow:()=>1},
        {getRow:()=>first,getNumRows:()=>dataValues.length,getNumColumns:()=>2},plan,o);
      const width=direction==='columns'?2:1;
      rows.forEach((row,i)=>{
        assert.deepEqual(row.slice(0,2),before[i].slice(0,2));
        assert.equal(row[2+width],before[i][2]);
      });
      plan.writes.forEach(w=>assert.equal(rows[first-1+w.row][2+w.col],w.text));
      if(header) assert.match(rows[0][2],/Merged values/);
    }
  }
});
test('replace merge remains available and clears only source contents', () => {
  const calls=[], ctx=context();
  ctx.writeText_=(cell,text)=>calls.push(['write',cell,text]);
  const data={clearContent:()=>calls.push('clear'),getCell:(r,col)=>[r,col]};
  ctx.applyMerge_({}, {}, data, {writes:[{row:0,col:0,text:'a b'}]}, {destination:'replace'});
  assert.deepEqual(plain(calls),['clear',['write',[1,1],'a b']]);
});
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
  const p = c.plan_([['A',new Date(0)],['a',new Date(0)],['1',2],[1,2]], [], [['A'],['a'],['1'],['1']], {tool:'dedupe'});
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
  let record = JSON.stringify({version:2,sheetId:1,a1:'A1:A2',digest:'original',options:{tool:'case',mode:'lower',header:true}});
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
