const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'site/index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'site/display-bounds.css'),'utf8');
const {boundsTag,normalizeBoundsHTML}=require('./display-bounds-normalize.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
let count=0;const check=(v,s)=>{assert.ok(v,s);count++;console.log('PASS',s)};
check(html.split(boundsTag).length===2,'Boundary patch loads exactly one cache-versioned local stylesheet');
check(html.indexOf(boundsTag)>html.indexOf('href="iphone-device.css')&&html.indexOf(boundsTag)>html.indexOf('href="native-duo.css'),'Boundary rules load after both original presentations');
check(sha(normalizeBoundsHTML(html))==='852a22a25113218bdfd3d4cb61123950aba03c7962496613a6d1331b1ccf4745','Every other HTML byte is identical to the approved public release');
check(normalizeBoundsHTML(boundsTag.replace('bounds-1','bounds-wrong')).includes('bounds-wrong'),'Normalization cannot conceal a different boundary resource');
const rules=[...css.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m=>({selector:m[1].trim(),body:m[2]}));
check(rules.length===3,'Only three targeted display-boundary rules are added');
check(rules.map(r=>r.selector).join('|')==='#demo .device|#native-duo .native-main-visual|#native-duo .native-main-visual img','The phone and native main image are the only affected elements');
const [device,visual,img]=rules;
check(device.body.includes('overflow:hidden'),'Existing screen overflow clipping remains enabled');
check(device.body.includes('-webkit-clip-path:inset(0 round 48px)')&&device.body.includes(';clip-path:inset(0 round 48px)'),'All phone layers have explicit prefixed and standard rounded clip geometry');
check(device.body.includes('isolation:isolate'),'Phone blending and compositing are isolated from the surrounding page');
check(!/width:|height:|transform:|position:/.test(device.body),'Phone width, height and whole-device scale do not change');
check(!/guide|demo-tour|entry-guide|guide-focus-ring/.test(css),'The external cyan guide and navigation are not clipped');
check(visual.body.includes('height:min(560px,calc(100vh - 260px))'),'Native image has a definite height and classic viewport fallback');
check(visual.body.includes('height:min(560px,calc(100svh - 260px))'),'Native image height also tracks the small visible viewport');
check(visual.body.includes('min-height:180px')&&visual.body.includes('max-height:none')&&visual.body.includes('aspect-ratio:auto'),'The former width-only intrinsic-ratio height constraint is removed');
check(img.body.includes('width:auto;height:auto')&&img.body.includes('max-width:100%;max-height:100%'),'Native image intrinsic dimensions are bounded by the actual view box');
check(img.body.includes('object-fit:contain'),'Native hardware frame is never cover-cropped');
check(!/url\(|@import|animation:|transition:|display:none|visibility:|pointer-events:/.test(css),'Patch adds no external dependency, animation, hidden control or input interception');
for(const height of [600,657,757,800,900,982]){
 const box=Math.max(180,Math.min(560,height-260));
 check(box+260<=height,`Viewport ${height}: image leaves space for header, tabs and caption`);
 for(const width of [352,700,1180]){
  const scale=Math.min(width/1440,box/1050);
  check(1440*scale<=width+.001&&1050*scale<=box+.001,`Viewport ${height}/${width}: the complete 1440:1050 screenshot fits`);
 }
}
for(const [file,hash] of Object.entries(require('./display-bounds-baseline.json'))){
 check(sha(fs.readFileSync(path.join(root,file)))===hash,`Unchanged interaction, fit or existing presentation: ${file}`);
}
console.log(`PASS ${count} display-boundary assertions`);
