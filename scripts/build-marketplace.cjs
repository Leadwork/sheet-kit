// Build an Editor add-on without changing the personal bound-script menu.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const out = path.join(root, 'marketplace', 'apps-script');
fs.mkdirSync(out, {recursive:true});
let code = fs.readFileSync(path.join(root, 'src/Code.gs'), 'utf8');
const personalMenu = "SpreadsheetApp.getUi().createMenu('SheetKit')";
if (!code.includes(personalMenu)) throw new Error('Menu entry point changed; update the add-on build.');
code = code.replace(personalMenu, 'SpreadsheetApp.getUi().createAddonMenu()');
code += '\n// Populate the Extensions menu when installed inside an editor.\nfunction onInstall(e) { onOpen(e); }\n';
fs.writeFileSync(path.join(out, 'Code.gs'), code);
for (const file of ['Core.gs','Sidebar.html','appsscript.json']) {
  fs.copyFileSync(path.join(root, 'src', file), path.join(out, file));
}
console.log('Built marketplace/apps-script');
