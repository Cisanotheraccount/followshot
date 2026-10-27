// Only the explicitly approved hero sentence and its locale cache key.
const oldZh = '从一条灵感视频，拆出你能完成的拍摄步骤。';
const newZh = '从一条灵感视频，用AI拆出你能完成的拍摄步骤。';
const oldEn = 'Break an inspiring video into shots you can make.';
const newEn = 'Use AI to turn an inspiring video into filming steps you can follow.';
function normalizeHeroHTML(value) {
  return value.replace(newZh, oldZh).replace('site-language.js?v=20261027-ai-hero-1', 'site-language.js?v=20261027-duo-1');
}
function normalizeHeroLocale(value) { return value.replace(newZh, oldZh).replace(newEn, oldEn); }
module.exports = {oldZh, newZh, oldEn, newEn, normalizeHeroHTML, normalizeHeroLocale};
