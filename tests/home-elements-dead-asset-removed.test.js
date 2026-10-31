const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const links=JSON.parse(fs.readFileSync(path.join(root,'server/json/links.json'),'utf8'));
for(const file of Object.values(links))assert(fs.existsSync(path.join(root,'assets/libs',file+'.min.js')),file);
console.log('All dynamic FLA links resolve to packaged runtime libraries');
