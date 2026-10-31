// Read-only reachability audit. Unknown references remain candidates, never auto-deleted.
const fs = require('node:fs');
const path = require('node:path');
const acorn = require('../_client/node_modules/acorn');
const root = path.resolve(process.argv[2] || path.join(__dirname,'..'));
const runtime = path.resolve(process.argv[3] || path.join(root,'assets'));
const output = path.resolve(process.argv[4] || path.join(root,'_client/development/asset-audit.json'));
const walkFiles = dir => fs.existsSync(dir) ? fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory() ? walkFiles(path.join(dir,e.name)) : [path.join(dir,e.name)]) : [];
const dynamicStems = new Set();
const literals = new Set(), patterns = [], imports = new Map(), parseErrors = [];
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function pieces(n) {
  if (!n) return [null];
  if (n.type === 'Literal' && typeof n.value === 'string') return [n.value];
  if (n.type === 'BinaryExpression' && n.operator === '+') return [...pieces(n.left),...pieces(n.right)];
  if (n.type === 'TemplateLiteral') return n.quasis.flatMap((q,i) => i<n.expressions.length ? [q.value.cooked,null] : [q.value.cooked]);
  return [null];
}
function parse(file) {
  const text = fs.readFileSync(file,'utf8'); let ast;
  try { ast=acorn.parse(text,{ecmaVersion:'latest',sourceType:'module',allowReturnOutsideFunction:true}); }
  catch(e) {parseErrors.push({file,error:e.message});return;}
  const deps=[];
  function visit(n) {
    if(!n || typeof n !== 'object')return;
    if(n.type==='Literal' && typeof n.value==='string')literals.add(n.value);
    if(n.type==='Property' && n.value && n.value.type==='Literal' && typeof n.value.value==='string'){
      const key=n.key.name || n.key.value;
      if(['file','img','image','texture'].includes(key) || (key==='key' && n.value.value.startsWith('boss_'))) dynamicStems.add(n.value.value);
    }
    if(n.type==='TemplateElement' && n.value.cooked)literals.add(n.value.cooked);
    if(n.type==='ImportDeclaration' || n.type==='ExportNamedDeclaration' || n.type==='ExportAllDeclaration') {
      if(n.source && n.source.value.startsWith('.'))deps.push(path.resolve(path.dirname(file),n.source.value));
    }
    if(n.type==='BinaryExpression' || n.type==='TemplateLiteral') {
      const parts=pieces(n), fixed=parts.filter(x=>x!==null).join('');
      if(parts.includes(null) && (/(?:images|sounds|libs|spine)\//.test(fixed) || /\.(?:png|webp|mp3|atlas|json|ttf)$/i.test(fixed))) {
        const pattern=parts.map(x=>x===null?'[^?]*':escape(x)).join('');
        // A generic loader such as images/+file is not proof every image is used.
        const suffix=fixed.replace(/^.*?(?:images|sounds|libs|spine)\//,'');
        if(suffix.replace(/\.[a-z0-9]+$/i,'').trim().length>2)patterns.push(new RegExp('^'+pattern+'$'));
      }
    }
    for(const value of Object.values(n))if(Array.isArray(value))value.forEach(visit);else if(value && typeof value==='object')visit(value);
  }
  visit(ast); imports.set(file,deps);
}
const sourceFiles=walkFiles(path.join(root,'_client/src')).filter(f=>f.endsWith('.js'));
sourceFiles.forEach(parse);
walkFiles(path.join(runtime,'libs')).filter(f=>f.endsWith('.js')).forEach(parse);
for(const file of [...walkFiles(path.join(root,'server/json')), ...walkFiles(runtime)].filter(f=>f.endsWith('.json'))) {
  try { const values=n=>{if(typeof n==='string')literals.add(n);else if(n && typeof n==='object')Object.values(n).forEach(values);};values(JSON.parse(fs.readFileSync(file,'utf8'))); }catch(e){parseErrors.push({file,error:e.message});}
}
const textFiles=[path.join(root,'_client/development/index.html'),...walkFiles(runtime).filter(f=>/\.(css|atlas)$/.test(f))];
const extra=textFiles.map(f=>fs.readFileSync(f,'utf8')).join('\n');
const strings=[...literals];
const used=[],candidates=[];
for(const file of walkFiles(runtime)) {
 const rel=path.relative(runtime,file).split(path.sep).join('/'), name=path.basename(file);
 if(!['images','sounds','fonts','spine','libs','server-images'].includes(rel.split('/')[0]))continue;
 let size;
 try {size=fs.statSync(file).size;}catch(e){candidates.push({path:rel,bytes:0,reason:'invalid or nonportable filename'});continue;}
 let reason='';
 if(/\.(bak|pending)$|\.map\.|(?:^|\/)temp_/.test(rel)) {
   candidates.push({path:rel,bytes:size,reason:'backup or temporary runtime artifact'});continue;
 }
 if(rel.startsWith('server-images/'))reason='server payment icon';
 else if(rel.startsWith('libs/') && rel.endsWith('.js'))reason='runtime-library: verify HTML/dynamic loader before pruning';
 else if(/^images\/покер масть (пики|крести|буби|черви)\//.test(rel)) {
   const suit=rel.split('/')[1].replace('покер масть ', '');
   if(new RegExp('^(?:[2-6] '+suit+'|[789]|10|[JQKA])\\.png(?:\\.webp)?$').test(name))reason='enumerated dynamic poker deck';
 }
 else if((()=>{const stem=name.replace(/\.(?:png|jpe?g|webp)(?:\.webp)?$/i,'');const base=stem.replace(/ hover$/,'');return base.length>=3 && (dynamicStems.has(stem)||dynamicStems.has(base));})())reason='dynamic extension from literal stem'; else if(strings.some(s=>s===name || s.includes(rel) || s.includes('/'+name)))reason='literal reference';
 else if(extra.includes(name) || extra.includes(rel))reason='HTML/CSS/atlas reference';
 else if(patterns.some(p=>p.test('./'+rel)||p.test(rel)||p.test(name)))reason='dynamic path pattern';
 else if(rel.endsWith('.png.webp') && fs.existsSync(file.slice(0,-5))) {
   const png=rel.slice(0,-5), base=path.basename(png);
   if(strings.some(s=>s===base||s.includes(png))||extra.includes(base)||patterns.some(p=>p.test('./'+png)||p.test(png)||p.test(base)))reason='WebP companion';
 }
 (reason?used:candidates).push({path:rel,bytes:size,...(reason?{reason}:{})});
}
const reachable=new Set();function reach(file){if(reachable.has(file))return;reachable.add(file);for(const dep of imports.get(file)||[])reach(dep);}reach(path.join(root,'_client/src/index.js'));
const report={sourceFiles:sourceFiles.length,reachableSourceFiles:sourceFiles.filter(f=>reachable.has(f)).length,unreachableSourceFiles:sourceFiles.filter(f=>!reachable.has(f)).map(f=>path.relative(root,f)),parseErrors,used,candidates};
fs.writeFileSync(output,JSON.stringify(report,null,2));
console.log(JSON.stringify({sourceFiles:report.sourceFiles,reachableSourceFiles:report.reachableSourceFiles,unreachable:report.unreachableSourceFiles,parseErrors:parseErrors.length,referenced:used.length,candidates:candidates.length}));

if(candidates.length || parseErrors.length || report.unreachableSourceFiles.length) process.exitCode=1;
