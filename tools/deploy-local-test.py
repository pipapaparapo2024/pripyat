"""Publish the local working copy to TEST only. No GitHub push, DB writes, or PROD publication.
Without --apply: read-only inventory. With --apply: verified upload and quarantine of extras.
"""
from pathlib import Path
from datetime import datetime, timezone
import hashlib, importlib.util, json, re, shlex, subprocess, sys, zipfile
ROOT = Path(__file__).resolve().parents[1]
APPLY = sys.argv[1:] == ['--apply']
if sys.argv[1:] not in ([], ['--apply']): raise ValueError('Use --apply or no arguments')
BASE = '/var/www/stalker-test'
html = ROOT / '_client/development/index.html'
version = int(re.search(r'index\.js\?v=(\d+)', html.read_text(encoding='utf-8'))[1])
spec = importlib.util.spec_from_file_location('release', ROOT/'tools/release.py')
release = importlib.util.module_from_spec(spec); spec.loader.exec_module(release)
release.ROOT = ROOT; release.VERSION = version; release.BASES = [BASE]
release.BACKUP = '/var/backups/pripyat-test-unified-' + str(version) + '-' + datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
files = []
for p in sorted((ROOT/'server').rglob('*')):
    if not p.is_file() or p.suffix not in ('.php','.json'): continue
    if p.name in ('registry.php','registry.example.php') or p.name.startswith(('migrate','reset_')): continue
    relative = p.relative_to(ROOT).as_posix(); files.append((relative, relative))
assets = json.loads((ROOT/'assets/manifest.json').read_text(encoding='utf-8'))
for name, entry in sorted(assets.items()):
    source = ROOT/'assets'/name
    assert source.resolve().is_relative_to((ROOT/'assets').resolve()), 'Invalid asset path'
    assert hashlib.sha256(source.read_bytes()).hexdigest() == entry['sha256'], 'Asset changed: '+name
    if name.startswith('server-images/'):
        files.append(('assets/'+name, 'server/images/'+name.split('/',1)[1]))
    else:
        assert name.split('/')[0] in ('images','sounds','fonts','spine','libs')
        for prefix in ['client/ver0_41','client/ver0_41/development']:
            files.append(('assets/'+name, prefix+'/'+name))
for prefix in ['client/ver0_41','client/ver0_41/development']:
    files += [('_client/development/index.html',prefix+'/index.html'),('_client/development/libs/index.js',prefix+'/libs/index.js')]
expected = {remote:hashlib.sha256((ROOT/local).read_bytes()).hexdigest() for local,remote in files}
assert len(expected) == len(files), 'Duplicate release target'
protected = 'sha256sum /var/www/stalker/client/ver0_41/index.html /var/www/stalker/client/ver0_41/libs/index.js /var/www/stalker/client/ver0_41/development/index.html /var/www/stalker/client/ver0_41/development/libs/index.js /var/www/stalker/server/core/models/registry.php /var/www/stalker-test/server/core/models/registry.php'
def inventory(client):
    code = 'import pathlib,hashlib,json\nb=pathlib.Path('+repr(BASE)+')\npaths='+repr(list(expected))+'\nprint(json.dumps({p:hashlib.sha256((b/p).read_bytes()).hexdigest() if (b/p).is_file() else None for p in paths}))'
    return json.loads(release.run_remote_python(client,code))
client = release.connect()
try:
    protected_before = release.command(client,protected)
    before = inventory(client)
finally: client.close()
release.FILES = [(a,b) for a,b in files if before.get(b) != expected[b]]
def publish_batch():
    archive = ROOT/'_client/development'/('test-release-v'+str(version)+'.zip')
    with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_STORED) as z:
        for local,remote in release.FILES: z.write(ROOT/local,remote)
    client=release.connect()
    try:
        release.command(client,'mkdir -p '+shlex.quote(release.BACKUP)+' && chmod 700 '+shlex.quote(release.BACKUP))
        with client.open_sftp() as sftp:
            last=[-1]
            def progress(sent,total):
                block=sent//(32*1024*1024)
                if block!=last[0]:
                    last[0]=block;print('TEST package upload:',sent,'/',total,flush=True)
            sftp.put(str(archive),release.BACKUP+'/release.zip',callback=progress)
        code = """import pathlib,json,hashlib,zipfile,shutil,os,subprocess,fcntl
base=pathlib.Path(BASE).resolve()
assert str(base)=='/var/www/stalker-test'
backup=pathlib.Path(BACKUP)
changed=CHANGED
expected=EXPECTED
before=BEFORE
lock=open('/var/lock/pripyat-test-release.lock','w')
fcntl.flock(lock,fcntl.LOCK_EX)
stage=backup/'stage'
with zipfile.ZipFile(backup/'release.zip') as z:
    assert set(z.namelist())==set(changed)
    for name in changed:
        target=(base/name).resolve();pending=(stage/name).resolve()
        assert target.is_relative_to(base) and pending.is_relative_to(stage.resolve())
        data=z.read(name)
        assert hashlib.sha256(data).hexdigest()==expected[name]
        current=hashlib.sha256(target.read_bytes()).hexdigest() if target.is_file() else None
        assert current==before[name], 'Concurrent update: '+name
        pending.parent.mkdir(parents=True,exist_ok=True)
        pending.write_bytes(data)
        if name.endswith('.php'):subprocess.run(['php','-l',str(pending)],check=True,capture_output=True)
published=[]
try:
    for name in changed:
        target=base/name
        old=backup/'replaced'/name
        had_old=target.is_file()
        if had_old:
            old.parent.mkdir(parents=True,exist_ok=True)
            shutil.copy2(target,old)
            assert hashlib.sha256(old.read_bytes()).hexdigest()==before[name]
        target.parent.mkdir(parents=True,exist_ok=True)
        temporary=target.with_name(target.name+'.publish.pending')
        shutil.copyfile(stage/name,temporary)
        os.replace(temporary,target)
        published.append((target,old,had_old))
    for name,digest in expected.items():assert hashlib.sha256((base/name).read_bytes()).hexdigest()==digest,name
    if any(n.endswith('.php') for n in changed):subprocess.run(['systemctl','restart','php8.5-fpm'],check=True)
except BaseException:
    for target,old,had_old in reversed(published):
        if had_old:shutil.copyfile(old,target)
        else:target.unlink(missing_ok=True)
    raise
print(json.dumps({'published':len(published),'verified':len(expected)}))
""".replace('BASE',repr(BASE)).replace('BACKUP',repr(release.BACKUP)).replace('CHANGED',repr([b for _,b in release.FILES])).replace('EXPECTED',repr(expected)).replace('BEFORE',repr(before))
        print(release.run_remote_python(client,code),flush=True)
    finally:client.close()

print('TEST ONLY v'+str(version), '| assets:',len(assets),'| release files:',len(files),'| changed:',len(release.FILES),flush=True)
if APPLY: publish_batch()
client = release.connect()
try:
    assert release.command(client,protected) == protected_before, 'Protected files changed'
    if APPLY:
        assert inventory(client) == expected, 'Published release differs from local copy'
        # Only static runtime roots on TEST are pruned. Every removed file is moved to private backup.
        roots = [prefix+'/'+group for prefix in ['client/ver0_41','client/ver0_41/development'] for group in ['images','sounds','fonts','spine','libs']] + ['server/images']
        code = """import pathlib,json,hashlib,shutil
base=pathlib.Path(BASE).resolve()
assert str(base)=='/var/www/stalker-test'
backup=pathlib.Path(BACKUP)
backup.mkdir(parents=True,exist_ok=True)
backup.chmod(0o700)
expected=EXPECTED
roots=ROOTS
extra=[]
for relative in roots:
    directory=base/relative
    assert directory.resolve().is_relative_to(base)
    for p in directory.rglob('*'):
        if p.is_file():
            assert not p.is_symlink() and p.resolve().is_relative_to(base)
            rel=p.relative_to(base).as_posix()
            if rel not in expected:extra.append(p)
records={p.relative_to(base).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in extra}
(backup/'quarantine-manifest.json').write_text(json.dumps(records,indent=2),encoding='utf-8')
for p in extra:
    target=backup/'removed'/p.relative_to(base)
    assert target.resolve().is_relative_to(backup.resolve())
    target.parent.mkdir(parents=True,exist_ok=True)
    shutil.move(str(p),str(target))
for relative in roots:
    for p in (base/relative).rglob('*'):
        if p.is_file():assert p.relative_to(base).as_posix() in expected
(backup/'release-manifest.json').write_text(json.dumps(expected,indent=2),encoding='utf-8')
print(json.dumps({'quarantined':len(extra),'verified_release_files':len(expected)}))
""".replace('BASE',repr(BASE)).replace('BACKUP',repr(release.BACKUP)).replace('EXPECTED',repr(expected)).replace('ROOTS',repr(roots))
        print(release.run_remote_python(client,code),flush=True)
        assert inventory(client) == expected
        for prefix in ['client/ver0_41','client/ver0_41/development']:
            public = release.command(client,'curl -fsS https://test-pripyat-game.ru/'+prefix+'/index.html')
            assert 'index.js?v='+str(version) in public
        assert release.command(client,protected) == protected_before
        print('TEST VERIFIED; runtime extras quarantined; PROD and both private configs unchanged',flush=True)
finally: client.close()
