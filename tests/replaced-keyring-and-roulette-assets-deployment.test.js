const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
for(const file of ['images/двор рулетка колесо v3.png','images/shmot/связка ключей v2.png']){const raw=fs.readFileSync(path.join(root,'assets',file));assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),manifest[file].sha256);}
for(const tool of ['deploy-test-from-github.py','sync-prod-from-github.py']){const source=fs.readFileSync(path.join(root,'tools',tool),'utf8');assert(source.includes("['client/ver0_41','client/ver0_41/development']"));assert(source.includes("stage/'assets'"));}
console.log('Current approved asset integrity and both deployment roots passed');
