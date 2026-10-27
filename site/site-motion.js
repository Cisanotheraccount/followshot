/* Decorative footage is muted, optional, and paused off-screen. */
(() => {
  'use strict';
  const video = document.getElementById('hero-video');
  const button = document.getElementById('motion-toggle');
  const feature = document.getElementById('feature-video');
  if (!video || !button) return;
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let requested = !preference.matches;
  let visible = false;
  let failed = false;
  const text = (zh, en) => window.FollowshotLocale?.t(zh, en) || zh;
  function label() {
    button.textContent = failed ? text('重新播放影像', 'Retry footage') : requested ? text('暂停影像', 'Pause motion') : text('播放影像', 'Play motion');
    button.setAttribute('aria-pressed', String(requested));
    video.setAttribute('aria-label', text('创作者原创视频，静音循环播放', 'Creator-owned video, muted looping playback'));
    feature?.setAttribute('aria-label', text('观看完整原创参考视频', 'Watch the full original reference video'));
  }
  function sync() {
    if (requested && visible && !document.hidden && (!feature || feature.paused)) {
      const source = video.querySelector('source');
      if (source?.dataset.src) { source.src = source.dataset.src; delete source.dataset.src; video.load(); }
      const promise = video.play();
      promise?.catch(() => { requested = false; label(); });
    } else video.pause();
    label();
  }
  button.addEventListener('click', () => { requested = !requested || failed; if (failed) video.load(); failed = false; sync(); });
  video.addEventListener('loadedmetadata', () => { const start = Number(video.dataset.start) || 0; if (start) video.currentTime = start; });
  video.addEventListener('timeupdate', () => { const end = Number(video.dataset.end); if (end && video.currentTime >= end) video.currentTime = Number(video.dataset.start) || 0; });
  video.addEventListener('error', () => { failed = true; requested = false; label(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }, {threshold:.12}).observe(video);
  else { visible = true; sync(); }
  preference.addEventListener?.('change', event => { if (event.matches) requested = false; sync(); });
  document.addEventListener('visibilitychange', sync);
  feature?.addEventListener('play', sync);
  feature?.addEventListener('pause', sync);
  feature?.addEventListener('ended', sync);
  window.addEventListener('followshot-language-change', label);
  label();
})();

/* Short editorial motion inspired by the public About page's stepped media.
   Progressive enhancement only: the simulator, its guide and its focus order
   are deliberately outside this controller. No pinning or scroll interception. */
(() => {
  'use strict';
  if (!document.querySelector || !window.requestAnimationFrame) return;
  const hero = document.querySelector('.hero');
  const featureHeading = document.querySelector('.feature-heading');
  const player = document.querySelector('.feature-player');
  const root = document.documentElement;
  if (!hero || !root) return;
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const button = document.getElementById('motion-toggle');
  const reveals = [];
  const clamp = value => Math.max(0, Math.min(1, value));
  let frame = 0;
  let paused = false;
  let observer;
  let lastHero = '';
  let lastFilm = '';

  const groups = [
    '.feature-heading > *',
    '.why > .eyebrow, .why .split > *',
    '#process > .eyebrow, #process > .section-title',
    '.storyboard > article',
    '.design > .eyebrow, .design > h2',
    '.design-grid > article',
    '.closing > .eyebrow, .closing > h2'
  ];
  groups.forEach(selector => {
    document.querySelectorAll(selector).forEach((node, index) => {
      node.classList.add('motion-reveal');
      node.style.setProperty('--reveal-delay', `${Math.min(index, 3) * 70}ms`);
      reveals.push(node);
    });
  });

  function reset() {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    hero.style.removeProperty('--hero-progress');
    player?.style.removeProperty('--film-progress');
    root.classList.remove('site-motion-ready');
    lastHero = lastFilm = '';
    reveals.forEach(node => node.classList.add('is-revealed'));
  }

  function update() {
    frame = 0;
    if (preference.matches || paused || document.hidden) return;
    // Read untransformed section geometry before writing any style values.
    const viewport = Math.max(window.innerHeight || 0, 1);
    const heroRect = hero.getBoundingClientRect();
    const headingRect = featureHeading?.getBoundingClientRect();
    const heroProgress = clamp((-heroRect.top + 80) / Math.max(heroRect.height * .72, 1)).toFixed(4);
    const filmProgress = headingRect ? clamp((viewport * .95 - headingRect.bottom) / (viewport * .72)).toFixed(4) : '1';
    if (heroProgress !== lastHero) {
      hero.style.setProperty('--hero-progress', heroProgress);
      lastHero = heroProgress;
    }
    if (player && filmProgress !== lastFilm) {
      player.style.setProperty('--film-progress', filmProgress);
      lastFilm = filmProgress;
    }
  }

  function schedule() {
    if (frame || preference.matches || paused || document.hidden) return;
    frame = window.requestAnimationFrame(update);
  }

  function configure() {
    if (preference.matches || paused) { reset(); return; }
    root.classList.add('site-motion-ready');
    schedule();
  }

  if ('IntersectionObserver' in window) {
    try {
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        });
      }, {threshold:.08, rootMargin:'0px 0px -24px 0px'});
      reveals.forEach(node => observer.observe(node));
    } catch (_) {
      reveals.forEach(node => node.classList.add('is-revealed'));
    }
  } else reveals.forEach(node => node.classList.add('is-revealed'));

  window.addEventListener('scroll', schedule, {passive:true});
  window.addEventListener('resize', schedule, {passive:true});
  window.addEventListener('pageshow', schedule);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && frame) { window.cancelAnimationFrame(frame); frame = 0; }
    else schedule();
  });
  if (preference.addEventListener) preference.addEventListener('change', configure);
  else preference.addListener?.(configure);
  // The existing controller updates this button first. An explicit pause also
  // stops decorative choreography, without changing playback or saved drafts.
  button?.addEventListener('click', () => {
    paused = button.getAttribute('aria-pressed') === 'false';
    configure();
  });
  configure();
})();
