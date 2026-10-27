const {normalizeFooterHTML} = require('./footer-normalize.cjs');
const {normalizeHeroHTML, normalizeHeroLocale} = require('./hero-normalize.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const html = normalizeHeroHTML(normalizeFooterHTML(read('site/index.html')));
const source = read('site/native-duo.js');
const css = read('site/native-duo.css');
const locale = normalizeHeroLocale(read('site/site-language.js'));
const baseline = require('./native-baseline.json');
const nativeAssets = require('./native-assets.json');
const {normalizeIphone} = require('./iphone-normalize.cjs');
let count = 0;
const check = (value, label) => { assert.ok(value, label); count++; console.log('PASS', label); };
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function sectionById(id) {
  const opening = [...html.matchAll(/<section\b[^>]*>/g)].find(m => m[0].includes(`id="${id}"`));
  assert.ok(opening, `Section exists: ${id}`);
  let depth = 0;
  const rest = html.slice(opening.index);
  for (const token of rest.matchAll(/<\/?section\b[^>]*>/g)) {
    depth += token[0].startsWith('</') ? -1 : 1;
    if (!depth) return rest.slice(0, token.index + token[0].length);
  }
  throw new Error(`Unclosed section: ${id}`);
}
function attributes(markup) {
  return Object.fromEntries([...markup.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
}
function localeObject(name) {
  const match = locale.match(new RegExp(`const ${name} = (\\{[\\s\\S]*?\\n  \\});`));
  assert.ok(match, `Existing locale ${name} map is readable`);
  return vm.runInNewContext(`(${match[1]})`);
}

const section = sectionById('native-duo');
check((html.match(/id="native-duo"/g) || []).length === 1, 'Exactly one native showcase is added');
check(html.indexOf(section) > html.indexOf(sectionById('demo')) && html.indexOf(section) < html.indexOf(sectionById('process')), 'Native evidence follows the interactive demo and precedes the process section');
check(/aria-labelledby="native-duo-title"/.test(section) && /id="native-duo-title"/.test(section), 'Native section has a real accessible heading association');
const controlMarkup = [...section.matchAll(/<button\b[^>]*data-native-view="[^"]+"[^>]*>[\s\S]*?<\/button>/g)].map(m => m[0]);
const panelMarkup = [...section.matchAll(/<figure\b[^>]*data-native-panel="[^"]+"[^>]*>/g)].map(m => m[0]);
check(controlMarkup.length === 3 && panelMarkup.length === 3, 'Exactly three verified manual main views are offered');
check((section.match(/class="native-card"/g) || []).length === 2, 'Two smaller feature cards remain static evidence');
check((section.match(/<button\b/g) || []).length === 3, 'Screenshots have no fake in-app or carousel controls');
for (const name of ['capture', 'plan', 'editor']) {
  const button = attributes(controlMarkup.find(x => x.includes(`data-native-view="${name}"`)) || '');
  const panel = panelMarkup.find(x => x.includes(`data-native-panel="${name}"`)) || '';
  check(button.type === 'button' && button['aria-controls'] === `native-${name}-panel`, `${name}: a normal keyboard-operable button controls its real panel`);
  check(attributes(panel).id === button['aria-controls'], `${name}: control and panel IDs match`);
  check(button['aria-pressed'] === String(name === 'capture') && /\shidden(?:\s|>)/.test(panel) === (name !== 'capture'), `${name}: no-script initial visibility agrees with the selected button`);
}
check(!/<video\b|<audio\b|<iframe\b|\bautoplay\b|data-action=/.test(section), 'Native screenshots cannot autoplay or invoke simulator actions');
check(!/class="(?:device|device-wrap|device-stage|phone-frame|phone-shell)(?:"|\s)/.test(section), 'Original native screenshots are not wrapped in an extra simulated phone shell');
check(/Device Hub/.test(section) && /原生 App 运行截图/.test(section), 'Native screenshot evidence is identified separately from the web demo');

const images = [...section.matchAll(/<img\b[^>]*>/g)].map(m => attributes(m[0]));
check(images.length === 5, 'Five actual native screenshots are referenced');
check(images.map(img => img.src).join('|') === ['open-capture','open-plan','open-editor','half-take','closed-storyboard'].map(name => `media/duo/${name}.png`).join('|'), 'Only the verified capture, plan, editor, half-folded take and closed-storyboard assets are used');
check(!/closed-preview|成片预览|story preview|finished (?:film|story)|完整的故事节奏/i.test(section), 'The preserved partial native draft is not misrepresented as a completed preview');
check(/合上，确认分镜。/.test(section) && /回看参考与镜头建议，确认后进入拍摄安排。/.test(section), 'Closed-device copy describes the real storyboard-confirmation screen');
const translations = localeObject('copy');
const altTranslations = localeObject('attributes');
for (const img of images) {
  check(img.loading === 'lazy' && img.alt && img.alt.length > 5, `${img.src}: screenshot is lazy-loaded with a descriptive alternative`);
  check(typeof altTranslations[img.alt] === 'string' && !/[\u4e00-\u9fff]/.test(altTranslations[img.alt]), `${img.src}: alternative text has an English translation`);
}
for (const text of [...section.matchAll(/<(?:h2|h3|p|button)\b[^>]*>([^<]+)<\/(?:h2|h3|p|button)>/g)].map(m => m[1])) {
  if (!/[\u4e00-\u9fff]/.test(text)) continue;
  check(typeof translations[text] === 'string' && !/[\u4e00-\u9fff]/.test(translations[text]), `Native copy is bilingual: ${text}`);
}
check(/\.native-section \.native-main-visual img\{[^}]*object-fit:contain/.test(css) && /\.native-section \.native-card-visual img\{[^}]*object-fit:contain/.test(css), 'Both large and small screenshots contain the complete original device frame');
check(!/object-fit:cover|overflow[^:]*:\s*hidden|clip-path:|mask-image:|background-image:/.test(css), 'Native visuals add no crop, masking or replacement background imagery');
check(/\.native-panel\[hidden\]\{display:none\}/.test(css), 'Hidden main panels are actually removed from layout');
check(/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/.test(css), 'Desktop supporting evidence uses two shrink-safe columns');
check(/@media\(max-width:760px\)[\s\S]*\.native-details\{grid-template-columns:minmax\(0,1fr\)/.test(css), 'Narrow screens stack the complete supporting cards');
check(/@media\(max-width:760px\)[\s\S]*\.native-switch\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/.test(css), 'Narrow view selectors use three equal shrink-safe columns');
check(/\.native-switch\{[^}]*flex-wrap:wrap/.test(css) && /\.native-switch button\{[^}]*min-height:44px/.test(css), 'Manual selectors wrap rather than overflow and retain accessible touch height');
check(/:focus-visible\{outline:3px solid #25f4ee/.test(css), 'Keyboard focus has a high-visibility cyan outline');
check(/prefers-reduced-motion:reduce[\s\S]*transition:none/.test(css), 'Reduced-motion preference removes the selector transition');
check(!/animation:|position:fixed|overflow-x:(?:auto|scroll)/.test(css), 'Showcase adds no automatic carousel, pinned UI, or horizontal scroller');
check(css.split('\n').filter(line => line.trim() && !/^\/\*|^@media/.test(line)).every(line => line.startsWith('.native-section')), 'All native CSS rules are scoped to the new section');

function createNative(options = {}) {
  let language = options.language || 'zh';
  const handlers = {};
  const queriedIds = [];
  const controls = controlMarkup.map(markup => {
    const attrs = attributes(markup);
    return {
      attrs, dataset: {nativeView: attrs['data-native-view']}, handlers: {},
      setAttribute(name, value) { assert.equal(name, 'aria-pressed'); this.attrs[name] = value; },
      addEventListener(name, callback) { this.handlers[name] = callback; }
    };
  });
  const panels = panelMarkup.map(markup => ({dataset: {nativePanel: attributes(markup)['data-native-panel']}, hidden: /\shidden(?:\s|>)/.test(markup)}));
  const group = {attrs: {}, setAttribute(name, value) { assert.equal(name, 'aria-label'); this.attrs[name] = value; }};
  const element = {
    querySelectorAll(selector) {
      if (selector === '[data-native-view]') return controls;
      if (selector === '[data-native-panel]') return panels;
      throw new Error(`Unexpected native query: ${selector}`);
    },
    querySelector(selector) { assert.equal(selector, '.native-switch'); return options.missingGroup ? null : group; }
  };
  const forbidden = name => () => { throw new Error(`Native switcher must not use ${name}`); };
  const window = {addEventListener(name, callback) { (handlers[name] ||= []).push(callback); }};
  if (!options.missingLocale) window.FollowshotLocale = {t: (zh, en) => language === 'en' ? en : zh};
  const context = {
    window,
    document: {getElementById(id) { queriedIds.push(id); assert.equal(id, 'native-duo'); return options.missingSection ? null : element; }},
    localStorage: new Proxy({}, {get: forbidden('localStorage')}),
    sessionStorage: new Proxy({}, {get: forbidden('sessionStorage')}),
    setTimeout: forbidden('timers'), setInterval: forbidden('timers'), requestAnimationFrame: forbidden('animation frames'),
    fetch: forbidden('network'), MutationObserver: forbidden('mutation observation')
  };
  vm.runInNewContext(source, context, {filename: 'native-duo.js'});
  return {
    controls, panels, group, handlers, queriedIds,
    click(name) { const control = controls.find(x => x.dataset.nativeView === name); assert.ok(control); control.handlers.click(); },
    language(next) { language = next; (handlers['followshot-language-change'] || []).forEach(callback => callback()); },
    snapshot() { return JSON.stringify({pressed: controls.map(x => x.attrs['aria-pressed']), hidden: panels.map(x => x.hidden)}); },
    selected() { return panels.filter(panel => !panel.hidden).map(panel => panel.dataset.nativePanel).join(','); }
  };
}
const native = createNative();
check(native.selected() === 'capture', 'Initialization leaves the authored capture view selected');
check(native.group.attrs['aria-label'] === '展开状态的功能页面', 'Chinese control group is localized on initialization');
check(native.controls.every(control => Object.keys(control.handlers).join(',') === 'click'), 'Views change only through real manual button activation');
native.click('plan');
check(native.selected() === 'plan' && native.controls.map(x => x.attrs['aria-pressed']).join(',') === 'false,true,false', 'Selecting plan updates visibility and pressed state together');
const selectedPlan = native.snapshot(); native.click('plan');
check(native.snapshot() === selectedPlan, 'Selecting the same view again is idempotent');
native.language('en');
check(native.group.attrs['aria-label'] === 'Functional views in the open posture', 'Language event updates the accessible group label');
check(native.snapshot() === selectedPlan, 'Switching to English does not reset the selected native view');
native.language('zh');
check(native.snapshot() === selectedPlan, 'Switching back to Chinese keeps the native selection');
native.click('editor');
check(native.selected() === 'editor' && native.controls.map(x => x.attrs['aria-pressed']).join(',') === 'false,false,true', 'Selecting the real editor hides both other main panels');
const selectedEditor = native.snapshot(); native.language('en'); native.language('zh');
check(native.snapshot() === selectedEditor, 'The editor remains selected through a language round trip');
native.click('plan');
for (const invalid of ['unknown', '', '__proto__', '<script>']) {
  const control = native.controls[0]; const previous = control.dataset.nativeView;
  control.dataset.nativeView = invalid; control.handlers.click(); control.dataset.nativeView = previous;
  check(native.snapshot() === selectedPlan, `Invalid native view is ignored without hiding valid evidence: ${JSON.stringify(invalid)}`);
}
native.click('capture');
check(native.selected() === 'capture' && native.controls.map(x => x.attrs['aria-pressed']).join(',') === 'true,false,false', 'Capture can be manually restored after a bilingual round trip');
for (let i = 0; i < 30; i++) native.click(['plan','editor','capture'][i % 3]);
check(native.selected() === 'capture' && native.panels.filter(x => !x.hidden).length === 1, 'Rapid repeated manual switches always leave exactly one main view visible');
check(Object.keys(native.handlers).join(',') === 'followshot-language-change', 'Native script listens only for localization, not app state, scroll, or timer events');
check(native.queriedIds.join(',') === 'native-duo', 'Native switcher never queries or mutates the interactive simulator');
const missing = createNative({missingSection: true});
check(Object.keys(missing.handlers).length === 0, 'Missing optional native section exits without page-side effects');
const noLocale = createNative({missingLocale: true}); noLocale.click('plan'); noLocale.language('en');
check(noLocale.selected() === 'plan' && noLocale.group.attrs['aria-label'] === '展开状态的功能页面', 'Missing optional locale module retains a usable Chinese manual switcher');
const noGroup = createNative({missingGroup: true}); noGroup.click('plan'); noGroup.language('en');
check(noGroup.selected() === 'plan', 'Missing optional group label does not break panel selection');
const english = createNative({language: 'en'});
check(english.selected() === 'capture' && english.group.attrs['aria-label'] === 'Functional views in the open posture', 'An English-first visit keeps the intended initial view and accessible label');
english.click('plan'); english.language('zh'); english.click('capture'); english.language('en');
check(english.selected() === 'capture' && english.controls.map(x => x.attrs['aria-pressed']).join(',') === 'true,false,false', 'English-first switching remains consistent through repeated language and view changes');
check(!/setTimeout|setInterval|requestAnimationFrame|localStorage|sessionStorage|fetch\s*\(|\.play\s*\(|\.pause\s*\(|followshot:locate|followshot:layout/.test(source), 'Native switching has no autoplay, persistence, media, network or demo-navigation behavior');
check(!/\.focus\s*\(|scrollTo\s*\(|scrollIntoView\s*\(|location\s*=|history\./.test(source), 'Choosing native evidence does not steal focus, navigate or move the page');

check(nativeAssets.length === 5 && new Set(nativeAssets.map(asset => asset.file)).size === 5, 'Verified native-asset manifest contains all five distinct source screenshots');
for (const asset of nativeAssets) {
  const bytes = fs.readFileSync(path.join(root, 'site/media/duo', asset.file));
  const img = images.find(image => image.src === `media/duo/${asset.file}`);
  check(bytes.length === asset.bytes && sha(bytes) === asset.sha256, `${asset.file}: exact bytes match the inspected source screenshot`);
  check(bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.toString('ascii', 12, 16) === 'IHDR', `${asset.file}: real PNG data, not a renamed placeholder`);
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  check(width === asset.width && height === asset.height, `${asset.file}: original source dimensions are preserved`);
  check(Number(img?.width) === width && Number(img?.height) === height, `${asset.file}: HTML intrinsic dimensions match the real screenshot`);
  const blocks = []; let ended = false;
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    assert.ok(offset + 12 + length <= bytes.length, `${asset.file}: truncated ${type} chunk`);
    if (type === 'IDAT') blocks.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
    if (type === 'IEND') { ended = true; assert.equal(offset, bytes.length); break; }
  }
  check(ended && blocks.length > 0, `${asset.file}: complete PNG image chunks and ending`);
  const channels = {0:1,2:3,4:2,6:4}[bytes[25]];
  assert.ok(channels && bytes[24] === 8 && bytes[28] === 0, `${asset.file}: expected standard non-interlaced eight-bit source PNG`);
  const pixels = zlib.inflateSync(Buffer.concat(blocks));
  const rowBytes = width * channels + 1;
  check(pixels.length === rowBytes * height, `${asset.file}: every image scanline decompresses without truncation`);
  check(Array.from({length:height}, (_,row) => pixels[row * rowBytes]).every(filter => filter <= 4), `${asset.file}: decoded scanlines have valid PNG filters`);
}

for (const [file, hash] of Object.entries(baseline.unchanged_runtime_sha256)) {
  check(sha(fs.readFileSync(path.join(root, file))) === hash, `Existing simulator, fitting and visual runtime remains byte-identical: ${file}`);
}
for (const [file, hash] of Object.entries(baseline.original_media_sha256)) {
  check(sha(fs.readFileSync(path.join(root, file))) === hash, `Original authorized media remains byte-identical: ${file}`);
}
check(sha(sectionById('why')) === baseline.why_section_sha256, 'Entire approved story section remains byte-identical');
check(sha(normalizeIphone(sectionById('demo'))) === baseline.demo_section_sha256, 'Interactive demo markup, guides, phone and tour remain byte-identical apart from the exact approved decorative status');
const nativeLink = /<link rel="stylesheet" href="native-duo\.css\?v=[^"\s]+">/g;
const nativeScript = /<script src="native-duo\.js\?v=[^"\s]+"><\/script>/g;
check((html.match(nativeLink) || []).length === 1 && (html.match(nativeScript) || []).length === 1, 'Exactly one locally versioned native stylesheet and script are added');
check(html.indexOf('src="native-duo.js') > html.indexOf('src="site-language.js'), 'Native switcher initializes after the shared language module');
const originalHTML = normalizeIphone(html).replace(section + '\n', '').replace(nativeLink, '').replace(nativeScript, '').replace(/(src="site-language\.js\?v=)[^"]+/g, '$1__LOCALE_RELEASE__');
check(sha(originalHTML) === baseline.html_without_native_sha256, 'All other HTML bytes are unchanged except the approved native resources, locale cache key, and exact iPhone status/style additions');
for (const [name, map] of [['copy', translations], ['attributes', altTranslations]]) {
  const original = baseline[`locale_${name}`];
  check(sha(JSON.stringify(original.keys.map(key => [key, map[key]]))) === original.sha256, `Every original ${name} translation remains identical`);
}
check(sha(locale.replace(/const (copy|attributes) = \{[\s\S]*?\n  \};/g, 'const $1 = {};')) === baseline.locale_logic_sha256, 'Language switching, user preferences and demo preservation logic are byte-identical');
console.log(`PASS ${count} native-showcase assertions`);
