const {normalizeFooterHTML} = require('./footer-normalize.cjs');
const {normalizeHeroHTML, normalizeHeroLocale} = require('./hero-normalize.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const html = normalizeHeroHTML(normalizeFooterHTML(fs.readFileSync(path.join(root,'site/index.html'),'utf8')));
const css = fs.readFileSync(path.join(root,'site/story-section.css'),'utf8');
const locale = fs.readFileSync(path.join(root,'site/site-language.js'),'utf8');
const baseline = require('./story-baseline.json');
const tourBaseline = require('./tour-baseline.json');
const {normalizeIphone} = require('./iphone-normalize.cjs');
let count = 0;
const check=(value,label)=>{assert.ok(value,label);count++;console.log('PASS',label)};
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const section=html.match(/<section class="why section[\s\S]*?(?=<section class="demo-section")/)[0];
check((section.match(/<article class="story-pair"/g)||[]).length===3,'Exactly three paired stories replace the former text comparison');
check((section.match(/class="story-before|class="story-phase story-before/g)||[]).length===3,'Each story contains its own current friction');
check((section.match(/class="story-phase story-after/g)||[]).length===3,'Each story contains its own design goal');
check((section.match(/class="story-change"/g)||[]).length===3,'Three local arrows connect each problem to its goal');
check(!section.includes('story-disclaimer'),'Removed footnotes leave no empty wrapper or divider');
check(!/<button|<a\s|<input|<video/.test(section),'Static explanatory illustrations add no fake clickable controls or media behavior');
for(const id of ['story-section-title','story-understand-title','story-capture-title','story-finish-title']){
 check(section.includes(`aria-labelledby="${id}"`)&&section.includes(`id="${id}"`),`Accessible heading association: ${id}`);
}
const images=[...section.matchAll(/<img\b[^>]*>/g)].map(m=>m[0]);
check(images.length===14,'All fourteen storyboard image instances are real frame references');
for(const image of images){
 check(/src="media\/(?:shot[234]|poster)\.jpg"/.test(image),'Illustration references an original authorized JPEG, not a generated mockup');
 check(/alt=""/.test(image)&&/loading="lazy"/.test(image),'Repeated decorative frames are silent and lazy loaded');
}
for(const source of ['从反复看，到自己拍','看懂镜头','拍时有提示','讲完自己的故事','当前卡点','设计目标','反复回看，还是靠猜','看清结构，调整自己的计划','相机打开，却忘了怎么拍','一镜一提示，拍完逐个确认','拍完才发现，少了一个镜头','用自己的素材，把故事串完整','参考镜头<br>可调整','模拟拍摄','模拟成片']){
 check(locale.includes(JSON.stringify(source)+':'),`Bilingual editorial copy: ${source}`);
}
check(/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/.test(css),'Desktop uses three equal shrink-safe columns');
check(/@media\(max-width:760px\)[\s\S]*grid-template-columns:minmax\(0,1fr\)/.test(css),'Narrow layout keeps each complete pair in one column');
check(!/overflow-x:scroll|overflow-x:auto|position:fixed|animation:/.test(css),'Story cards add no horizontal carousel, pinned UI, or motion');
check(css.split('\n').filter(x=>x.trim()&&!/^\/\*|^@media/.test(x)).every(x=>x.startsWith('.story-section')),'New visual rules are scoped to the edited section');
for(const [file,hash] of Object.entries(tourBaseline.unchanged_runtime_sha256)) check(sha(fs.readFileSync(path.join(root,file)))===hash,`Unrelated motion and story styling remain byte-identical: ${file}`);
for(const file of ['site/site-motion.js','site/site-motion.css']) check(sha(fs.readFileSync(path.join(root,file)))===baseline.unchanged_runtime_sha256[file],`Original production motion hash is still preserved: ${file}`);
const originalStyle=fs.readFileSync(path.join(root,'site/style.css')).subarray(0,tourBaseline.style_prefix_bytes);
check(sha(originalStyle)===tourBaseline.style_prefix_sha256,'Existing style bytes are untouched before the bounded private tour additions');
// Remove only the separately approved native showcase and its two resources.
// Do not expand the old exclusion to arbitrary sections or replace its baseline.
const withoutNative=normalizeIphone(html)
 .replace(/<section class="native-section section" id="native-duo"[^>]*>[\s\S]*?<\/section>\n/,'')
 .replace(/<link rel="stylesheet" href="native-duo\.css\?v=[^"\s]+">/,'')
 .replace(/<script src="native-duo\.js\?v=[^"\s]+"><\/script>/,'');
const outside=withoutNative.replace(/<section class="why section[\s\S]*?(?=<section class="section" id="process">)/,'').replace(/((?:href|src)="[^":?#]+\.(?:css|js)\?v=)[^"]+/g,'$1__APPROVED_RELEASE__');
check(sha(outside)===tourBaseline.outside_why_demo_sha256,'HTML outside why and the approved demo edit is byte-identical apart from local CSS/script cache versions');
check(sha(section)===tourBaseline.why_section_sha256,'The previously approved three-story content remains byte-identical');
for(const source of ["设计方向：轻量 AI 在后台识别镜头切换，整理可编辑的镜头结构，让注意力留在创作上。","轻量 AI 分镜 · 设计方向"]) {
 check(section.includes(source),'The approved lightweight-AI concept remains visible native text');
 check(locale.includes(JSON.stringify(source)+':'),'New AI concept copy has an English translation');
}
check(section.includes('设计方向：')&&section.includes('轻量 AI 分镜 · 设计方向'),'The AI design-direction wording remains unchanged');
check(html.includes('四镜计划是人工预设')&&html.includes('没有接入 TikTok、AI 推理或真实摄像头'),'Existing Demo simulation notices and technical disclosure remain unchanged');
check(!/100%|毫秒|99[.％%]|1\.8M|7B/.test(section),'No unsupported accuracy, parameter-count or speed metrics');
for (const removed of ["设计假设，尚非验证结果。学习拍摄，不是复制内容。", "当前演示使用人工预设，未接入 AI 推理；准确率与端上速度待验证。", "A design hypothesis, not a validated result. Learn to film, not to copy.", "This demo uses manual presets, not AI inference. Accuracy and on-device speed still need validation."]) check(!section.includes(removed)&&!locale.includes(removed),'The two requested footnotes are removed in both languages');
console.log(`PASS ${count} story-section assertions`);
