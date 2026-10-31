"""Publish a GitHub release already built/verified on test; preserve private configs."""
from pathlib import Path
from datetime import datetime,timezone
import importlib.util,subprocess,hashlib,json,re,shlex,sys
root=Path(__file__).resolve().parents[1]
if sys.argv[1:] not in ([],['--apply']):raise ValueError('Use --apply or no arguments')
commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root).decode().strip()
remote=subprocess.check_output(['git','ls-remote','origin','refs/heads/main'],cwd=root).decode().split()[0]
assert remote==commit,'Push this release to GitHub main first'
stage=root/'_client/development/github-test-releases'/commit
version=int(re.search(r'index\.js\?v=(\d+)',(stage/'_client/development/index.html').read_text(encoding='utf-8'))[1])
spec=importlib.util.spec_from_file_location('release',root/'tools/release.py')
release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)
files=[]
for p in (stage/'server').rglob('*'):
    if not p.is_file() or p.suffix not in ('.php','.json'):continue
    if p.name in ('registry.php','registry.example.php') or p.name.startswith(('migrate','reset_')):continue
    relative=p.relative_to(stage).as_posix();files.append((relative,relative))
for icon in (stage/'assets/server-images').glob('*'):
    if icon.is_file():files.append((icon.relative_to(stage).as_posix(),'server/images/'+icon.name))
for prefix in ['client/ver0_41','client/ver0_41/development']:
    for p in (stage/'assets').rglob('*'):
        if p.is_file() and p.relative_to(stage/'assets').parts[0] in ['images','sounds','fonts','spine','libs']:files.append((p.relative_to(stage).as_posix(),prefix+'/'+p.relative_to(stage/'assets').as_posix()))
    files += [('_client/development/libs/index.js',prefix+'/libs/index.js'),('_client/development/index.html',prefix+'/index.html')]
local={remote:hashlib.sha256((stage/local).read_bytes()).hexdigest() for local,remote in files}
def manifest(client,base):
    code='import pathlib,hashlib,json\nbase=pathlib.Path('+repr(base)+')\npaths='+repr(list(local))+'\nprint(json.dumps({p:hashlib.sha256((base/p).read_bytes()).hexdigest() if (base/p).is_file() else None for p in paths}))'
    return json.loads(release.run_remote_python(client,code))
client=release.connect()
try:
    assert manifest(client,'/var/www/stalker-test')==local,'Test must be fully deployed and verified first'
    before=manifest(client,'/var/www/stalker')
    configs=release.command(client,'sha256sum /var/www/stalker/server/core/models/registry.php /var/www/stalker-test/server/core/models/registry.php')
finally:client.close()
release.ROOT=stage;release.VERSION=version;release.BASES=['/var/www/stalker']
release.BACKUP='/var/backups/pripyat-prod-github-'+commit[:12]+'-'+datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
release.FILES=[(a,b) for a,b in files if before.get(b)!=local[b]]
assert all('/registry' not in b for _,b in release.FILES)
print('GitHub:',commit,'version:',version,'changed production files:',len(release.FILES),flush=True)
release.main()
client=release.connect()
try:
    assert release.command(client,'sha256sum /var/www/stalker/server/core/models/registry.php /var/www/stalker-test/server/core/models/registry.php')==configs,'Private config changed'
    if sys.argv[1:]==['--apply']:
        assert manifest(client,'/var/www/stalker')==local,'Production differs from GitHub'
        assert manifest(client,'/var/www/stalker-test')==local,'Test differs from GitHub'
finally:client.close()
print(('ALL RELEASE FILES VERIFIED AGAINST GITHUB: ' if sys.argv[1:]==['--apply'] else 'PLAN FILES: ')+str(len(files)),flush=True)
