const {normalizeBoundsHTML}=require('./display-bounds-normalize.cjs');
// Remove only the separately approved, precisely tested optional footer integration.
const fs=require('node:fs');
const path=require('node:path');
const privacy=fs.readFileSync(path.join(__dirname,'footer-disclosure.html'),'utf8').trimEnd();
const ids=['hero','film','why','demo','native-duo','process','design','closing'];
const resourceTags=[
  '<link rel="stylesheet" href="privacy.css?v=20261027-reading-1">',
  fs.readFileSync(path.join(__dirname,'optional-loader.html'),'utf8').trimEnd()
];
function normalizeFooterHTML(html){
  let value=normalizeBoundsHTML(html).replace(privacy,'');
  for(const tag of resourceTags)value=value.replace(tag,'');
  for(const id of ids)value=value.replace(' data-analytics-section="'+id+'"','');
  return value;
}
module.exports={normalizeFooterHTML,privacy,ids,resourceTags};
