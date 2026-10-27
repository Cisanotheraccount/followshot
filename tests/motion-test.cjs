'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../site/site-motion.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../site/site-motion.css'), 'utf8');
let checks = 0;
function check(value, label) { assert.ok(value, label); checks++; console.log('PASS', label); }

function node() {
  const events = new Map(), classes = new Set(), styles = new Map(), attributes = new Map();
  return {
    classList:{add(...names){names.forEach(name => classes.add(name));},remove(...names){names.forEach(name => classes.delete(name));},contains(name){return classes.has(name);}},
    style:{setProperty(name,value){styles.set(name,value);},removeProperty(name){styles.delete(name);},getPropertyValue(name){return styles.get(name)||'';}},
    addEventListener(name,fn,options){const list=events.get(name)||[];list.push({fn,options});events.set(name,list);},
    emit(name,value={}){(events.get(name)||[]).forEach(item=>item.fn(value));},
    listeners(name){return events.get(name)||[];},
    getAttribute(name){return attributes.get(name)||null;},
    setAttribute(name,value){attributes.set(name,String(value));},
    rect:{top:0,bottom:0,height:0},
    getBoundingClientRect(){return this.rect;}
  };
}

// These deterministic tests exercise scheduling and fallback logic, not actual
// animation smoothness or browser rendering. The final page is checked visually.
function setup({reduced=false,intersection=true,observerThrows=false,raf=true,heroExists=true}={}) {
  const hero=node(), heading=node(), player=node(), root=node(), button=node(), preference=node();
  hero.rect={top:112,bottom:812,height:700};
  heading.rect={top:1000,bottom:1300,height:300};
  preference.matches=reduced;
  button.setAttribute('aria-pressed','true');
  const groups=new Map(), groupSelectors=[];
  const document=node(), window=node(), frames=new Map();
  let serial=0, observer, cancelled=0;
  document.documentElement=root;document.hidden=false;
  document.getElementById=id=>id==='motion-toggle'?button:null;
  document.querySelector=selector=>({'.hero':heroExists?hero:null,'.feature-heading':heading,'.feature-player':player})[selector]||null;
  document.querySelectorAll=selector=>{groupSelectors.push(selector);const list=Array.from({length:selector==='.storyboard > article'?4:2},node);groups.set(selector,list);return list;};
  window.innerHeight=757;
  window.matchMedia=query=>{assert.equal(query,'(prefers-reduced-motion: reduce)');return preference;};
  if(raf) window.requestAnimationFrame=fn=>{const id=++serial;frames.set(id,fn);return id;};
  window.cancelAnimationFrame=id=>{cancelled++;frames.delete(id);};
  function IntersectionObserver(callback,options) {
    if(observerThrows) throw new Error('Unavailable observer');
    observer=this;this.options=options;this.callback=callback;this.observed=new Set();
    this.observe=target=>this.observed.add(target);this.unobserve=target=>this.observed.delete(target);
  }
  if(intersection)window.IntersectionObserver=IntersectionObserver;
  vm.runInNewContext(source,{document,window,IntersectionObserver,console},{filename:'site-motion.js'});
  return {hero,heading,player,root,button,preference,document,window,frames,groups,groupSelectors,
    get observer(){return observer;},get cancelled(){return cancelled;},
    all:()=>[...groups.values()].flat(),
    flush(){const work=[...frames.values()];frames.clear();work.forEach(fn=>fn());},
    reduce(value){preference.matches=value;preference.emit('change',{matches:value});}
  };
}

const normal=setup();
check(normal.root.classList.contains('site-motion-ready'),'Supported normal-motion mode progressively enables decorative choreography');
check(normal.frames.size===1,'Initial geometry schedules one animation frame');
check(normal.groupSelectors.every(selector=>!/#demo|#app|\.device|guide/.test(selector)),'No simulator or tutorial node is selected for animation');
check(normal.all().every(item=>item.classList.contains('motion-reveal')),'Only editorial groups receive reveal classes');
check(normal.groups.get('.storyboard > article').map(item=>item.style.getPropertyValue('--reveal-delay')).join(',')==='0ms,70ms,140ms,210ms','Four storyboard cards use bounded ordered delays');
check(normal.observer.options.threshold===.08,'Reveal threshold starts early enough to avoid late-arriving text');
normal.flush();
check(normal.hero.style.getPropertyValue('--hero-progress')==='0.0000','The initial hero begins in its regular composition');
check(normal.player.style.getPropertyValue('--film-progress')==='0.0000','Off-screen full-reference media starts at the small end of its bounded expansion');
normal.hero.rect={top:-280,bottom:420,height:700};normal.heading.rect={top:280,bottom:510,height:230};
normal.window.emit('scroll');normal.window.emit('scroll');normal.window.emit('resize');
check(normal.frames.size===1,'Repeated scroll and resize events coalesce into one frame');
normal.flush();
check(Number(normal.hero.style.getPropertyValue('--hero-progress'))>.7,'Hero progress follows natural page scroll');
check(Number(normal.player.style.getPropertyValue('--film-progress'))>0&&Number(normal.player.style.getPropertyValue('--film-progress'))<1,'Reference-player expansion tracks its heading entering the viewport');
check(normal.window.listeners('scroll')[0].options.passive===true,'Scrolling remains passive and is never intercepted');
normal.hero.rect={top:-50000,bottom:-49300,height:700};normal.heading.rect={top:-40000,bottom:-39000,height:1000};normal.window.emit('scroll');normal.flush();
check(normal.hero.style.getPropertyValue('--hero-progress')==='1.0000'&&normal.player.style.getPropertyValue('--film-progress')==='1.0000','Motion progress is clamped after sections leave the viewport');
const reveal=normal.all()[0];normal.observer.callback([{target:reveal,isIntersecting:false}]);
check(!reveal.classList.contains('is-revealed'),'Non-intersecting editorial content does not prematurely consume its entrance');
normal.observer.callback([{target:reveal,isIntersecting:true}]);
check(reveal.classList.contains('is-revealed')&&!normal.observer.observed.has(reveal),'An entered section is revealed once and unobserved');
normal.window.emit('scroll');normal.document.hidden=true;normal.document.emit('visibilitychange');
check(normal.frames.size===0&&normal.cancelled>0,'Hidden pages cancel pending decorative work');
normal.window.emit('scroll');check(normal.frames.size===0,'Hidden pages do not schedule new scroll work');
normal.document.hidden=false;normal.document.emit('visibilitychange');check(normal.frames.size===1,'Returning to a visible page schedules current geometry');normal.flush();
normal.reduce(true);
check(!normal.root.classList.contains('site-motion-ready'),'Changing to reduced motion removes enhancement immediately');
check(!normal.hero.style.getPropertyValue('--hero-progress')&&!normal.player.style.getPropertyValue('--film-progress'),'Reduced motion clears both decorative progress values');
check(normal.all().every(item=>item.classList.contains('is-revealed')),'Reduced motion reveals every editorial group immediately');
normal.window.emit('scroll');check(normal.frames.size===0,'Reduced motion does not run scroll animation frames');
normal.reduce(false);check(normal.frames.size===1&&normal.root.classList.contains('site-motion-ready'),'Normal-motion preference can be restored without reloading');normal.flush();
normal.button.setAttribute('aria-pressed','false');normal.button.emit('click');
check(!normal.root.classList.contains('site-motion-ready'),'Explicit Pause motion also stops decorative page movement');
normal.window.emit('scroll');check(normal.frames.size===0,'An explicit pause is not undone by scroll');
normal.button.setAttribute('aria-pressed','true');normal.button.emit('click');
check(normal.root.classList.contains('site-motion-ready')&&normal.frames.size===1,'Explicit Play can restore decorative movement');
normal.flush();normal.window.emit('pageshow');check(normal.frames.size===1,'Browser page restoration refreshes motion geometry');

const reduced=setup({reduced:true});
check(!reduced.root.classList.contains('site-motion-ready')&&reduced.frames.size===0,'Initial reduced-motion mode never starts animation');
check(reduced.all().every(item=>item.classList.contains('is-revealed')),'Initial reduced-motion mode exposes all sections');
reduced.button.emit('click');check(!reduced.root.classList.contains('site-motion-ready'),'Explicit footage playback does not override reduced decorative motion');
const noObserver=setup({intersection:false});
check(noObserver.all().every(item=>item.classList.contains('is-revealed')),'Missing IntersectionObserver keeps all editorial content visible');
const failedObserver=setup({observerThrows:true});
check(failedObserver.all().every(item=>item.classList.contains('is-revealed')),'Observer construction failure degrades to visible content');
check(setup({raf:false}).frames.size===0,'Missing requestAnimationFrame safely keeps the static page');
check(setup({heroExists:false}).frames.size===0,'Missing hero cannot affect the rest of the page');
check(!/\.device|#app\b|#demo\b|\.step-guide/.test(css),'Decorative CSS has no selectors affecting the simulator or guide');
check(/@media\(prefers-reduced-motion:reduce\)/.test(css)&&/animation:none!important/.test(css),'CSS also enforces reduced motion without relying solely on JavaScript');
check(!/position:\s*(?:fixed|sticky)|scroll-snap|scroll-behavior|pointer-events:\s*none/.test(css),'Motion adds no pinning, scroll hijacking, or disabled controls');
check(/\.motion-reveal\{opacity:1;transform:none\}/.test(css),'Base reveal content is visible without the enhancement class');
check(/\.hero-copy>\.eyebrow[^\n]*\.hero-copy>h1[^\n]*\.hero-copy>p/.test(css),'Hero entrance targets copy, not its interactive CTA');
check(!/\.hero-copy>\*\{animation:(?!none)/.test(css),'No blanket hero animation delays links or pause controls');
check(/scale\(calc\(\.88 \+ var\(--film-progress\) \* \.12\)\)/.test(css),'Full media uses a bounded visual expansion instead of layout-height animation');
check(/translate3d\(calc\(var\(--hero-progress\) \* -72px\)/.test(css),'Hero uses horizontal media choreography rather than fade alone');
check(/\.photo-small[^\n]*\* \.28/.test(css)&&/\.photo-large[^\n]*\* \.07/.test(css),'Stair-stepped cards expand at distinct rates');
check(/@media\(max-width:760px\)/.test(css)&&/\.site-motion-ready \.hero-copy\{transform:none;opacity:1\}/.test(css),'Narrow screens retain readable stationary hero copy');
check(/:focus-visible \.ui-arrow/.test(css),'Arrow feedback is available to keyboard focus as well as hover');
check(!/setInterval|setTimeout|scrollTo|scrollIntoView|preventDefault/.test(source.slice(source.indexOf('/* Short editorial motion'))),'Editorial motion neither runs an idle timer nor controls navigation scrolling');
console.log(`PASS ${checks} editorial-motion assertions`);
