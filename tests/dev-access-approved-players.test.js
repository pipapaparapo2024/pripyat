const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const {execFileSync}=require('child_process');
const {findPhpBin}=require('./_php_bin');
const root=path.resolve(__dirname,'..');
const allowed=['1113977365','382448269','438953352','184138040'];
for(const file of ['_client/src/game/interface.js','_client/src/game/shell/overlays/dev_panel.js']){
    const source=fs.readFileSync(path.join(root,file),'utf8');
    const list=source.match(/const DEV_UIDS = (\[[^\]]+\]);/);
    assert(list,`No client allowlist in ${file}`);
    for(const uid of [...allowed,'999000001','438953352x','']){
        const result=vm.runInNewContext(`${list[0]} DEV_UIDS.includes(String(uid))`,{uid});
        assert.strictEqual(result,allowed.includes(uid),`${file}: ${uid}`);
    }
}
const php=findPhpBin();assert(php,'PHP required for server permission tests');
process.stdout.write(execFileSync(php,[path.join(__dirname,'_php_fixtures/dev-access-approved-players.php')],{encoding:'utf8',timeout:15000}));
console.log('Client dev access: approved IDs and ordinary player denial passed');
