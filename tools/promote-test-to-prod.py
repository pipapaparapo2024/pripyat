"""Promote the exact verified TEST manifest to PROD; private configs and DB stay untouched.
No arguments: read-only plan. --apply: backed-up publication with rollback.
"""
from pathlib import Path
import importlib.util,json,sys
ROOT=Path(__file__).resolve().parents[1]
if sys.argv[1:] not in ([],['--apply']):raise ValueError('Use --apply or no arguments')
spec=importlib.util.spec_from_file_location('release',ROOT/'tools/release.py');release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)
code=r'''
from pathlib import Path
import hashlib,json,datetime,shutil,os,fcntl,subprocess
apply=APPLY
version=731
test=Path('/var/www/stalker-test').resolve();prod=Path('/var/www/stalker').resolve()
assert str(test)=='/var/www/stalker-test' and str(prod)=='/var/www/stalker'
releases=sorted(Path('/var/backups').glob('pripyat-test-unified-'+str(version)+'-*'))
assert releases,'Verified TEST release missing'
expected=json.loads((releases[-1]/'release-manifest.json').read_text())
assert len(expected)>5000
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else None
protected={p:sha(p) for p in [prod/'server/core/models/registry.php',test/'server/core/models/registry.php']}
assert all(protected.values())
changed=[]
for relative,digest in expected.items():
    assert not Path(relative).is_absolute() and '..' not in Path(relative).parts
    assert relative.startswith(('server/','client/ver0_41/'))
    assert Path(relative).name not in ('registry.php','registry.example.php')
    source=(test/relative).resolve();target=(prod/relative).resolve()
    assert source.is_relative_to(test) and target.is_relative_to(prod)
    assert sha(source)==digest,'TEST differs from its verified release: '+relative
    if sha(target)!=digest:changed.append(relative)
for prefix in ['client/ver0_41','client/ver0_41/development']:
    assert 'index.js?v='+str(version) in (test/prefix/'index.html').read_text()
print(json.dumps({'version':version,'verified_test_files':len(expected),'changed_prod_files':len(changed),'apply':apply}),flush=True)
if apply:
    lock=open('/var/lock/pripyat-release.lock','w');fcntl.flock(lock,fcntl.LOCK_EX)
    backup=Path('/var/backups')/('pripyat-prod-from-test-'+str(version)+'-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M%S'))
    backup.mkdir(mode=0o700);stage=backup/'stage';original=backup/'original'
    total=sum((test/r).stat().st_size for r in changed)
    assert shutil.disk_usage(prod).free>total*3+128*1024*1024,'Insufficient backup/staging space'
    before={r:sha(prod/r) for r in changed};published=[]
    for relative in changed:
        pending=stage/relative;pending.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(test/relative,pending)
        assert sha(pending)==expected[relative]
        if relative.endswith('.php'):subprocess.run(['php','-l',str(pending)],capture_output=True,check=True)
        target=prod/relative
        if target.exists():
            saved=original/relative;saved.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(target,saved);assert sha(saved)==before[relative]
    def order(r):return (2 if r.endswith('/index.html') else 1 if r.endswith('/libs/index.js') else 0,r)
    try:
        for relative in sorted(changed,key=order):
            assert sha(prod/relative)==before[relative],'Concurrent PROD modification: '+relative
            target=prod/relative;target.parent.mkdir(parents=True,exist_ok=True);os.replace(stage/relative,target);published.append(relative)
            assert sha(target)==expected[relative]
        if any(r.endswith('.php') for r in changed):subprocess.run(['systemctl','restart','php8.5-fpm'],check=True)
        for relative,digest in expected.items():assert sha(prod/relative)==digest and sha(test/relative)==digest,relative
        for p,digest in protected.items():assert sha(p)==digest,'Private configuration changed'
        (backup/'release-manifest.json').write_text(json.dumps(expected,indent=2))
        (backup/'changes.json').write_text(json.dumps(before,indent=2))
        print(json.dumps({'published':len(published),'verified_prod_test_files':len(expected),'backup':str(backup),'private_configs_unchanged':True}),flush=True)
    except BaseException:
        for relative in reversed(published):
            target=prod/relative
            if before[relative] is None:
                assert target.resolve().is_relative_to(prod);target.unlink()
            else:shutil.copy2(original/relative,target)
        if any(r.endswith('.php') for r in published):subprocess.run(['systemctl','restart','php8.5-fpm'],check=True)
        print('PROD rollback completed',flush=True)
        raise
'''.replace('APPLY',repr(sys.argv[1:]==['--apply']))
client=release.connect()
try:print(release.run_remote_python(client,code),flush=True)
finally:client.close()
