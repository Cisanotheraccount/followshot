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
