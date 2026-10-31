"""Deploy fetched GitHub main to TEST ONLY; never upload registry or change databases."""
from pathlib import Path
import hashlib,importlib.util,io,json,re,shlex,subprocess,sys,zipfile
from datetime import datetime,timezone

ROOT=Path(__file__).resolve().parents[1]
APPLY=sys.argv[1:]==['--apply']
if sys.argv[1:] not in ([],['--apply']):raise ValueError('Use --apply to publish, no arguments for plan')
def run(args,cwd=ROOT):subprocess.run(args,cwd=cwd,check=True)
def output(args):return subprocess.check_output(args,cwd=ROOT)
run(['git','fetch','origin','main'])
commit=output(['git','rev-parse','FETCH_HEAD']).decode().strip()
stage=ROOT/'_client/development/github-test-releases'/commit
archive=output(['git','archive','--format=zip',commit])
with zipfile.ZipFile(io.BytesIO(archive)) as z:
    for item in z.infolist():
        if item.is_dir():continue
        target=stage/item.filename
        if not target.resolve().is_relative_to(stage.resolve()):raise RuntimeError('Invalid archive path')
        target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(z.read(item))
html=stage/'_client/development/index.html'
version=int(re.search(r'index\.js\?v=(\d+)',html.read_text(encoding='utf-8'))[1])
print('GitHub commit:',commit,'| client version:',version,flush=True)
print('Target: TEST ONLY /var/www/stalker-test',flush=True)
# The source/config are fetched from GitHub; installed webpack is reused as a build dependency.
run(['node',str(ROOT/'_client/node_modules/webpack-cli/bin/cli.js'),'--config','webpack.config.js'],stage/'_client')
# Bundled PixiJS is a preexisting runtime dependency needed only for native input tests.
pixi=stage/'assets/libs/pixi-legacy.min.js'
vendor=stage/'_client/development/libs/pixi-legacy.min.js';vendor.write_bytes(pixi.read_bytes())
for name in ['energy-stash-release','stash-transfer-atomic','collection-achievements-client',
    'friend-wishlist-modal','stash-count-layout','right-menu-native-pixi-hitarea','game2048-top-avatars']:
    run(['node','tests/'+name+'.test.js'],stage)
spec=importlib.util.spec_from_file_location('release',ROOT/'tools/release.py')
release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)
files=[]
for file in (stage/'server').rglob('*'):
    if not file.is_file() or file.suffix not in ('.php','.json'):continue
    relative=file.relative_to(stage).as_posix()
    if file.name in ('registry.php','registry.example.php'):continue
    if file.name.startswith(('migrate','reset_')):continue
    files.append((relative,relative))
for icon in (stage/'assets/server-images').glob('*'):
    if icon.is_file():files.append((icon.relative_to(stage).as_posix(),'server/images/'+icon.name))
for prefix in ['client/ver0_41','client/ver0_41/development']:
    for file in (stage/'assets').rglob('*'):
        if file.is_file() and file.relative_to(stage/'assets').parts[0] in ['images','sounds','fonts','spine','libs']:files.append((file.relative_to(stage).as_posix(),prefix+'/'+file.relative_to(stage/'assets').as_posix()))
    files += [('_client/development/libs/index.js',prefix+'/libs/index.js'),('_client/development/index.html',prefix+'/index.html')]
base='/var/www/stalker-test'
client=release.connect()
try:
    registry_hash=release.command(client,'sha256sum /var/www/stalker-test/server/core/models/registry.php').split()[0]
    paths=[remote for _,remote in files]
    code='import pathlib,hashlib,json\nbase=pathlib.Path('+repr(base)+')\npaths='+repr(paths)+'\nprint(json.dumps({p:hashlib.sha256((base/p).read_bytes()).hexdigest() if (base/p).is_file() else None for p in paths}))'
    remote_hashes=json.loads(release.run_remote_python(client,code))
finally:client.close()
changed=[(local,remote) for local,remote in files if hashlib.sha256((stage/local).read_bytes()).hexdigest()!=remote_hashes.get(remote)]
print('Changed files:',len(changed),'of',len(files),flush=True)
assert all('/registry' not in remote for _,remote in changed)
release.ROOT=stage;release.VERSION=version;release.BASES=[base]
release.BACKUP='/var/backups/pripyat-test-github-'+commit[:12]+'-'+datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
release.FILES=changed
release.main()
client=release.connect()
try:
    assert release.command(client,'sha256sum /var/www/stalker-test/server/core/models/registry.php').split()[0]==registry_hash,'Test registry changed'
    if APPLY:
        public=release.command(client,'curl -fsS https://test-pripyat-game.ru/client/ver0_41/index.html')
        assert 'index.js?v='+str(version) in public
finally:client.close()
print(('TEST DEPLOYED' if APPLY else 'PLAN ONLY')+': '+commit+' | v'+str(version),flush=True)
