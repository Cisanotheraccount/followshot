const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../site');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let count = 0;
for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (url.startsWith('#') || url.startsWith('https://')) continue;
  assert(!url.startsWith('/'), `Asset must work under /followshot/: ${url}`);
  assert(fs.statSync(path.join(root, url)).isFile(), `Missing asset: ${url}`);
  count++;
}
for (let id = 1; id <= 4; id++) assert(fs.existsSync(path.join(root, `media/shot${id}.svg`)));
assert(!fs.existsSync(path.join(root, 'CNAME')), 'Project site must inherit the account domain');
assert(html.indexOf('site-language.js') < html.indexOf('src="app.js"'), 'Load locale before simulator');
assert(!/https?:\/\//.test(fs.readFileSync(path.join(root, 'app.js'), 'utf8')), 'Simulator must remain local');
console.log(`PASS ${count} relative HTML asset references, four reference shots, inherited-domain and local-only boundaries`);
