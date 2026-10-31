const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),base=path.join(root,'assets');
const previous=JSON.parse(fs.readFileSync(path.join(base,'manifest.json'),'utf8')),result={},seen=new Set();
function scan(directory){
 for(const entry of fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
  const file=path.join(directory,entry.name);
  if(entry.isSymbolicLink())throw new Error('Symlink in assets: '+file);
  if(entry.isDirectory()){scan(file);continue;}
  const key=path.relative(base,file).split(path.sep).join('/');
  if(seen.has(key.toLowerCase()))throw new Error('Case collision: '+key);seen.add(key.toLowerCase());
  if(/\.(bak|pending)$/.test(key))throw new Error('Backup in assets: '+key);
  const bytes=fs.readFileSync(file);
  result[key]={bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),reason:previous[key]?.reason||'runtime asset; validate references with npm run assets:audit'};
 }
}
for(const group of ['images','sounds','fonts','spine','libs','server-images'])if(fs.existsSync(path.join(base,group)))scan(path.join(base,group));
fs.writeFileSync(path.join(base,'manifest.json'),JSON.stringify(result,null,2));
console.log('Updated asset manifest:',Object.keys(result).length);
