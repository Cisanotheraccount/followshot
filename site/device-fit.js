/* Fit the complete portrait prototype, not only its internal scroll target. */
(() => {
  const stage = document.querySelector('.device-stage');
  const wrap = document.querySelector('.device-wrap');
  const device = document.querySelector('.device');
  const guide = document.getElementById('entry-guide');
  const header = document.querySelector('header');
  const tour = document.getElementById('demo-tour');
  const ring = document.getElementById('guide-focus-ring');
  const app = document.getElementById('app');
  if (!stage || !wrap || !device) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let pending = false;
  let locate = false;
  let layoutChanged = false;
  let previouslyVisible = false;
  function fit() {
    pending = false;
    const viewport = window.visualViewport;
    const height = viewport ? viewport.height : window.innerHeight;
    const headerHeight = header ? header.getBoundingClientRect().height : 0;
    const guideHeight = guide && !guide.hidden ? guide.getBoundingClientRect().height + 12 : 0;
    const tourHeight = tour && !tour.hidden ? tour.getBoundingClientRect().height + 12 : 0;
    const availableWidth = Math.max(1, wrap.clientWidth);
    const availableHeight = Math.max(1, height - headerHeight - guideHeight - tourHeight - 32);
    const scale = Math.min(1, availableWidth / 390, availableHeight / 844);
    stage.style.width = (390 * scale) + 'px';
    stage.style.height = (844 * scale) + 'px';
    device.style.transform = 'scale(' + scale + ')';
    positionGuideRing();
    document.documentElement.style.setProperty('--demo-header-height', headerHeight + 'px');
    const rect = wrap.getBoundingClientRect();
    const bottom = rect.top + guideHeight + 844 * scale + tourHeight;
    const partlyVisible = bottom > headerHeight && rect.top < height;
    const clipped = rect.top < headerHeight + 12 || bottom > height - 12;
    const recoverLayout = layoutChanged && (partlyVisible || previouslyVisible) && clipped;
    previouslyVisible = partlyVisible || recoverLayout;
    layoutChanged = false;
    if (locate || recoverLayout) {
      const explicit = locate;
      locate = false;
      const top = window.scrollY + wrap.getBoundingClientRect().top - headerHeight - 16;
      window.scrollTo({top: Math.max(0, top), behavior: !explicit || reduced.matches ? 'auto' : 'smooth'});
    }
  }
  function positionGuideRing() {
    if (!ring || !app) return;
    const target = app.querySelector('.guide-target');
    ring.hidden = !target;
    if (!target) return;
    const box = target.getBoundingClientRect();
    const origin = stage.getBoundingClientRect();
    // A separate, unscaled DOM border leaves a true six-pixel gap at every zoom.
    const inset = 9;
    ring.style.left = (box.left - origin.left - inset) + 'px';
    ring.style.top = (box.top - origin.top - inset) + 'px';
    ring.style.width = (box.width + inset * 2) + 'px';
    ring.style.height = (box.height + inset * 2) + 'px';
    ring.style.borderRadius = target.classList.contains('record') ? '50%' : '10px';
  }
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(fit);
  }
  function showDevice() { locate = true; schedule(); }
  function layout() { layoutChanged = true; schedule(); }
  document.querySelectorAll('a[href="#demo"]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    if (location.hash !== '#demo') history.replaceState(null, '', '#demo');
    showDevice();
  }));
  app?.addEventListener('scroll', schedule, true);
  addEventListener('followshot:locate', showDevice);
  addEventListener('followshot:layout', layout);
  addEventListener('followshot-language-change', layout);
  addEventListener('load', () => { if (location.hash === '#demo') showDevice(); else layout(); });
  addEventListener('scroll', () => {
    if (layoutChanged || locate) return;
    const box = wrap.getBoundingClientRect();
    const h = window.visualViewport?.height || window.innerHeight;
    previouslyVisible = box.top < h && box.top + stage.getBoundingClientRect().height > 0;
  }, {passive:true});
  addEventListener('resize', layout);
  addEventListener('orientationchange', layout);
  window.visualViewport?.addEventListener('resize', layout);
  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(layout);
    observer.observe(wrap);
    if (guide) observer.observe(guide);
    if (tour) observer.observe(tour);
    if (header) observer.observe(header);
  }
  document.fonts?.ready.then(layout);
  if (location.hash === '#demo') locate = true;
  schedule();
})();
