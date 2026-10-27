/* Manual view switcher only; screenshots do not operate the native app. */
(() => {
  'use strict';
  const section = document.getElementById('native-duo');
  if (!section) return;
  const controls = [...section.querySelectorAll('[data-native-view]')];
  const panels = [...section.querySelectorAll('[data-native-panel]')];
  const group = section.querySelector('.native-switch');
  const select = name => {
    if (!panels.some(panel => panel.dataset.nativePanel === name)) return;
    controls.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.nativeView === name)));
    panels.forEach(panel => { panel.hidden = panel.dataset.nativePanel !== name; });
  };
  controls.forEach(button => button.addEventListener('click', () => select(button.dataset.nativeView)));
  const localize = () => group?.setAttribute('aria-label', window.FollowshotLocale?.t('展开状态的功能页面', 'Functional views in the open posture') || '展开状态的功能页面');
  window.addEventListener('followshot-language-change', localize);
  localize();
})();
