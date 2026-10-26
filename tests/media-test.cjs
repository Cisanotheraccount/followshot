const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../site');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const source = fs.readFileSync(path.join(root, 'site-motion.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; console.log('PASS', message); };

function videoElement(id) {
  const match = [...html.matchAll(/<video\b([^>]*)>([\s\S]*?)<\/video>/g)].find(item => new RegExp(`\\bid="${id}"`).test(item[1]));
  assert(match, `Missing <video id="${id}">`);
  return {attributes: match[1], content: match[2]};
}

const hero = videoElement('hero-video');
const feature = videoElement('feature-video');
for (const attribute of ['muted', 'loop', 'playsinline']) check(new RegExp(`\\b${attribute}(?:\\s|=|$)`).test(hero.attributes), `Hero video has ${attribute}`);
check(/\bpreload="none"/.test(hero.attributes), 'Hero waits to load until its controller makes it visible');
check(/\bposter="media\/[^"#?]+\.jpg(?:\?[^"#]+)?"/.test(hero.attributes), 'Hero has a real JPEG poster fallback');
check(/\bdata-src="media\/[^"#?]+\.mp4(?:\?[^"#]+)?"/.test(hero.content), 'Hero uses a local, lazy MP4 source');
check(!/(?:^|\s)src=/.test(hero.content), 'Hero does not preload via an eager source attribute');
check(/\bcontrols(?:\s|=|$)/.test(feature.attributes), 'Full reference exposes native playback controls');
check(/\bplaysinline(?:\s|=|$)/.test(feature.attributes), 'Full reference plays inline on mobile');
check(!/\bautoplay(?:\s|=|$)/.test(feature.attributes), 'Full reference does not autoplay audible content');
check(/\bpreload="none"/.test(feature.attributes), 'Full reference does not eagerly fetch the full video');
check(/\bsrc="media\/[^"#?]+\.mp4(?:\?[^"#]+)?"/.test(feature.content), 'Full reference source is a local MP4');
check(/<button\b[^>]*\bid="motion-toggle"[^>]*\btype="button"/.test(html), 'Motion has an explicit interactive pause/play button');
check(!/咖啡|插画|self-made SVG|coffee-themed|original illustration/i.test(html), 'Published page no longer describes the real footage as coffee illustrations');
check(/与 TikTok \/ ByteDance 无隶属或背书关系/.test(html), 'Independent non-affiliation disclosure remains on the page');
check(/content:'Source footage · Simulated take'/.test(css), 'English take view visibly distinguishes source footage from a real recorded take');

function target() {
  const events = new Map();
  return {
    attributes: {}, textContent: '', paused: true,
    addEventListener(name, callback) { if (!events.has(name)) events.set(name, []); events.get(name).push(callback); },
    emit(name, detail = {}) { for (const callback of events.get(name) || []) callback(detail); },
    setAttribute(name, value) { this.attributes[name] = String(value); }
  };
}

// VM tests model media events and visibility deterministically. They are not
// evidence of browser decoding, video quality, or visual layout.
function createMotion({reduced = false, intersection = true, omitFeature = false, omitHero = false, omitButton = false, rejection = false, language = 'zh'} = {}) {
  const video = target(), button = target(), feature = target();
  const mediaSource = target(); mediaSource.dataset = {src:'media/reference.mp4'}; mediaSource.src = '';
  let playCalls = 0, pauseCalls = 0, loadCalls = 0, observerCallback, currentLanguage = language;
  let rejectPlayback = rejection;
  video.querySelector = selector => selector === 'source' ? mediaSource : null;
  video.load = () => { loadCalls++; };
  video.play = () => { playCalls++; if (rejectPlayback) return Promise.reject(new Error('Autoplay blocked')); video.paused = false; return Promise.resolve(); };
  video.pause = () => { pauseCalls++; video.paused = true; };
  const preference = target(); preference.matches = reduced;
  const document = target(); document.hidden = false;
  document.getElementById = id => ({'hero-video': omitHero ? null : video, 'motion-toggle': omitButton ? null : button, 'feature-video': omitFeature ? null : feature})[id] || null;
  const window = target();
  window.matchMedia = query => { assert.equal(query, '(prefers-reduced-motion: reduce)'); return preference; };
  window.FollowshotLocale = {t:(zh,en) => currentLanguage === 'en' ? en : zh};
  function IntersectionObserver(callback, options) { observerCallback = callback; this.observe = observed => { assert.equal(observed, video); }; assert(options.threshold > 0); }
  if (intersection) window.IntersectionObserver = IntersectionObserver;
  const context = {document, window, console, IntersectionObserver};
  vm.createContext(context); vm.runInContext(source, context, {filename:'site-motion.js'});
  return {
    video, button, feature, mediaSource, preference,
    get playCalls() { return playCalls; }, get pauseCalls() { return pauseCalls; }, get loadCalls() { return loadCalls; },
    visible(value) { assert(observerCallback, 'Expected a visibility observer'); observerCallback([{isIntersecting:value}]); },
    click() { button.emit('click'); },
    hidden(value) { document.hidden = value; document.emit('visibilitychange'); },
    reduced(value) { preference.matches = value; preference.emit('change', {matches:value}); },
    featurePlaying(value) { feature.paused = !value; feature.emit(value ? 'play' : 'pause'); },
    language(value) { currentLanguage = value; window.emit('followshot-language-change'); },
    reject(value) { rejectPlayback = value; }
  };
}

function createSimulatorMedia({reduced = false, language = 'en'} = {}) {
  const handlers = {}, elements = {}, timers = new Map(), storage = {};
  let sequence = 0, markup = '', videos = [], observer, locale = language;
  function element() {
    const node = target();
    Object.assign(node, {innerHTML:'',style:{},children:[],dataset:{},hidden:true,
      classList:{add(){},remove(){},toggle(){}},focus(){},scrollIntoView(){},setSelectionRange(){},
      querySelector(){return element();},querySelectorAll(){return []},
      insertAdjacentHTML(_position, value){this.innerHTML += value;this.lastElementChild=element();}
    });
    return node;
  }
  function parseVideos() {
    videos = [...markup.matchAll(/<video\b([^>]*)>/g)].map(match => {
      const video = element(), attrs = {};
      for (const item of match[1].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) attrs[item[1]] = item[2] ?? '';
      video.attributes = attrs;
      for (const [key,value] of Object.entries(attrs)) if (key.startsWith('data-')) video.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())] = value;
      video.currentTime = 0; video.duration = 38.033333; video.readyState = 1;
      video.playCalls = 0; video.pauseCalls = 0;
      video.play = () => {video.playCalls++;video.paused=false;return Promise.resolve();};
      video.pause = () => {video.pauseCalls++;video.paused=true;};
      return video;
    });
  }
  const app = element();
  Object.defineProperty(app, 'innerHTML', {get:()=>markup,set:value=>{markup=value;parseVideos();}});
  app.insertAdjacentHTML = (_position,value) => {markup+=value;parseVideos();app.lastElementChild=element();};
  app.addEventListener = (name,callback) => {handlers[name]=callback;};
  app.querySelectorAll = selector => selector === 'video[data-reference-video]' ? videos : [];
  app.querySelector = selector => elements[selector] ??= element();
  elements.app = app;
  const document = target(); document.hidden=false; document.activeElement=null;
  document.getElementById = id => ['feed-video','preview-video'].includes(id) ? videos.find(video=>video.attributes.id===id)||null : (elements[id]??=element());
  const context = {
    document, console, localStorage:{getItem:key=>storage[key]??null,setItem:(key,value)=>{storage[key]=String(value);}},
    matchMedia:()=>({matches:reduced}),
    setInterval(callback){const id=++sequence;timers.set(id,callback);return id;},clearInterval:id=>timers.delete(id),setTimeout(){},
    addEventListener(name,callback){handlers[`window:${name}`]=callback;},
    IntersectionObserver:class {constructor(callback){observer=callback;}observe(){}},
    FollowshotLocale:{get language(){return locale;},t:(zh,en)=>locale==='en'?en:zh}
  };
  context.window=context;vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8'),context,{filename:'app.js'});
  return {
    get html(){return markup;}, get videos(){return videos;}, elements, storage,
    video(role){return videos.find(video=>video.dataset.role===role);},
    click(action,data={}){handlers.click({target:{closest:()=>({dataset:{action,...data},disabled:false})}});},
    go(screen){handlers.click({target:{closest:()=>({dataset:{go:screen},disabled:false})}});},
    tick(count){for(let i=0;i<count;i++)for(const callback of [...timers.values()])callback();},
    visible(value){observer([{isIntersecting:value}]);},
    hidden(value){document.hidden=value;document.emit('visibilitychange');},
    language(value){locale=value;handlers['window:followshot-language-change']?.();}
  };
}

function simulatorMediaChecks() {
  const sim = createSimulatorMedia();
  let video = sim.video('feed');
  check(video?.attributes.src === 'media/reference-preview.mp4', 'Feed renders the real local compressed MP4, not an illustration slideshow');
  check(video.muted && !video.paused, 'Feed playback is muted and starts only as requested');
  check(video.dataset.end === '38.033333', 'Feed references the actual complete source duration');
  video.currentTime=12.3;video.emit('timeupdate');sim.language('zh');
  check(Math.abs(sim.video('feed').currentTime-12.3)<.001, 'Language switching preserves real reference playback position');
  check(sim.html.includes('创作者原创影像 · 授权演示'), 'Feed truthfully labels authorized real footage');
  sim.click('next-reference');
  check(sim.video('feed').currentTime===6 && sim.video('feed').paused, 'Next reference selects the second manual timestamp and pauses');
  sim.click('play-feed');sim.visible(false);
  check(sim.video('feed').paused, 'Off-screen simulator video is paused');
  sim.visible(true);check(!sim.video('feed').paused, 'Visible simulator resumes requested reference playback');
  sim.hidden(true);check(sim.video('feed').paused, 'Hidden document pauses simulator video');
  sim.hidden(false);check(!sim.video('feed').paused, 'Returning to the document resumes requested simulator video');
  sim.click('share');check(sim.video('feed').paused, 'Share sheet pauses underlying real footage');
  sim.click('learn');sim.click('use-preset');
  check(sim.html.includes('人工选定的四个片段') && !sim.html.includes('咖啡'), 'Plan shows the manually selected real-footage example without obsolete coffee copy');
  sim.click('reference');video=sim.video('reference');
  check(video?.attributes.controls!==undefined && video.paused, 'Reference overlay offers explicit native controls without forced autoplay');
  check(sim.html.includes('不是实时 AI 分析'), 'Reference overlay distinguishes manual windows from live AI analysis');
  sim.click('close-overlay');sim.click('start-capture');video=sim.video('capture');
  check(video?.dataset.start==='0' && video.dataset.end==='2.5' && video.paused, 'First simulated camera is cued to its real source window and waits for Record');
  check(sim.html.includes('模拟相机 · 不调用摄像头'), 'Real source playback does not disguise the simulated camera boundary');
  sim.click('record');video=sim.video('capture');check(!video.paused, 'Explicit simulated Record starts the reference-window playback');
  video.currentTime=2.5;video.emit('timeupdate');check(video.currentTime===0, 'Reference playback stays inside the selected window');
  sim.tick(30);video=sim.video('review');check(video?.attributes.controls!==undefined && video.paused, 'Take review offers controllable source footage, not fake new recording');
  check(sim.html.includes('模拟'), 'Review retains a visible simulation label');
  sim.click('use-take');
  check(sim.video('capture').currentTime===6 && sim.video('capture').dataset.end==='8', 'Next shot uses the second real timestamp window');
  for (const ticks of [30,40,30]) {sim.click('record');sim.tick(ticks);sim.click('use-take');}
  video=sim.video('preview');check(video?.dataset.start==='0' && !video.paused, 'Completed four-shot rehearsal starts real-source preview at the first window');
  sim.tick(3);video=sim.video('preview');
  check(video.currentTime===6 && Number(video.dataset.end)===8, 'Preview advances the actual video to the next source window');
  sim.click('preview-shot',{index:'3'});video=sim.video('preview');
  check(video.currentTime===33 && video.dataset.end==='35.5' && video.paused, 'Selecting a filmstrip frame cues and pauses its exact real source window');
  sim.click('confirm-publish');check(sim.video('preview').paused, 'Publish confirmation pauses underlying preview footage');
  check(sim.html.includes('不会')&&sim.html.includes('上传素材或公开发布'), 'Confirmation still states no upload or real publication');
  sim.click('close-overlay');sim.go('feed');sim.video('feed').currentTime=20;sim.video('feed').emit('timeupdate');
  sim.elements.reset.onclick();sim.click('reset-confirmed');
  check(sim.video('feed').currentTime===0, 'Restart resets real reference playback to the beginning');
  const reduced = createSimulatorMedia({reduced:true});
  check(reduced.video('feed').paused, 'Reduced-motion preference also disables simulator autoplay');
  reduced.click('play-feed');check(!reduced.video('feed').paused, 'Reduced motion permits explicit simulator Play');
  reduced.video('feed').emit('error');
  check(reduced.elements['.media-error'].hidden===false && reduced.elements['.media-error'].textContent.includes('unavailable'), 'Media failure exposes guidance without blocking the simulator');
}

(async () => {
  const motion = createMotion();
  check(motion.playCalls === 0 && motion.loadCalls === 0, 'Off-screen hero does not load or play at startup');
  motion.visible(true);
  check(motion.playCalls === 1 && motion.loadCalls === 1, 'Visible hero lazily loads and starts muted playback');
  check(motion.mediaSource.src === 'media/reference.mp4' && !('src' in motion.mediaSource.dataset), 'Lazy source is activated once');
  check(motion.button.attributes['aria-pressed'] === 'true' && motion.button.textContent === '暂停影像', 'Playing motion exposes its pressed state and pause label');
  motion.visible(false);
  check(motion.video.paused && motion.button.attributes['aria-pressed'] === 'true', 'Leaving the viewport pauses without discarding playback preference');
  motion.visible(true);
  check(!motion.video.paused && motion.loadCalls === 1, 'Re-entering resumes without reloading the source');
  motion.click();
  check(motion.video.paused && motion.button.textContent === '播放影像', 'Explicit pause stops the hero and offers Play');
  const pausedCalls = motion.playCalls;
  motion.visible(false); motion.visible(true);
  check(motion.playCalls === pausedCalls, 'Visibility changes do not undo an explicit pause');
  motion.click();
  check(!motion.video.paused, 'Explicit Play resumes the hero');
  motion.hidden(true);
  check(motion.video.paused, 'Backgrounding the document pauses the hero');
  motion.hidden(false);
  check(!motion.video.paused, 'Returning to the document resumes only requested motion');
  motion.featurePlaying(true);
  check(motion.video.paused, 'Playing the full reference pauses decorative hero motion');
  motion.featurePlaying(false);
  check(!motion.video.paused, 'Pausing the full reference allows requested hero motion');
  motion.language('en');
  check(motion.button.textContent === 'Pause motion', 'Language switching updates playback labels');
  check(motion.video.attributes['aria-label'].includes('muted') && motion.feature.attributes['aria-label'].includes('full original'), 'Both media descriptions are localized accessibly');
  motion.reduced(true);
  check(motion.video.paused && motion.button.attributes['aria-pressed'] === 'false', 'Turning on reduced motion stops automatic playback');
  motion.visible(false); motion.visible(true); motion.reduced(false);
  check(motion.video.paused, 'Reduced-motion preference change never silently restarts paused footage');
  motion.click();
  check(!motion.video.paused, 'User can explicitly play footage after reduced-motion pause');

  const reduced = createMotion({reduced:true}); reduced.visible(true);
  check(reduced.playCalls === 0 && reduced.loadCalls === 0, 'Reduced motion initially shows only the poster');
  reduced.click();
  check(reduced.playCalls === 1 && reduced.loadCalls === 1, 'Reduced motion still permits intentional playback');

  const blocked = createMotion({rejection:true}); blocked.visible(true); await Promise.resolve(); await Promise.resolve();
  check(blocked.button.attributes['aria-pressed'] === 'false' && blocked.button.textContent === '播放影像', 'Autoplay rejection leaves a truthful Play state');
  blocked.reject(false); blocked.click();
  check(!blocked.video.paused && blocked.button.attributes['aria-pressed'] === 'true', 'User can recover from autoplay rejection');
  blocked.video.emit('error');
  check(blocked.button.textContent === '重新播放影像' && blocked.button.attributes['aria-pressed'] === 'false', 'Media failure exposes a retry state');
  const beforeRetry = blocked.loadCalls; blocked.click();
  check(blocked.loadCalls === beforeRetry + 1 && !blocked.video.paused, 'Retry reloads media and attempts playback');

  const fallback = createMotion({intersection:false, omitFeature:true});
  check(fallback.playCalls === 1, 'Motion works without IntersectionObserver or the optional feature player');
  const reducedFallback = createMotion({intersection:false,reduced:true});
  check(reducedFallback.playCalls === 0, 'No-observer fallback still honors reduced motion');
  createMotion({omitHero:true}); createMotion({omitButton:true});
  check(true, 'Absent optional hero elements do not break other page scripts');
  simulatorMediaChecks();
  console.log(`PASS ${checks} real-media markup and motion assertions`);
})().catch(error => { console.error(error); process.exitCode = 1; });
