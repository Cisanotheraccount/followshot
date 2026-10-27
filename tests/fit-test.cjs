const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../site');
const source = fs.readFileSync(path.join(root, 'device-fit.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; console.log('PASS', message); }
function close(actual, expected, message) { check(Math.abs(actual - expected) < 0.00001, message); }

// This is deterministic geometry/event coverage. It does not claim browser
// rendering, font readability, media decoding, or Safari compatibility.
function createFit(options = {}) {
  const config = {
    width: 1180, height: 757, wrapWidth: 420, headerHeight: 76,
    guideHeight: 70, guideVisible: true, hash: '', reduced: false,
    documentTop: 1800, resizeObserver: true, ...options
  };
  const handlers = {}, viewportHandlers = {}, frames = [], scrolls = [], observed = [], replacements = [];
  let resizeCallback, fontCallback;
  const style = () => ({setProperty(key, value) { this[key] = value; }});
  const stage = {style:style()}, device = {style:style()};
  const header = {getBoundingClientRect:() => ({height:config.headerHeight})};
  const guide = {hidden:!config.guideVisible,style:style(),getBoundingClientRect:() => ({height:config.guideHeight})};
  const links = [0,1].map(() => ({addEventListener(name, callback) { this[name] = callback; }}));
  const rootNode = {style:style()};
  const document = {
    documentElement:rootNode,
    querySelector(selector) { return ({'.device-stage':config.missingStage?null:stage,'.device-wrap':wrap,'.device':device,header})[selector] || null; },
    querySelectorAll(selector) { assert.equal(selector, 'a[href="#demo"]'); return links; },
    getElementById(id) { assert.equal(id, 'entry-guide'); return guide; },
    fonts:{ready:{then(callback) { fontCallback = callback; }}}
  };
  const context = {
    console, document, innerWidth:config.width, innerHeight:config.height, scrollY:0,
    location:{hash:config.hash},
    history:{replaceState(_state, _unused, hash) { replacements.push(hash); context.location.hash = hash; }},
    matchMedia(query) { assert.equal(query, '(prefers-reduced-motion: reduce)'); return {get matches(){return config.reduced;}}; },
    addEventListener(name, callback) { handlers[name] = callback; },
    requestAnimationFrame(callback) { frames.push(callback); return frames.length; },
    scrollTo(value) { scrolls.push(value); context.scrollY = value.top; }
  };
  const wrap = {get clientWidth(){return config.wrapWidth;},getBoundingClientRect:() => ({top:config.documentTop-context.scrollY})};
  if (config.visualHeight !== undefined) context.visualViewport = {
    get height(){return config.visualHeight;},get width(){return config.visualWidth ?? config.width;},
    addEventListener(name, callback) { viewportHandlers[name] = callback; }
  };
  if (config.resizeObserver) context.ResizeObserver = class {
    constructor(callback) { resizeCallback = callback; }
    observe(target) { observed.push(target); }
  };
  context.window = context;
  vm.createContext(context); vm.runInContext(source, context, {filename:'device-fit.js'});
  return {
    config, context, stage, device, guide, header, wrap, handlers, frames, scrolls, observed, replacements, rootNode,
    flush() { let count=0; while(frames.length) { if (++count>20) throw Error('Unbounded fit scheduling'); frames.shift()(); } },
    event(name) { handlers[name]?.(); },
    viewportResize() { viewportHandlers.resize?.(); },
    resizeObserved() { resizeCallback?.(); },
    fontsReady() { fontCallback?.(); },
    click(index=0) { let prevented=false; links[index].click({preventDefault(){prevented=true;}}); return prevented; },
    get width(){return parseFloat(stage.style.width);},get height(){return parseFloat(stage.style.height);},
    get scale(){return Number(device.style.transform?.match(/^scale\(([^)]+)\)$/)?.[1]);}
  };
}

check(/<section class="entry-guide" id="entry-guide"[\s\S]*?<div class="device-stage"><div class="device">/.test(html), 'readable first instruction is outside and before the scaled device canvas');
check(/<script src="device-fit\.js\?[^\"]+"><\/script>/.test(html), 'the device fitter is loaded through a versioned script URL');
check(html.indexOf('src="device-fit.js?') < html.indexOf('src="app.js?'), 'device fit listeners are installed before the first simulator render');

const cases = [
  ['1180×757 desktop', {width:1180,height:757,wrapWidth:420,headerHeight:76}],
  ['1512×900 laptop browser', {width:1512,height:900,wrapWidth:420,headerHeight:112}],
  ['1512×982 tall laptop browser', {width:1512,height:982,wrapWidth:420,headerHeight:112}],
  ['1180×600 short browser', {width:1180,height:600,wrapWidth:420,headerHeight:76}],
  ['1180×580 very short browser', {width:1180,height:580,wrapWidth:420,headerHeight:76}],
  ['1180×800 browser', {width:1180,height:800,wrapWidth:420,headerHeight:76}],
  ['400×606 narrow zoomed browser', {width:400,height:606,wrapWidth:352,headerHeight:84,guideHeight:92}],
  ['400×800 narrow browser', {width:400,height:800,wrapWidth:352,headerHeight:84,guideHeight:92}],
  ['large browser without upscale', {width:1920,height:1200,wrapWidth:500,headerHeight:112}],
  ['visual viewport shorter than layout', {width:1180,height:900,wrapWidth:420,headerHeight:76,visualHeight:650}],
  ['no introductory guide', {width:1180,height:757,wrapWidth:420,headerHeight:76,guideVisible:false}]
];
for (const [name, options] of cases) {
  const test = createFit(options); test.flush();
  const guideSpace = test.guide.hidden ? 0 : test.config.guideHeight + 12;
  const availableHeight = (test.config.visualHeight ?? test.config.height)-test.config.headerHeight-guideSpace-32;
  close(test.width/test.height, 390/844, `${name}: rendered stage retains the ordinary portrait ratio`);
  close(test.width, 390*test.scale, `${name}: occupied stage width equals the visible transformed width`);
  close(test.height, 844*test.scale, `${name}: occupied stage height equals the visible transformed height`);
  check(test.height <= availableHeight+0.00001 && test.width <= test.config.wrapWidth+0.00001, `${name}: the complete stage fits both available dimensions`);
  check(test.scale > 0 && test.scale <= 1, `${name}: uniform scale is positive and never enlarges the prototype`);
  check(test.scrolls.length===0, `${name}: initial fitting does not hijack page scrolling`);
  test.event('followshot:locate'); test.flush();
  const viewportHeight = test.config.visualHeight ?? test.config.height;
  const top = test.config.documentTop-test.context.scrollY+guideSpace;
  check(top >= test.config.headerHeight+16-0.00001 && top+test.height <= viewportHeight-16+0.00001, `${name}: explicit locate keeps the complete phone below navigation and above the viewport bottom`);
}

const events = createFit();
check(events.frames.length===1, 'startup schedules one fit frame');
events.event('resize'); events.event('orientationchange'); events.event('followshot:layout'); events.resizeObserved(); events.fontsReady();
check(events.frames.length===1, 'resize, layout, fonts, and observation changes coalesce into one animation frame');
events.flush();
check(events.observed.includes(events.wrap) && events.observed.includes(events.guide) && events.observed.includes(events.header), 'fitting observes the available width, instruction, and sticky navigation geometry');
check(events.rootNode.style['--demo-header-height']==='76px', 'the measured header height updates the anchor-offset variable');
const withGuide = events.height;
events.guide.hidden=true; events.event('followshot:layout'); events.flush();
check(events.height > withGuide, 'entering a feature reuses the guide space without changing the handset ratio');
check(events.scrolls.length===0, 'ordinary guide/layout changes do not repeatedly recenter the prototype');
events.config.headerHeight=96; events.config.height=600; events.context.innerHeight=600; events.event('resize'); events.flush();
check(events.height<=600-96-32 && events.rootNode.style['--demo-header-height']==='96px', 'resizing recomputes both available height and sticky-navigation offset');
check(events.click(), 'prototype links prevent the competing native anchor jump'); events.flush();
check(events.replacements.length===1 && events.replacements[0]==='#demo', 'an explicit prototype link preserves its navigable demo hash');
check(events.scrolls.length===1 && events.scrolls[0].behavior==='smooth', 'normal explicit entry locates the whole wrapper once');
events.click(1); events.flush();
check(events.replacements.length===1, 'repeated prototype links do not repeatedly rewrite the same hash');
check(events.scrolls.length===2, 'repeated explicit entry remains usable without a duplicate in-flight scroll');

const reduced = createFit({hash:'#demo',reduced:true}); reduced.flush();
check(reduced.scrolls.length===1 && reduced.scrolls[0].behavior==='auto', 'direct demo hash uses an immediate whole-device location when reduced motion is enabled');
check(reduced.replacements.length===0, 'opening an existing demo hash does not rewrite browser history');
const viewport = createFit({visualHeight:700}); viewport.flush();
const previous = viewport.height;
viewport.config.visualHeight=600; viewport.viewportResize(); viewport.flush();
check(viewport.height < previous && viewport.scrolls.length===0, 'visual viewport resize updates fitting without unsolicited scroll');
const noObserver = createFit({resizeObserver:false}); noObserver.flush();
check(Number.isFinite(noObserver.scale), 'the explicit resize fallback still fits when ResizeObserver is absent');
const missing = createFit({missingStage:true}); missing.flush();
check(!missing.device.style.transform && missing.scrolls.length===0, 'missing optional prototype markup does not break other page scripts');
check(!/\.scrollIntoView\(/.test(source), 'the fitter never centers an inner Share or Record control independently');
check(!/localStorage|\.play\(|\.pause\(/.test(source), 'fitting has no draft-storage or media-playback side effects');

const clipped = createFit(); clipped.flush(); clipped.context.scrollY=1780;
clipped.event('followshot:layout'); clipped.flush();
check(clipped.scrolls.length===1 && clipped.scrolls[0].behavior==='auto', 'a changed partially visible layout recovers the whole phone without a smooth focus jump');
close(clipped.config.documentTop-clipped.context.scrollY, clipped.config.headerHeight+16, 'layout recovery restores the entire wrapper below sticky navigation');
clipped.event('followshot:layout'); clipped.flush();
check(clipped.scrolls.length===1, 'an already fitted visible layout is not repeatedly recentered');
const offscreen=createFit(); offscreen.flush(); offscreen.event('followshot:layout'); offscreen.flush();
check(offscreen.scrolls.length===0, 'background simulator renders do not pull a reader away from other sections');
check(fs.readFileSync(path.join(root,'style.css'),'utf8').includes('.demo-section{overflow-anchor:none}'), 'dynamic demo descendants cannot become browser scroll anchors');

for (const event of ['load','followshot-language-change','resize','orientationchange']) {
  const shifted=createFit(); shifted.flush(); shifted.context.scrollY=1692;
  shifted.event(event); shifted.flush();
  check(shifted.scrolls.length===1 && shifted.scrolls[0].behavior==='auto', `${event} corrects a visible frame pushed to the viewport edge by late layout`);
  close(shifted.config.documentTop-shifted.context.scrollY, shifted.config.headerHeight+16, `${event} leaves top and bottom breathing room`);
}

console.log(`ALL ${checks} DEVICE FIT VM TESTS PASSED`);
