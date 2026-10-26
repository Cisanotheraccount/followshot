const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../site');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
let count = 0;
const videoFiles = new Set();

function localAsset(url, from = root) {
  if (/^(?:#|https?:\/\/|data:)/.test(url)) return;
  assert(!url.startsWith('/'), `Asset must work under /followshot/: ${url}`);
  const assetPath = decodeURIComponent(url.split(/[?#]/, 1)[0]);
  assert(assetPath, `Asset URL must have a path: ${url}`);
  const resolved = path.resolve(from, assetPath);
  assert(resolved.startsWith(root + path.sep), `Asset must stay inside site/: ${url}`);
  assert(fs.existsSync(resolved), `Missing asset: ${url}`);
  assert(fs.statSync(resolved).isFile(), `Asset is not a file: ${url}`);
  assert(fs.statSync(resolved).size > 0, `Asset is empty: ${url}`);
  if (path.extname(resolved).toLowerCase() === '.mp4') videoFiles.add(resolved);
  count++;
}

// Word boundary avoids counting src twice inside data-src. Match the complete
// attribute name so lazy sources, poster images, and versioned URLs are covered.
for (const [, , url] of html.matchAll(/\s(src|href|data-src|poster)="([^"]+)"/g)) localAsset(url);
for (const [, url] of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) localAsset(url);

for (let id = 1; id <= 4; id++) {
  const image = path.join(root, `media/shot${id}.jpg`);
  assert(fs.existsSync(image), `Missing real reference frame ${id}`);
  const bytes = fs.readFileSync(image);
  assert(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff, `Reference frame ${id} must be a JPEG, not a renamed placeholder`);
}
const manifestPath = path.join(root, 'media/reference-manifest.json');
assert(fs.existsSync(manifestPath), 'Real footage needs a source/timestamp manifest');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const mediaRoot = path.join(root, 'media');
for (const file of [manifest.reference, manifest.preview, manifest.poster?.file, ...(manifest.shots || []).map(shot => shot.file)]) {
  assert(typeof file === 'string', 'Manifest assets must have local filenames');
  localAsset(file, mediaRoot);
}
assert(Number.isFinite(manifest.duration_seconds) && manifest.duration_seconds > 0, 'Manifest records a positive source duration');
assert(manifest.width > 0 && manifest.height > 0 && manifest.fps > 0, 'Manifest records valid video dimensions and frame rate');
assert(manifest.shots.length === 4 && manifest.shots.map(shot => shot.id).join(',') === '1,2,3,4', 'Manifest contains the four stable reference-shot IDs');
for (const shot of manifest.shots) {
  assert(shot.seconds >= 0 && shot.preview_end_seconds > shot.seconds && shot.preview_end_seconds <= manifest.duration_seconds, `Shot ${shot.id} has a valid source window`);
}
assert(/manual/i.test(manifest.analysis) && /not model-generated/i.test(manifest.analysis), 'Manifest distinguishes manually selected examples from model output');
assert(/authorized/i.test(manifest.permission), 'Manifest records the creator permission boundary');

// Validate top-level ISO BMFF boxes without requiring ffmpeg in CI. This catches
// accidental placeholder files or truncated video transfers, not codec quality.
for (const file of videoFiles) {
  const bytes = fs.readFileSync(file);
  const boxes = [];
  for (let offset = 0; offset < bytes.length;) {
    assert(offset + 8 <= bytes.length, `Truncated MP4 box header: ${path.basename(file)}`);
    let size = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    let header = 8;
    if (size === 1) {
      assert(offset + 16 <= bytes.length, `Truncated extended MP4 header: ${path.basename(file)}`);
      const extended = bytes.readBigUInt64BE(offset + 8);
      assert(extended <= BigInt(Number.MAX_SAFE_INTEGER), 'MP4 box size exceeds supported range');
      size = Number(extended); header = 16;
    } else if (size === 0) size = bytes.length - offset;
    assert(size >= header && offset + size <= bytes.length, `Invalid MP4 ${type} box: ${path.basename(file)}`);
    boxes.push(type); offset += size;
  }
  assert(boxes.includes('ftyp') && boxes.includes('moov') && boxes.includes('mdat'), `MP4 needs file type, metadata, and real media data: ${path.basename(file)}`);
}
assert(!fs.existsSync(path.join(root, 'CNAME')), 'Project site must inherit the account domain');
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(match => match[1].split(/[?#]/, 1)[0]);
assert(scripts.includes('site-language.js') && scripts.includes('app.js'), 'Load locale and simulator scripts');
assert(scripts.indexOf('site-language.js') < scripts.indexOf('app.js'), 'Load locale before simulator');
assert(scripts.includes('site-motion.js'), 'Load the optional real-footage motion controller');
assert(!/https?:\/\//.test(fs.readFileSync(path.join(root, 'app.js'), 'utf8')), 'Simulator must remain local');
assert(!/https?:\/\//.test(fs.readFileSync(path.join(root, 'site-motion.js'), 'utf8')), 'Motion controller must remain local');
assert(/href="style\.css\?v=[^"\s]+"/.test(html), 'Version the stylesheet to avoid mixed cached releases');
for (const script of ['site-language.js', 'app.js', 'site-motion.js']) {
  assert(new RegExp('src="' + script.replaceAll('.', '\\.') + '\\?v=[^"\\s]+"').test(html), `Version ${script} to avoid mixed cached releases`);
}
console.log(`PASS ${count} local HTML/CSS asset references, four real JPEG frames, versioned scripts, inherited-domain and local-only boundaries`);
