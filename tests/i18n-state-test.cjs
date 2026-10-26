const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const APP_PATH = path.resolve(__dirname, '../site/app.js');
const STATE_KEY = 'followshot-demo-v1';
const LANGUAGE_KEY = 'followshot-language-v1';

function createBrowser({storage = {}, language = storage[LANGUAGE_KEY] === 'en' ? 'en' : 'zh'} = {}) {
  const handlers = {};
  const timers = new Map();
  const elements = {};
  let sequence = 0;
  let currentLanguage = language;

  const element = () => ({
    innerHTML: '', textContent: '', style: {}, children: [], dataset: {},
    classList: {add() {}, remove() {}, toggle() {}},
    setAttribute() {}, focus() {}, setSelectionRange() {},
    querySelector() { return element(); },
    querySelectorAll() { return []; },
    insertAdjacentHTML(_position, source) { this.innerHTML += source; this.lastElementChild = element(); },
    addEventListener(name, callback) { handlers[name] = callback; }
  });
  const document = {
    activeElement: null,
    getElementById(id) { return elements[id] ??= element(); },
    addEventListener(name, callback) { handlers[`document:${name}`] = callback; }
  };
  class Event { constructor(type) { this.type = type; } }
  const context = {
    console, document, Event,
    localStorage: {
      getItem(key) { return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null; },
      setItem(key, value) { storage[key] = String(value); }
    },
    matchMedia() { return {matches: false}; },
    setInterval(callback) { const id = ++sequence; timers.set(id, callback); return id; },
    clearInterval(id) { timers.delete(id); },
    setTimeout() {},
    addEventListener(name, callback) { handlers[`window:${name}`] = callback; },
    dispatchEvent(event) { handlers[`window:${event.type}`]?.(event); }
  };
  context.window = context;
  context.FollowshotLocale = {
    get language() { return currentLanguage; },
    t(zh, en) { return currentLanguage === 'en' ? en : zh; }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(APP_PATH, 'utf8'), context, {filename: APP_PATH});

  return {
    handlers, timers, elements, storage,
    html() { return elements.app.innerHTML; },
    state() { return JSON.parse(storage[STATE_KEY] || '{}'); },
    click(action, data = {}) {
      handlers.click({target: {closest: () => ({dataset: {action, ...data}, disabled: false})}});
    },
    go(screen) {
      handlers.click({target: {closest: () => ({dataset: {go: screen}, disabled: false})}});
    },
    tick(count) {
      for (let index = 0; index < count; index++) {
        for (const callback of [...timers.values()]) callback();
      }
    },
    setLanguage(next) {
      currentLanguage = next;
      storage[LANGUAGE_KEY] = next;
      context.dispatchEvent(new Event('followshot-language-change'));
    },
    language() { return currentLanguage; }
  };
}

let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks++;
  console.log('PASS', message);
}
function includes(browser, text, message) {
  check(browser.html().includes(text), `${message}: ${text}`);
}
function screenInBothLanguages(browser, chinese, english, name) {
  browser.setLanguage('zh');
  includes(browser, chinese, `${name} renders in Chinese`);
  browser.setLanguage('en');
  includes(browser, english, `${name} renders in English`);
  check(!browser.html().includes(chinese), `${name} replaces its Chinese UI label in English`);
}
function overlayInBothLanguages(browser, chinese, english, name) {
  const screen = browser.state().screen;
  browser.setLanguage('zh');
  includes(browser, chinese, `${name} overlay renders in Chinese`);
  browser.setLanguage('en');
  includes(browser, english, `${name} overlay renders in English`);
  check(browser.state().screen === screen, `${name} language event keeps the current screen`);
}

const browser = createBrowser();
screenInBothLanguages(browser, '创作者原创影像 · 授权演示', 'Original creator footage · Authorized demo', 'feed');
browser.click('share');
overlayInBothLanguages(browser, '分享至', 'Share to', 'share');
browser.setLanguage('zh');
includes(browser, '跟拍学习', 'share entry returns to Chinese');
browser.click('learn');

browser.tick(3);
const analysisTimers = browser.timers.size;
browser.setLanguage('zh');
includes(browser, '正在整理参考片段', 'analysis screen renders in Chinese');
includes(browser, 'width:30%', 'analysis progress survives Chinese rerender');
browser.setLanguage('en');
includes(browser, 'Preparing the reference windows', 'analysis screen renders in English');
includes(browser, 'width:30%', 'analysis progress survives English rerender');
check(browser.timers.size === analysisTimers, 'analysis language switch does not replace or cancel timers');
browser.click('cancel-analysis');
overlayInBothLanguages(browser, '分析已取消', 'Analysis cancelled', 'cancel-analysis');
browser.click('close-overlay');
check(browser.state().screen === 'analyze', 'closing cancelled analysis safely starts analysis again');
browser.click('cancel-analysis');
browser.click('use-preset');
check(browser.state().screen === 'plan', 'cancel flow can continue with the editable preset');

screenInBothLanguages(browser, '你的拍摄计划', 'Your shot plan', 'plan');
includes(browser, 'Capture the feeling', 'default shot title localizes in the plan');
includes(browser, 'Medium · Human moment', 'default shot type localizes in the plan');
includes(browser, 'Frame a natural interaction, keep the camera steady', 'default shot tip localizes in the plan');
browser.click('reference');
overlayInBothLanguages(browser, '原始参考 · 真实视频', 'Original reference · Real video', 'reference');
browser.click('close-overlay');
browser.elements.reset.onclick();
overlayInBothLanguages(browser, '重新开始这次演示？', 'Restart this demo?', 'reset');
browser.click('close-overlay');
check(browser.state().screen === 'plan', 'cancel reset preserves plan state');

browser.handlers.change({target: {dataset: {duration: '1'}, value: '-9'}});
check(browser.state().shots.find(shot => shot.id === 1).duration === 2, 'localized flow clamps duration to two seconds');
browser.handlers.change({target: {dataset: {duration: '1'}, value: '99'}});
check(browser.state().shots.find(shot => shot.id === 1).duration === 8, 'localized flow clamps duration to eight seconds');
browser.handlers.change({target: {dataset: {duration: '1'}, value: '3'}});
browser.click('move-up', {id: '2'});
check(browser.state().shots[0].id === 2, 'localized flow preserves shot reordering');
browser.click('move-up', {id: '1'});
browser.click('edit-tip', {id: '1'});
browser.handlers.input({target: {dataset: {tip: '1'}, value: '用户自定义提示 / Creator tip'}});
browser.click('finish-tip');
browser.setLanguage('en');
includes(browser, '用户自定义提示 / Creator tip', 'creator tip is not translated');
check(browser.state().shots[0].tipEdited === true, 'creator tip is marked as authored');

browser.click('start-capture');
screenInBothLanguages(browser, '模拟相机 · 不调用摄像头', 'Simulated camera · No camera access', 'capture');
includes(browser, 'Medium · Human moment', 'capture uses the localized default shot type');
browser.click('grid');
check(browser.html().includes('<div class="gridlines" hidden>'), 'grid can be hidden before recording');
browser.click('record');
browser.tick(7);
const recordingTimers = browser.timers.size;
const progressBeforeLanguageChange = Number.parseFloat(browser.elements['record-progress'].style.width);
check(progressBeforeLanguageChange > 0 && progressBeforeLanguageChange < 100, 'recording advances before language switch');
browser.setLanguage('zh');
check(browser.state().screen === 'capture', 'recording language switch keeps capture state');
check(browser.html().includes('<div class="gridlines" hidden>'), 'recording language switch keeps grid preference');
check(/id="record-progress" style="width:(?!0%)/.test(browser.html()), 'recording language switch keeps visible progress');
check(browser.timers.size === recordingTimers, 'recording language switch keeps the existing timer');
browser.setLanguage('en');
browser.tick(23);
check(browser.state().screen === 'review', 'recording continues to review after language switches');
screenInBothLanguages(browser, '选择你更喜欢的版本', 'Choose the version you prefer', 'review');

browser.click('retake');
browser.click('record');
browser.tick(30);
check(browser.state().takes[1].length === 2, 'retake keeps the earlier take');
browser.click('select-take', {index: '0'});
browser.setLanguage('zh');
check(/takechoice selected[^>]*data-index="0"/.test(browser.html()), 'language event keeps the selected take');
browser.setLanguage('en');
browser.click('use-take');
check(browser.state().takes[1][0].selected === true, 'choosing the earlier take persists it');

browser.click('reference');
overlayInBothLanguages(browser, '回到创作', 'Back to creating', 'capture reference');
check(browser.html().includes('<div class="gridlines" hidden>'), 'overlay language switch keeps the hidden grid state');
browser.click('close-overlay');
for (const duration of [30, 40, 30]) {
  browser.click('record');
  browser.tick(duration);
  browser.click('use-take');
}
check(browser.state().screen === 'preview', 'four selected takes reach preview');

screenInBothLanguages(browser, '预览与编辑', 'Preview and edit', 'preview');
const previewTimers = browser.timers.size;
browser.tick(2);
browser.setLanguage('zh');
includes(browser, '暂停模拟预览', 'preview remains playing in Chinese');
browser.setLanguage('en');
includes(browser, 'Pause simulated preview', 'preview remains playing in English');
check(browser.timers.size === previewTimers, 'preview language switch keeps the existing playback timer');
browser.tick(1);
browser.setLanguage('zh');
check(/class="active" data-action="preview-shot" data-index="1"/.test(browser.html()), 'preview elapsed time continues across language switches');
browser.click('play-preview');
const pausedTimers = browser.timers.size;
browser.setLanguage('en');
includes(browser, 'Play simulated preview', 'paused playback state survives language switch');
check(browser.timers.size === pausedTimers, 'paused preview does not restart playback on language change');

browser.handlers.input({target: {dataset: {}, id: 'film-title', value: '用户标题 / Creator title'}});
browser.handlers.change({target: {dataset: {}, id: 'caption-toggle', checked: false}});
browser.setLanguage('zh');
includes(browser, '用户标题 / Creator title', 'creator title survives Chinese toggle');
includes(browser, '字幕已关闭', 'caption state renders in Chinese');
browser.setLanguage('en');
includes(browser, '用户标题 / Creator title', 'creator title survives English toggle');
includes(browser, 'Captions are off', 'caption state renders in English');
check(browser.state().titleEdited === true, 'creator title is marked as authored');
browser.handlers.change({target: {dataset: {}, id: 'caption-toggle', checked: true}});

browser.click('confirm-publish');
overlayInBothLanguages(browser, '确认模拟发布？', 'Confirm simulated publishing?', 'publish confirmation');
browser.click('close-overlay');
check(browser.state().screen === 'preview', 'cancel publish keeps preview');
browser.click('draft');
check(browser.state().screen === 'feed' && browser.state().draft === true, 'draft saves and returns to feed');
includes(browser, 'Resume local draft', 'saved draft has an English resume entry');
browser.setLanguage('zh');
includes(browser, '继续本地草稿', 'saved draft has a Chinese resume entry');

const reloaded = createBrowser({storage: browser.storage, language: 'en'});
reloaded.click('resume');
check(reloaded.state().screen === 'preview', 'complete draft resumes preview after reload');
includes(reloaded, '用户标题 / Creator title', 'creator title survives reload');
reloaded.go('plan');
includes(reloaded, '用户自定义提示 / Creator tip', 'creator tip survives reload');
reloaded.click('start-capture');
check(reloaded.state().screen === 'preview', 'completed plan returns to preview');
reloaded.click('confirm-publish');
reloaded.click('publish');
const publishedState = JSON.stringify(reloaded.state());
reloaded.click('publish');
check(reloaded.state().screen === 'success' && JSON.stringify(reloaded.state()) === publishedState, 'duplicate publish action is ignored');
reloaded.click('back-feed');
check(reloaded.state().screen === 'success', 'rapid second tap cannot click through the completed screen');
screenInBothLanguages(reloaded, '你完成了一个故事。', 'You completed a story.', 'success');
includes(reloaded, '13s · Simulated story', 'completion metadata is fully translated');
check(!reloaded.html().includes('作品'), 'completion metadata has no leftover Chinese suffix');

reloaded.elements.reset.onclick();
overlayInBothLanguages(reloaded, '重新开始这次演示？', 'Restart this demo?', 'success reset');
reloaded.click('close-overlay');
check(reloaded.state().screen === 'success', 'closing reset from success preserves the published screen');
reloaded.elements.reset.onclick();
reloaded.setLanguage('en');
reloaded.click('reset-confirmed');
check(reloaded.language() === 'en' && reloaded.storage[LANGUAGE_KEY] === 'en', 'reset keeps the selected language preference');
includes(reloaded, 'Original creator footage · Authorized demo', 'reset feed stays in English');

const legacyDefaults = {
  screen: 'preview', current: 0, title: '属于我的手冲早晨', caption: true, draft: true,
  shots: [
    {id: 1, title: '先交代环境', type: '全景 · 固定机位', tip: '手机放稳，让桌面与窗边光线一起入镜。', duration: 3},
    {id: 2, title: '让细节说话', type: '特写 · 缓慢推进', tip: '靠近咖啡粉，让细节填满画面，缓慢向前。', duration: 3},
    {id: 3, title: '拍下关键动作', type: '近景 · 侧上方', tip: '从侧上方拍注水，保留开始到结束的完整动作。', duration: 4},
    {id: 4, title: '给故事一个结尾', type: '中景 · 轻微拉远', tip: '把咖啡杯放在画面中心，慢慢拉远收尾。', duration: 3}
  ],
  takes: {1: [{number: 1, selected: true}], 2: [{number: 1, selected: true}], 3: [{number: 1, selected: true}], 4: [{number: 1, selected: true}]}
};
const legacyStorage = {[STATE_KEY]: JSON.stringify(legacyDefaults), [LANGUAGE_KEY]: 'en'};
const legacy = createBrowser({storage: legacyStorage, language: 'en'});
legacy.click('resume');
includes(legacy, 'My graduation story', 'stored legacy default story title migrates and localizes');
includes(legacy, 'Capture the feeling', 'stored legacy default caption migrates and localizes');
legacy.go('plan');
includes(legacy, 'Medium · Human moment', 'stored legacy default shot fields migrate and localize');
legacy.setLanguage('zh');
includes(legacy, '留住人物情绪', 'migrated legacy defaults can switch back to Chinese');

// Updating the example must never rewrite text that a creator authored.
const explicitlyOwned = JSON.parse(JSON.stringify(legacyDefaults));
explicitlyOwned.titleEdited = true;
explicitlyOwned.shots.forEach(shot => { shot.titleEdited = true; shot.typeEdited = true; shot.tipEdited = true; });
const owned = createBrowser({storage:{[STATE_KEY]:JSON.stringify(explicitlyOwned)},language:'en'});
owned.click('resume');
includes(owned, '属于我的手冲早晨', 'explicitly authored legacy-looking story title is not migrated or translated');
owned.go('plan');
includes(owned, '先交代环境', 'explicitly authored legacy-looking shot title remains unchanged');
includes(owned, '手机放稳，让桌面与窗边光线一起入镜。', 'explicitly authored legacy-looking shot tip remains unchanged');
owned.setLanguage('zh'); owned.setLanguage('en');
check(owned.state().title === explicitlyOwned.title && owned.state().titleEdited === true, 'language toggles preserve authored legacy title and ownership flag');
check(owned.state().shots[0].tip === explicitlyOwned.shots[0].tip && owned.state().shots[0].tipEdited === true, 'language toggles preserve authored legacy tip and ownership flag');

const unflaggedAuthored = JSON.parse(JSON.stringify(legacyDefaults));
unflaggedAuthored.title = '用户旧标题 / My own title';
unflaggedAuthored.shots[0].title = '用户旧镜头 / My own shot';
unflaggedAuthored.shots[0].type = '用户旧景别 / My own framing';
unflaggedAuthored.shots[0].tip = '用户旧提示 / Keep <my> words';
const unflagged = createBrowser({storage:{[STATE_KEY]:JSON.stringify(unflaggedAuthored)},language:'en'});
unflagged.click('resume');
includes(unflagged, '用户旧标题 / My own title', 'unflagged custom legacy title is inferred as authored');
unflagged.go('plan');
includes(unflagged, '用户旧镜头 / My own shot', 'unflagged custom legacy shot title is inferred as authored');
includes(unflagged, '用户旧景别 / My own framing', 'unflagged custom legacy shot type is inferred as authored');
includes(unflagged, '用户旧提示 / Keep &lt;my&gt; words', 'unflagged custom legacy tip remains authored and HTML-escaped');
check(unflagged.state().shots[0].tipEdited === true, 'legacy custom tip ownership is explicitly retained after save');
unflagged.setLanguage('zh'); unflagged.setLanguage('en');
includes(unflagged, '用户旧提示 / Keep &lt;my&gt; words', 'legacy custom tip survives repeated language switching');

const malformed = {
  screen: 'preview', current: 99, title: 'bad', caption: true, draft: true,
  shots: [1, 1, 3, 4].map(id => ({id, title: 'x', type: 'x', tip: 'x', duration: 99})),
  takes: {1: [{number: -1, selected: true}]}
};
const malformedStorage = {[STATE_KEY]: JSON.stringify(malformed), [LANGUAGE_KEY]: 'en'};
const recovered = createBrowser({storage: malformedStorage, language: 'en'});
check(!recovered.html().includes('Resume local draft'), 'duplicate shot IDs reject the malformed draft safely');
recovered.click('share');
recovered.click('learn');
const recoveredIds = recovered.state().shots.map(shot => shot.id);
check(new Set(recoveredIds).size === 4 && recoveredIds.join(',') === '1,2,3,4', 'next save replaces malformed duplicate IDs with safe defaults');

const invalidJson = createBrowser({storage: {[STATE_KEY]: '{not valid JSON', [LANGUAGE_KEY]: 'en'}, language: 'en'});
includes(invalidJson, 'Original creator footage · Authorized demo', 'invalid stored JSON falls back safely');

console.log(`ALL ${checks} I18N/STATE VM TESTS PASSED`);
