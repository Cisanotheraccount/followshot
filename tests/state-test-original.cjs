const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const APP_PATH = path.resolve(__dirname, '../site/app.js');
const STORAGE_KEY = 'followshot-demo-v1';

function createBrowser() {
  const handlers = {};
  const saved = {};
  const timers = new Map();
  let sequence = 0;
  let language = 'zh';
  const element = () => ({
    innerHTML: '', textContent: '', style: {}, children: [],
    classList: {add() {}, remove() {}, toggle() {}},
    setAttribute() {}, focus() {},
    querySelector() { return element(); },
    querySelectorAll() { return []; },
    insertAdjacentHTML(_position, source) { this.innerHTML += source; this.lastElementChild = element(); },
    addEventListener(name, callback) { handlers[name] = callback; }
  });
  const elements = {};
  const document = {
    activeElement: null,
    getElementById(id) { return elements[id] ??= element(); },
    addEventListener(name, callback) { handlers[`document:${name}`] = callback; }
  };
  class Event { constructor(type) { this.type = type; } }
  const context = {
    console, document, Event,
    localStorage: {
      getItem(key) { return Object.prototype.hasOwnProperty.call(saved, key) ? saved[key] : null; },
      setItem(key, value) { saved[key] = String(value); }
    },
    matchMedia() { return {matches: false}; },
    setInterval(callback) { const id = ++sequence; timers.set(id, callback); return id; },
    clearInterval(id) { timers.delete(id); },
    setTimeout() {},
    addEventListener(name, callback) { handlers[`window:${name}`] = callback; },
    dispatchEvent(event) { handlers[`window:${event.type}`]?.(event); }
  };
  context.window = context;
  context.FollowshotLocale = {get language() { return language; }, t: (zh, en) => language === 'en' ? en : zh};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(APP_PATH, 'utf8'), context, {filename: APP_PATH});
  return {
    handlers, elements, saved, timers,
    state: () => JSON.parse(saved[STORAGE_KEY] || '{}'),
    html: () => elements.app.innerHTML,
    click(action, data = {}) {
      handlers.click({target: {closest: () => ({dataset: {action, ...data}, disabled: false})}});
    },
    tick(count) {
      for (let index = 0; index < count; index++) {
        for (const callback of [...timers.values()]) callback();
      }
    }
  };
}

const browser = createBrowser();
const {handlers, elements, click, tick, state, html} = browser;
let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks++;
  console.log('PASS', message);
}

check(html().includes('分享'), 'feed entry');
click('share');
check(html().includes('跟拍学习'), 'share learning sheet');
click('learn');
check(state().screen === 'analyze', 'analysis');
click('cancel-analysis');
check(html().includes('分析已取消'), 'cancel analysis');
handlers['document:keydown']({key: 'Escape', preventDefault() {}});
check(state().screen === 'analyze', 'escape safely restarts cancelled analysis');
tick(10);
check(state().screen === 'plan', 'analysis completes');
handlers.change({target: {dataset: {duration: '1'}, value: '99'}});
check(state().shots[0].duration === 8, 'duration upper bound');
handlers.change({target: {dataset: {duration: '1'}, value: '-5'}});
check(state().shots[0].duration === 2, 'duration lower bound');
handlers.change({target: {dataset: {duration: '1'}, value: '3'}});
click('move-up', {id: '2'});
check(state().shots[0].id === 2, 'reorder');
click('move-up', {id: '1'});
click('edit-tip', {id: '1'});
handlers.input({target: {dataset: {tip: '1'}, value: '测试提示'}});
click('finish-tip');
check(state().shots[0].tip === '测试提示', 'edit prompt');
click('start-capture');
check(state().screen === 'capture' && html().includes('data-action="review" disabled'), 'next disabled before take');
click('record');
tick(30);
check(state().screen === 'review', 'record to review');
click('retake');
click('record');
tick(30);
check(state().takes[1].length === 2, 'retake preserves original');
click('select-take', {index: '0'});
click('use-take');
check(state().takes[1][0].selected && state().current === 1, 'select old take and next shot');
for (const duration of [30, 40, 30]) {
  click('record');
  tick(duration);
  click('use-take');
}
check(state().screen === 'preview', 'all four to preview');
handlers.input({target: {dataset: {}, id: 'film-title', value: '我的原创故事'}});
click('confirm-publish');
check(html().includes('确认模拟发布？'), 'explicit publish dialog');
click('close-overlay');
check(state().screen === 'preview', 'cancel publish retains preview');
click('draft');
check(state().screen === 'feed' && state().draft === true && !html().includes('data-action="resume"'), 'draft stored without a direct home Resume entry');
click('share');
check(html().includes('data-action="learn"'), 'saved draft remains reachable through the optional Share entry');
click('learn');
check(state().screen === 'preview' && state().title === '我的原创故事', 'resume intact');
click('confirm-publish');
click('publish');
click('publish');
check(state().screen === 'success', 'simulation publishes once and duplicate publish is harmless');
elements.reset.onclick();
check(html().includes('重新开始这次演示'), 'reset confirmation');
click('close-overlay');
check(state().screen === 'success', 'reset cancel preserves');
elements.reset.onclick();
click('reset-confirmed');
check(state().screen === 'feed' && Object.keys(state().takes).length === 0, 'reset only local demo');
console.log(`ALL ${checks} STATE TESTS PASSED`);
