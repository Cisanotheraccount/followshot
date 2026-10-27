/* Fit the complete portrait prototype, not only its internal scroll target. */
(() => {
  const stage = document.querySelector('.device-stage');
  const wrap = document.querySelector('.device-wrap');
  const device = document.querySelector('.device');
  const guide = document.getElementById('entry-guide');
  const header = document.querySelector('header');
  if (!stage || !wrap || !device) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let pending = false;
  let locate = false;
  function fit() {
    pending = false;
    const viewport = window.visualViewport;
    const height = viewport ? viewport.height : window.innerHeight;
    const headerHeight = header ? header.getBoundingClientRect().height : 0;
    const guideHeight = guide && !guide.hidden ? guide.getBoundingClientRect().height + 12 : 0;
    const availableWidth = Math.max(1, wrap.clientWidth);
    const availableHeight = Math.max(1, height - headerHeight - guideHeight - 32);
    const scale = Math.min(1, availableWidth / 390, availableHeight / 844);
    stage.style.width = (390 * scale) + 'px';
    stage.style.height = (844 * scale) + 'px';
    device.style.transform = 'scale(' + scale + ')';
    document.documentElement.style.setProperty('--demo-header-height', headerHeight + 'px');
    if (locate) {
      locate = false;
      const top = window.scrollY + wrap.getBoundingClientRect().top - headerHeight - 16;
      window.scrollTo({top: Math.max(0, top), behavior: reduced.matches ? 'auto' : 'smooth'});
    }
  }
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(fit);
  }
  function showDevice() { locate = true; schedule(); }
  document.querySelectorAll('a[href="#demo"]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    if (location.hash !== '#demo') history.replaceState(null, '', '#demo');
    showDevice();
  }));
  addEventListener('followshot:locate', showDevice);
  addEventListener('followshot:layout', schedule);
  addEventListener('resize', schedule);
  addEventListener('orientationchange', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(schedule);
    observer.observe(wrap);
    if (guide) observer.observe(guide);
    if (header) observer.observe(header);
  }
  document.fonts?.ready.then(schedule);
  if (location.hash === '#demo') locate = true;
  schedule();
})();
