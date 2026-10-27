// Only these two explicitly approved presentation additions are normalized.
// Exact status bytes matter: a broader selector could hide unintended changes.
const fs = require('node:fs');
const path = require('node:path');
const originalStatus = require('./iphone-baseline.json').original_status;
const approvedStatus = fs.readFileSync(path.join(__dirname, 'iphone-status.html'), 'utf8').trimEnd();
const linkPattern = /<link rel="stylesheet" href="iphone-device\.css\?v=[^"\s]+">/;
const normalizeIphone = html => html.replace(linkPattern, '').replace(approvedStatus, originalStatus);
module.exports = {normalizeIphone, originalStatus, approvedStatus, linkPattern};
