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
  const targets = {};

  const element = () => ({
    innerHTML: '', textContent: '', style: {}, children: [], dataset: {}, attributes: {},
    classList: {
      values: new Set(),
      add(...names) { names.forEach(name => this.values.add(name)); },
      remove(...names) { names.forEach(name => this.values.delete(name)); },
      toggle(name, force) { const enabled = force === undefined ? !this.values.has(name) : force; enabled ? this.values.add(name) : this.values.delete(name); return enabled; },
      contains(name) { return this.values.has(name); }
    },
    setAttribute(name, value) { this.attributes[name] = String(value); }, focus() { interactions.push(['focus', this.selector || '']); }, scrollIntoView(options) { interactions.push(['scroll', this.selector || '', options]); }, setSelectionRange() {},
    querySelector(selector) {
      const result = element(); result.selector = selector;
      const action = selector.match(/^\[data-action="([^"]+)"\]$/)?.[1];
      if (action) {
        result.dataset.action = action;
        const markup = [...(elements.app?.innerHTML || '').matchAll(/<button\b([^>]*)>/g)].find(match => match[1].includes(`data-action="${action}"`));
        result.disabled = !markup || /\bdisabled(?:\s|=|$)/.test(markup[1]);
        result.click = () => { if (!result.disabled) { interactions.push(['click',selector]); handlers.click({target:{closest:()=>result}}); } };
      }
      targets[selector] = result; return result;
    },
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
    handlers, timers, elements, storage, interactions, targets,
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
function normalFeed(browser, name) {
  noGuide(browser, `${name} has no feature hint before entry`);
  check(!/data-action="(?:resume|guide-skip|guide-next|guide-locate)"|step-guide-message|data-guide-label/.test(browser.html()), `${name} has no direct draft or guide controls`);
  check(!browser.elements.app.classList.contains('guide-active') && !browser.elements.app.classList.contains('guide-on'), `${name} has no guided class that hides ordinary feed controls`);
  check(['like','save-reference','share','play-feed'].every(action => browser.html().includes(`data-action="${action}"`)), `${name} preserves ordinary video interactions`);
  check(!browser.html().includes('data-action="next-reference"'), `${name} does not expose reference shot stepping on the feed`);
  check(browser.html().includes('class="feednav"') && browser.html().includes('class="feedtop"'), `${name} preserves the normal feed navigation`);
}
function shareMenu(browser, name) {
  noGuide(browser, `${name} has no hint before the feature is chosen`);
  check(!browser.elements.app.classList.contains('guide-active') && !browser.elements.app.classList.contains('guide-on'), `${name} does not hide the ordinary sharing options`);
  check(browser.html().includes('class="share-row"') && browser.html().indexOf('class="share-row"') < browser.html().indexOf('data-action="learn"'), `${name} offers Followshot after ordinary sharing options`);
  check((browser.html().match(/data-action="learn"/g)||[]).length === 1, `${name} has one optional Followshot entry`);
  check(!/data-action="(?:resume|guide-skip|guide-next|guide-locate)"|data-guide-label/.test(browser.html()), `${name} has no competing guide or direct-resume control`);
}
function compactHint(browser, primary, name) {
  const hint = browser.html().match(/<section class="step-guide"[^>]*>[\s\S]*?<\/section>/)?.[0] || '';
  check(Boolean(hint), `${name} has its compact contextual hint`);
  check((hint.match(/<button\b/g)||[]).length===1 && hint.includes('data-action="guide-skip"'), `${name} hint only offers Skip, not a duplicate action`);
  check(!/data-action="guide-(?:next|locate)"|class="guide-next"|data-guide-label=/.test(browser.html()), `${name} has no extra Next, locator, or target badge markup`);
  const actions=[...browser.html().matchAll(/<button\b[^>]*data-action="([^"]+)"/g)].map(match=>match[1]);
  check(actions.filter(action=>action===primary).length===1, `${name} has exactly one real ${primary} control`);
}
function confirmationOnly(browser, confirmAction, name) {
  const modal=browser.html().slice(browser.html().lastIndexOf('<div class="overlay">'));
  check(modal.startsWith('<div class="overlay">'), `${name} is an actual modal`);
  noGuide(browser, `${name} has no competing guide panel`);
  const actions=[...modal.matchAll(/<button\b[^>]*data-action="([^"]+)"/g)].map(match=>match[1]);
  check(actions.length===2 && actions[0]==='close-overlay' && actions[1]===confirmAction, `${name} has only Cancel and explicit Confirm`);
  check(!/guide-next|guide-locate|guide-skip|data-guide-label|step-guide-message|Next step|下一步/.test(modal), `${name} has no helper buttons, badges, or duplicate Next text`);
}
function stateData(browser) { return JSON.stringify(browser.state()); }
function start(browser) { browser.click('share'); browser.click('learn'); browser.click('use-preset'); browser.click('start-capture'); }
function record(browser, ticks = 80) { browser.click('record'); browser.tick(ticks); }

const browser = createBrowser();
normalFeed(browser, 'initial reference feed');
check(browser.interactions.filter(item => item[0] === 'scroll').length === 0, 'initial feed does not hijack scrolling');
check(!browser.targets['[data-action="share"]'], 'initial Share is not marked as a feature-guide target');
const initialState = stateData(browser);
browser.replay();
normalFeed(browser, 'home after replay');
check(stateData(browser) === initialState, 'replay on home does not change simulator state');
check(!browser.html().includes('class="overlay"'), 'replay on home does not opt into Followshot or open Share');
browser.click('share');
shareMenu(browser, 'initial Share sheet');
check(browser.interactions.filter(item => item[0] === 'focus').at(-1)[1] === 'button:not([data-action^="guide-"])', 'modal initially focuses a real action rather than guide');
browser.click('share');
check((browser.html().match(/class="overlay"/g) || []).length === 1, 'repeated Share does not duplicate modal');
browser.setLanguage('en');
shareMenu(browser, 'English Share sheet');
includes(browser, 'Followshot', 'optional feature entry is translated');
browser.replay();
shareMenu(browser, 'Share sheet after replay');
check(browser.state().screen !== 'analyze', 'replay in Share does not enter the feature');
browser.click('close-overlay');
normalFeed(browser, 'cancelled Share sheet');
browser.click('share');
browser.click('learn');
guide(browser, 'analyze');
check(browser.storage[GUIDE_KEY] === 'on', 'choosing Followshot explicitly persists enabled guidance');
const analysisBeforeSkip = stateData(browser);
browser.click('guide-skip');
noGuide(browser, 'skip removes the opted-in feature hint');
check(browser.storage[GUIDE_KEY] === 'off', 'skip preference persists separately');
check(stateData(browser) === analysisBeforeSkip, 'skip does not change simulator state');
const skippedReload = createBrowser({storage: {...browser.storage}});
normalFeed(skippedReload, 'reload with tips off');
check(skippedReload.storage[GUIDE_KEY] === 'off', 'skip preference survives reload without entering the feature');
skippedReload.replay();
normalFeed(skippedReload, 'replayed home after tips-off reload');
browser.replay();
guide(browser, 'analyze', 'replay resumes the current opted-in state');
check(browser.storage[GUIDE_KEY] === 'on', 'replay inside the feature persists enabled tips');
check(browser.interactions.at(-1)[1] === '[data-action="use-preset"]', 'feature replay locates the actual current action');

// An old hidden-tip preference must not silently defeat a newly chosen feature session.
for (const language of ['zh', 'en']) {
  const optedOff = createBrowser({storage: {[GUIDE_KEY]:'off'}, language});
  normalFeed(optedOff, `${language} home with an old off preference`);
  const notEntered = stateData(optedOff);
  optedOff.click('learn');
  check(stateData(optedOff) === notEntered && optedOff.storage[GUIDE_KEY] === 'off' && optedOff.timers.size === 0, `${language} a stale Learn event outside Share cannot enter or enable guidance`);
  optedOff.click('share');
  shareMenu(optedOff, `${language} Share with an old off preference`);
  check(optedOff.storage[GUIDE_KEY] === 'off', `${language} opening Share alone does not opt into guidance`);
  optedOff.click('learn');
  guide(optedOff, 'analyze', `${language} explicit entry from old off preference`);
  check(optedOff.storage[GUIDE_KEY] === 'on', `${language} explicit entry overrides and saves the old off preference`);
  check(optedOff.state().screen === 'analyze' && optedOff.timers.size === 1, `${language} a new entry starts one preparation timer`);
}
browser.tick(3);
const analysisTimerCount = browser.timers.size;
browser.click('learn');
check(browser.timers.size === analysisTimerCount, 'double Learn does not restart or duplicate analysis');
check(browser.elements['analysis-progress'].style.width === '30%', 'analysis is still at current progress');
browser.setLanguage('zh');
guide(browser, 'analyze', 'Chinese during analysis');
includes(browser, '也可以直接使用四镜预设。', 'compact analysis hint translates to Chinese');
includes(browser, 'width:30%', 'language keeps analysis progress');
browser.click('cancel-analysis');
noGuide(browser, 'cancel-analysis modal does not duplicate its existing Retry and preset controls');
browser.setLanguage('en');
includes(browser, 'Analysis cancelled', 'cancel modal still translates without a helper panel');
browser.escape();
guide(browser, 'analyze', 'Escape after cancelled analysis');
browser.tick(10);
guide(browser, 'plan');
browser.go('feed');
normalFeed(browser, 'Back from untouched plan');
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
includes(browser, '1/4 完成', 'actual camera progress still shows the completion count');
browser.click('draft');
normalFeed(browser, 'home after saving a partial draft');
const draftBeforeReplay = stateData(browser);
browser.replay();
check(stateData(browser) === draftBeforeReplay, 'replay leaves draft and takes untouched');
normalFeed(browser, 'home after replay with a partial draft');
const reloaded = createBrowser({storage: {...browser.storage, [GUIDE_KEY]:'off'}, language: 'en'});
normalFeed(reloaded, 'partial draft reload');
const beforeDraftEntry = stateData(reloaded), beforeDraftResume = reloaded.html();
reloaded.click('resume');
check(stateData(reloaded) === beforeDraftEntry && reloaded.html() === beforeDraftResume, 'obsolete Resume cannot bypass Share from a saved-draft home');
reloaded.click('share');
shareMenu(reloaded, 'Share with a partial saved draft');
const beforeShareResume = reloaded.html();
reloaded.click('resume');
check(stateData(reloaded) === beforeDraftEntry && reloaded.html() === beforeShareResume && reloaded.storage[GUIDE_KEY] === 'off', 'obsolete Resume inside Share cannot bypass explicit Followshot entry');
check(stateData(reloaded) === beforeDraftEntry, 'opening Share does not alter the saved draft');
reloaded.click('learn');
check(reloaded.storage[GUIDE_KEY] === 'on', 'choosing Followshot resumes a draft with tips re-enabled');
check(reloaded.timers.size === 0, 'resuming a partial draft does not rerun reference preparation');
guide(reloaded, 'plan', 'resume partial plan');
check(/接着完成下一个镜头。|Continue with your next shot\./.test(reloaded.html()), 'partial restored plan points to the next shot, not the first');
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
confirmationOnly(reloaded, 'publish', 'publishing confirmation');
reloaded.click('close-overlay');
guide(reloaded, 'preview', 'cancel publication');
reloaded.click('draft');
normalFeed(reloaded, 'home with a complete saved draft');
const finishedReload = createBrowser({storage:{...reloaded.storage, [GUIDE_KEY]:'off'}, language:'en'});
normalFeed(finishedReload, 'complete draft reload');
finishedReload.replay();
normalFeed(finishedReload, 'home replay with a complete draft');
finishedReload.click('share');
shareMenu(finishedReload, 'Share with a complete draft');
finishedReload.click('learn');
check(finishedReload.storage[GUIDE_KEY] === 'on', 'completed-draft feature entry enables tips');
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
confirmationOnly(finishedReload, 'reset-confirmed', 'reset confirmation');
finishedReload.click('close-overlay');
guide(finishedReload, 'done', 'cancel reset restores completed guide');
check(finishedReload.state().title === 'My own title', 'cancel reset preserves creator input');
finishedReload.elements.reset.onclick(); finishedReload.click('reset-confirmed');
normalFeed(finishedReload, 'confirmed reset returns to normal reference feed');
check(Object.keys(finishedReload.state().takes).length === 0, 'reset clears only demo takes');
const unselected = createBrowser({language:'en'});
start(unselected);
record(unselected, 30);
guide(unselected, 'take', 'unselected saved take');
unselected.click('draft');
const unselectedReload = createBrowser({storage:unselected.storage, language:'en'});
normalFeed(unselectedReload, 'draft with an unselected take');
unselectedReload.click('share');
shareMenu(unselectedReload, 'Share with an unselected take');
unselectedReload.click('learn');
unselectedReload.click('start-capture');
guide(unselectedReload, 'review-existing', 'existing take is next needed action after restore');
includes(unselectedReload, 'A take is ready to review.', 'compact existing-take hint explains reuse rather than forced rerecord');
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
noGuide(unselectedReload, 'reference overlay has no redundant helper panel');
unselectedReload.setLanguage('zh');
noGuide(unselectedReload, 'reference overlay language switch does not add a helper panel');
unselectedReload.click('close-overlay');
guide(unselectedReload, 'record', 'close reference returns to required action');
check(stateData(unselectedReload) === preserved, 'reference and language do not change draft progress');
// Hints explain the real controls; they do not create a second navigation UI.
const guided=createBrowser({language:'en'});
normalFeed(guided,'reference feed');
const untouchedFeed=guided.html();
guided.click('resume');
check(guided.html()===untouchedFeed && guided.timers.size===0, 'obsolete Resume cannot create a feature session on a new home');
guided.click('guide-next',{guideAction:'share'});
check(guided.html()===untouchedFeed, 'obsolete shortcut clicks cannot open Share');
guided.click('share');shareMenu(guided,'share sheet');
guided.click('guide-next',{guideAction:'learn'});
check(guided.html().includes('class="overlay"') && !guided.html().includes('class="step-guide"'), 'obsolete shortcut clicks cannot leave the ordinary share sheet');
guided.click('learn');compactHint(guided,'use-preset','manual reference preparation');
check(guided.targets['[data-action="use-preset"]'].attributes['aria-describedby']==='step-guide-message', 'the opted-in real control remains linked to its hint');
check(guided.targets['[data-action="use-preset"]'].classList.contains('guide-target'), 'the actual opted-in control receives the subtle target treatment');
check(!Object.prototype.hasOwnProperty.call(guided.targets['[data-action="use-preset"]'].attributes,'data-guide-label'), 'the highlighted real control has no duplicate Next-step badge');
guided.click('use-preset');compactHint(guided,'start-capture','editable shot plan');
guided.click('start-capture');compactHint(guided,'record','first simulated camera');
check(Object.keys(guided.state().takes).length===0, 'preparing a shot never records one implicitly');
const beforeRecord=guided.html(),beforeRecordTimers=guided.timers.size;
guided.click('guide-next',{guideAction:'record'});
check(guided.html()===beforeRecord && guided.timers.size===beforeRecordTimers, 'obsolete shortcut cannot start simulated recording');
guided.click('record');compactHint(guided,'record','recording state');
check(/data-action="record"[^>]*disabled/.test(guided.html()), 'the sole Record control is disabled during recording');
const recordingTimerCount=guided.timers.size;
guided.click('guide-next',{guideAction:'record'});guided.click('record');
check(guided.timers.size===recordingTimerCount, 'repeated real or obsolete recording clicks cannot create duplicate timers');
guided.tick(30);compactHint(guided,'use-take','take review');
guided.click('use-take');compactHint(guided,'record','next simulated shot');
check(guided.state().takes[1].length===1 && guided.state().takes[1][0].selected, 'the real Use control selects the existing Take once');
for(const ticks of [30,40,30]){guided.click('record');guided.tick(ticks);guided.click('use-take');}
compactHint(guided,'confirm-publish','finished-story preview');
const previewState=stateData(guided);
guided.click('guide-next',{guideAction:'confirm-publish'});
check(stateData(guided)===previewState && !guided.html().includes('class="overlay"'), 'obsolete shortcut cannot open publishing confirmation');
guided.click('confirm-publish');confirmationOnly(guided,'publish','final publish modal');
guided.click('guide-next',{guideAction:'publish'});
check(stateData(guided)===previewState, 'obsolete shortcut cannot confirm publishing');
guided.replay();confirmationOnly(guided,'publish','replayed hint while final modal is open');
check(stateData(guided)===previewState, 'replaying the hint cannot publish or alter the draft');
guided.setLanguage('zh');confirmationOnly(guided,'publish','Chinese final publish modal');
includes(guided,'确认模拟发布？','final confirmation still localizes');
guided.setLanguage('en');guided.click('close-overlay');compactHint(guided,'confirm-publish','preview after cancelling publication');
guided.elements.reset.onclick();confirmationOnly(guided,'reset-confirmed','final reset modal');
guided.click('guide-next',{guideAction:'reset-confirmed'});
check(stateData(guided)===previewState, 'obsolete shortcut cannot reset the draft');
guided.replay();confirmationOnly(guided,'reset-confirmed','replayed hint while reset modal is open');
guided.click('close-overlay');
check(stateData(guided)===previewState, 'the real Cancel control preserves all completed takes');
guided.click('guide-skip');const skippedState=stateData(guided);
guided.click('guide-next',{guideAction:'confirm-publish'});
check(stateData(guided)===skippedState && !guided.html().includes('class="overlay"'), 'skipped guide ignores stale shortcut events');
guided.replay();guided.setLanguage('zh');compactHint(guided,'confirm-publish','replayed Chinese preview hint');
includes(guided,'准备好后，查看模拟完成说明。','compact hint localizes without losing the current step');

// Source-level geometry contracts complement, but never replace, real browser QA.
const css=fs.readFileSync(path.resolve(__dirname,'../site/style.css'),'utf8');
const geometry=css.slice(css.lastIndexOf('/* Ordinary portrait handset and quiet, target-adjacent hints. */'));
check(geometry.startsWith('/* Ordinary portrait handset'), 'the portrait handset geometry contract is present');
const desktop=geometry.match(/\.device\{([^}]*)\}/)?.[1]||'';
check(/width:390px(?:;|$)/.test(desktop)&&/height:844px!important/.test(desktop), 'desktop handset keeps 390×844 portrait dimensions instead of viewport-height squashing');
check(/aspect-ratio:390\/844/.test(desktop)&&/min-height:0!important/.test(desktop), 'desktop handset ratio is explicit without a fat-phone minimum-height override');
check(/\.device-wrap\{position:static!important\}/.test(geometry), 'handset container is not trapped in sticky positioning');
const mobile=geometry.match(/@media\(max-width:760px\)\{\.device\{([^}]*)\}/)?.[1]||'';
check(/width:min\(390px,100%\)/.test(mobile)&&/height:auto!important/.test(mobile)&&/aspect-ratio:390\/844/.test(mobile), 'mobile handset scales its height with the same portrait ratio');
check(/\.guide-target:after\{[^}]*display:none!important;[^}]*content:none!important/.test(geometry), 'duplicate target Next-step badges are suppressed');
check(/\.capture-idle>\.appfooter\{display:none\}/.test(geometry), 'empty camera review footer stays hidden before a Take exists');

const entryStyles=css.slice(css.lastIndexOf('/* Learning is opt-in through Share'));
check(/\.guide-target\{[^}]*box-shadow:inset 0 0 0 2px rgba\(255,255,255,\.85\)!important/.test(entryStyles), 'opted-in targets use an inset white edge rather than relying on a clipped outside outline');
check(/\.learn-entry\{[^}]*background:#f0f0f0;[^}]*border:1px solid #dedede/.test(entryStyles), 'the optional Share feature entry uses a neutral secondary surface');

console.log(`ALL ${checks} GUIDE VM TESTS PASSED`);
