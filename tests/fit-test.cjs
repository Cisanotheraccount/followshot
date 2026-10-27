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
    guideHeight: 70, guideVisible: true, tourHeight:74, tourVisible:true, hash: '', reduced: false,
    documentTop: 1800, resizeObserver: true, ...options
  };
  const handlers = {}, handlerOptions = {}, viewportHandlers = {}, appHandlers = {}, frames = [], scrolls = [], observed = [], replacements = [];
  let resizeCallback, fontCallback;
  const style = () => ({setProperty(key, value) { this[key] = value; }});
  const stage = {style:style(),getBoundingClientRect:()=>({left:100,top:160,width:parseFloat(stage.style.width)||390,height:parseFloat(stage.style.height)||844})}, device = {style:style()};
  const header = {getBoundingClientRect:() => ({height:config.headerHeight})};
  const guide = {hidden:!config.guideVisible,style:style(),getBoundingClientRect:() => ({height:config.guideHeight})};
  const tour = {hidden:!config.tourVisible,getBoundingClientRect:()=>({height:config.tourHeight})};
  const ring = config.withRing ? {style:style(),hidden:true} : null;
  const focusTarget = {classList:{contains:name=>name==='record'&&config.recordTarget},getBoundingClientRect:()=>{
    const scale=Number(device.style.transform?.match(/^scale\(([^)]+)\)$/)?.[1])||1;
    return {left:100+260*scale,top:160+(config.targetTop??600)*scale,width:76*scale,height:74*scale};
  }};
  const app={querySelector:selector=>selector==='.guide-target'&&config.withRing&&config.hasTarget!==false?focusTarget:null,addEventListener(name,callback){appHandlers[name]=callback;}};
  const links = [0,1].map(() => ({addEventListener(name, callback) { this[name] = callback; }}));
  const rootNode = {style:style()};
  const document = {
    documentElement:rootNode,
    querySelector(selector) { return ({'.device-stage':config.missingStage?null:stage,'.device-wrap':wrap,'.device':device,header})[selector] || null; },
    querySelectorAll(selector) { assert.equal(selector, 'a[href="#demo"]'); return links; },
    getElementById(id) { return ({'entry-guide':guide,'demo-tour':tour,'guide-focus-ring':ring,app})[id]||null; },
    fonts:{ready:{then(callback) { fontCallback = callback; }}}
  };
  const context = {
    console, document, innerWidth:config.width, innerHeight:config.height, scrollY:0,
    location:{hash:config.hash},
    history:{replaceState(_state, _unused, hash) { replacements.push(hash); context.location.hash = hash; }},
    matchMedia(query) { assert.equal(query, '(prefers-reduced-motion: reduce)'); return {get matches(){return config.reduced;}}; },
    addEventListener(name, callback, options) { handlers[name] = callback; handlerOptions[name] = options; },
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
    config, context, stage, device, guide, tour, ring, focusTarget, appHandlers, header, wrap, handlers, handlerOptions, frames, scrolls, observed, replacements, rootNode,
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
  ,['long English tour status', {width:400,height:606,wrapWidth:352,headerHeight:84,guideHeight:92,tourHeight:120}]
  ,['no optional tour', {width:1180,height:757,wrapWidth:420,headerHeight:76,tourVisible:false}]
];
for (const [name, options] of cases) {
  const test = createFit(options); test.flush();
  const guideSpace = test.guide.hidden ? 0 : test.config.guideHeight + 12;
  const tourSpace = test.tour.hidden ? 0 : test.config.tourHeight + 12;
  const availableHeight = (test.config.visualHeight ?? test.config.height)-test.config.headerHeight-guideSpace-tourSpace-32;
  close(test.width/test.height, 390/844, `${name}: rendered stage retains the ordinary portrait ratio`);
  close(test.width, 390*test.scale, `${name}: occupied stage width equals the visible transformed width`);
  close(test.height, 844*test.scale, `${name}: occupied stage height equals the visible transformed height`);
  check(test.height <= availableHeight+0.00001 && test.width <= test.config.wrapWidth+0.00001, `${name}: the complete stage fits both available dimensions`);
  check(test.scale > 0 && test.scale <= 1, `${name}: uniform scale is positive and never enlarges the prototype`);
  check(test.scrolls.length===0, `${name}: initial fitting does not hijack page scrolling`);
  test.event('followshot:locate'); test.flush();
  const viewportHeight = test.config.visualHeight ?? test.config.height;
  const top = test.config.documentTop-test.context.scrollY+guideSpace;
  check(top >= test.config.headerHeight+16-0.00001 && top+test.height+tourSpace <= viewportHeight-16+0.00001, `${name}: explicit locate keeps the complete phone and tour below navigation and above the viewport bottom`);
}

const events = createFit();
check(events.frames.length===1, 'startup schedules one fit frame');
events.event('resize'); events.event('orientationchange'); events.event('followshot:layout'); events.resizeObserved(); events.fontsReady();
check(events.frames.length===1, 'resize, layout, fonts, and observation changes coalesce into one animation frame');
events.flush();
check(events.observed.includes(events.wrap) && events.observed.includes(events.guide) && events.observed.includes(events.tour) && events.observed.includes(events.header), 'fitting observes available width, instruction, external tour, and sticky navigation geometry');
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

for(const height of [580,757,982]){
  const test=createFit({height,withRing:true});test.flush();
  const target=test.focusTarget.getBoundingClientRect(),origin=test.stage.getBoundingClientRect();
  check(!test.ring.hidden, `${height}px: a real guide target reveals the detached ring`);
  close(parseFloat(test.ring.style.left),target.left-origin.left-9,`${height}px: ring is positioned from the actual transformed target left`);
  close(parseFloat(test.ring.style.top),target.top-origin.top-9,`${height}px: ring is positioned from the actual transformed target top`);
  close(parseFloat(test.ring.style.width),target.width+18,`${height}px: three-pixel ring leaves a six-pixel horizontal gap at every scale`);
  close(parseFloat(test.ring.style.height),target.height+18,`${height}px: three-pixel ring leaves a six-pixel vertical gap at every scale`);
  check(!test.ring.style.transform,`${height}px: the detached ring itself is never scaled with the device`);
}
const ringScroll=createFit({withRing:true});ringScroll.flush();
const beforeRingTop=parseFloat(ringScroll.ring.style.top);
ringScroll.config.targetTop=500;ringScroll.appHandlers.scroll();ringScroll.flush();
check(parseFloat(ringScroll.ring.style.top)<beforeRingTop,'scrolling app content repositions the ring using current target geometry');
ringScroll.config.recordTarget=true;ringScroll.event('followshot:layout');ringScroll.flush();
check(ringScroll.ring.style.borderRadius==='50%','the real Record target receives a circular detached ring');
ringScroll.config.hasTarget=false;ringScroll.event('followshot:layout');ringScroll.flush();
check(ringScroll.ring.hidden,'modal or disabled guidance with no target hides the detached ring');
const tourResize=createFit();tourResize.flush();const beforeTourHeight=tourResize.height;
tourResize.config.tourHeight+=40;tourResize.resizeObserved();tourResize.flush();
close(tourResize.height,beforeTourHeight-40,'a taller translated external tour is deducted from the phone allocation');
check(/<\/div><span class="guide-focus-ring"|id="guide-focus-ring"/.test(html),'the guide ring has a dedicated DOM element rather than a CSS-only pseudo-element');

for(const movement of [-1200,1200]){
 const active=createFit({documentTop:2400});active.flush();
 active.context.scrollY=active.config.documentTop-active.config.headerHeight-16;active.event('scroll');
 active.config.documentTop+=movement;active.event('resize');active.flush();
 check(active.scrolls.length===1&&active.scrolls[0].behavior==='auto',`reflow ${movement}px: a previously visible demo is recovered even when pushed entirely offscreen`);
 close(active.config.documentTop-active.context.scrollY,active.config.headerHeight+16,`reflow ${movement}px: recovery restores the full wrapper below navigation`);
 const countBefore=active.scrolls.length;active.context.scrollY=0;active.event('scroll');active.config.documentTop+=200;active.event('resize');active.flush();
 check(active.scrolls.length===countBefore,`reflow ${movement}px: intentionally scrolling away clears visibility tracking and prevents hijacking`);
 check(active.handlerOptions.scroll?.passive===true,`reflow ${movement}px: viewport visibility is tracked with a passive scroll listener`);
}
const anchored=createFit({hash:'#demo',reduced:true});anchored.flush();anchored.context.scrollY=anchored.config.documentTop+300;anchored.event('load');anchored.flush();
check(anchored.scrolls.length===2&&anchored.scrolls.at(-1).behavior==='auto','the completed load restores a direct demo hash after a late browser anchor jump');
close(anchored.config.documentTop-anchored.context.scrollY,anchored.config.headerHeight+16,'load-time hash recovery includes the complete guide, phone and navigation');

console.log(`ALL ${checks} DEVICE FIT VM TESTS PASSED`);
