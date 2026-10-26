const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const APP_PATH = path.resolve(__dirname, '../site/app.js');
const STATE_KEY = 'followshot-demo-v1';
const LANGUAGE_KEY = 'followshot-language-v1';
const GUIDE_KEY = 'followshot-guide-v1';
// Deterministic VM state/markup checks, not a browser/layout test.

function createBrowser({storage = {}, language = storage[LANGUAGE_KEY] === 'en' ? 'en' : 'zh'} = {}) {
  const handlers = {};
  const timers = new Map();
  const elements = {};
  let sequence = 0;
  let currentLanguage = language;
  let now = 1000;
  const interactions = [];

  const element = () => ({
    innerHTML: '', textContent: '', style: {}, children: [], dataset: {},
    classList: {add() {}, remove() {}, toggle() {}},
    setAttribute() {}, focus() { interactions.push(['focus', this.selector || '']); }, scrollIntoView(options) { interactions.push(['scroll', this.selector || '', options]); }, setSelectionRange() {},
    querySelector(selector) { const result = element(); result.selector = selector; return result; },
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
    console, document, Event, Date: {now: () => now},
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
    handlers, timers, elements, storage, interactions,
    advance(ms) { now += ms; },
    replay() { elements['guide-replay'].onclick(); },
    escape() { handlers['document:keydown']({key:'Escape', preventDefault() {}}); },
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

function guide(browser, expected, message = expected) {
  includes(browser, `data-guide-step="${expected}"`, `guide follows ${message}`);
  check((browser.html().match(/class="step-guide"/g) || []).length === 1, `one guide only: ${message}`);
}
function noGuide(browser, message) { check(!browser.html().includes('class="step-guide"'), message); }
function stateData(browser) { return JSON.stringify(browser.state()); }
function start(browser) { browser.click('share'); browser.click('learn'); browser.click('use-preset'); browser.click('start-capture'); }
function record(browser, ticks = 80) { browser.click('record'); browser.tick(ticks); }

const browser = createBrowser();
guide(browser, 'share');
check(browser.interactions.filter(item => item[0] === 'scroll').length === 0, 'initial guide does not hijack scrolling');
browser.click('guide-locate');
check(browser.interactions.at(-1)[1] === '[data-action="share"]', 'locate scrolls to actual Share target');
const initialState = stateData(browser);
browser.click('guide-skip');
noGuide(browser, 'skip removes guide');
check(browser.storage[GUIDE_KEY] === 'off', 'skip preference persists separately');
check(stateData(browser) === initialState, 'skip does not change simulator state');
const skippedReload = createBrowser({storage: browser.storage});
noGuide(skippedReload, 'skip survives reload');
skippedReload.replay();
guide(skippedReload, 'share', 'replay current state');
check(skippedReload.storage[GUIDE_KEY] === 'on', 'replay preference is persisted');
check(skippedReload.interactions.at(-1)[1] === '[data-action="share"]', 'replay brings first required action into view');

browser.replay();
browser.click('share');
guide(browser, 'learn');
check(browser.html().indexOf('class="overlay"') < browser.html().indexOf('class="step-guide"'), 'modal guide resides inside overlay');
check(browser.html().indexOf('class="sheet"') < browser.html().indexOf('class="step-guide"'), 'modal guide resides inside sheet');
check(browser.interactions.filter(item => item[0] === 'focus').at(-1)[1] === 'button:not([data-action^="guide-"])', 'modal initially focuses a real action rather than guide');
browser.click('share');
check((browser.html().match(/class="overlay"/g) || []).length === 1, 'repeated Share does not duplicate modal');
browser.setLanguage('en');
guide(browser, 'learn', 'language change in share modal');
includes(browser, 'Choose Followshot to turn the reference', 'modal guide is translated');
browser.click('close-overlay');
guide(browser, 'share', 'cancel share');
browser.click('share');
browser.click('learn');
guide(browser, 'analyze');
browser.tick(3);
const analysisTimerCount = browser.timers.size;
browser.click('learn');
check(browser.timers.size === analysisTimerCount, 'double Learn does not restart or duplicate analysis');
check(browser.elements['analysis-progress'].style.width === '30%', 'analysis is still at current progress');
browser.setLanguage('zh');
guide(browser, 'analyze', 'Chinese during analysis');
includes(browser, '正在拆解参考', 'analysis guide translates to Chinese');
includes(browser, 'width:30%', 'language keeps analysis progress');
browser.click('cancel-analysis');
guide(browser, 'retry');
browser.setLanguage('en');
includes(browser, 'Analysis was cancelled. Retry', 'cancel guide translates');
browser.escape();
guide(browser, 'analyze', 'Escape after cancelled analysis');
browser.tick(10);
guide(browser, 'plan');
browser.go('feed');
guide(browser, 'share', 'Back from untouched plan');
browser.click('share'); browser.click('learn'); browser.click('use-preset');
browser.click('start-capture');
guide(browser, 'record', 'first shot');
check(browser.state().current === 0, 'first recording starts at first shot');
browser.click('record');
guide(browser, 'recording');
const recordingTimers = browser.timers.size;
browser.click('record');
check(browser.timers.size === recordingTimers, 'double Record does not create duplicate timer');
browser.setLanguage('zh');
guide(browser, 'recording', 'language while recording');
browser.tick(30);
guide(browser, 'take');
check(browser.state().takes[1].length === 1, 'double Record creates one Take');
browser.click('use-take');
guide(browser, 'record', 'second shot');
const afterUse = stateData(browser);
browser.click('use-take');
check(stateData(browser) === afterUse, 'repeated Use cannot select or skip another shot');
includes(browser, '已完成 1/4 镜', 'remaining-shot guide uses actual completion count');
browser.click('draft');
guide(browser, 'resume');
const draftBeforeReplay = stateData(browser);
browser.replay();
check(stateData(browser) === draftBeforeReplay, 'replay leaves draft and takes untouched');
guide(browser, 'resume', 'replay from partial draft');
const reloaded = createBrowser({storage: browser.storage, language: 'en'});
guide(reloaded, 'resume', 'partial draft reload');
reloaded.click('resume');
guide(reloaded, 'plan', 'resume partial plan');
reloaded.click('start-capture');
guide(reloaded, 'record', 'resume next incomplete shot');
check(reloaded.state().current === 1, 'partial resume continues second shot, not first');
check(reloaded.state().takes[1][0].selected, 'partial resume preserves first selected take');
for (let shot = 1; shot < 4; shot++) {
  record(reloaded);
  guide(reloaded, 'take', `review shot ${shot + 1}`);
  reloaded.click('use-take');
}
guide(reloaded, 'preview');
reloaded.handlers.input({target:{dataset:{},id:'film-title',value:'My own title'}});
const previewBefore = stateData(reloaded);
reloaded.click('guide-skip');
noGuide(reloaded, 'preview can skip guide');
reloaded.setLanguage('zh');
check(stateData(reloaded) === previewBefore, 'language while guide skipped preserves completed story');
reloaded.replay();
guide(reloaded, 'preview', 'replay starts at preview, not feed');
check(reloaded.state().title === 'My own title', 'replay preserves creator title');
reloaded.click('confirm-publish');
guide(reloaded, 'confirm');
check(reloaded.html().indexOf('class="sheet modal-inline"') < reloaded.html().indexOf('class="step-guide"'), 'confirmation guide remains inside modal');
reloaded.click('close-overlay');
guide(reloaded, 'preview', 'cancel publication');
reloaded.click('draft');
guide(reloaded, 'resume', 'complete draft');
const finishedReload = createBrowser({storage:reloaded.storage, language:'en'});
finishedReload.click('resume');
guide(finishedReload, 'preview', 'completed draft resumes preview');
finishedReload.click('confirm-publish'); finishedReload.click('publish');
guide(finishedReload, 'done');
const published = stateData(finishedReload);
finishedReload.click('publish');
check(stateData(finishedReload) === published, 'double Publish preserves success');
finishedReload.advance(600);
finishedReload.click('guide-skip');
noGuide(finishedReload, 'success guide can be dismissed');
finishedReload.replay();
guide(finishedReload, 'done', 'replay after success stays completed');
finishedReload.elements.reset.onclick();
guide(finishedReload, 'reset');
finishedReload.click('close-overlay');
guide(finishedReload, 'done', 'cancel reset restores completed guide');
check(finishedReload.state().title === 'My own title', 'cancel reset preserves creator input');
finishedReload.elements.reset.onclick(); finishedReload.click('reset-confirmed');
guide(finishedReload, 'share', 'confirmed reset restarts the guide with new state');
check(Object.keys(finishedReload.state().takes).length === 0, 'reset clears only demo takes');
const unselected = createBrowser({language:'en'});
start(unselected);
record(unselected, 30);
guide(unselected, 'take', 'unselected saved take');
unselected.click('draft');
const unselectedReload = createBrowser({storage:unselected.storage, language:'en'});
guide(unselectedReload, 'resume', 'draft with an unselected take');
unselectedReload.click('resume');
unselectedReload.click('start-capture');
guide(unselectedReload, 'review-existing', 'existing take is next needed action after restore');
includes(unselectedReload, 'This shot already has a take.', 'existing-take guide explains reuse rather than forced rerecord');
unselectedReload.click('guide-locate');
check(unselectedReload.interactions.at(-1)[1] === '[data-action="review"]', 'existing-take guide targets Review');
check(unselectedReload.state().takes[1].length === 1, 'restore does not duplicate saved unselected take');
unselectedReload.click('review');
guide(unselectedReload, 'take', 'review restored take');
unselectedReload.click('use-take');
check(unselectedReload.state().takes[1][0].selected, 'restored take can be selected without rerecording');
check(unselectedReload.state().current === 1, 'selecting restored take advances to next missing shot');
guide(unselectedReload, 'record', 'next missing shot after restored take');
const preserved = stateData(unselectedReload);
unselectedReload.click('reference');
guide(unselectedReload, 'reference', 'reference overlay');
unselectedReload.setLanguage('zh');
guide(unselectedReload, 'reference', 'reference overlay language switch');
unselectedReload.click('close-overlay');
guide(unselectedReload, 'record', 'close reference returns to required action');
check(stateData(unselectedReload) === preserved, 'reference and language do not change draft progress');
console.log(`ALL ${checks} GUIDE VM TESTS PASSED`);
