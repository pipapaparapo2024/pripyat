"""Read-only final checks: legacy manifests/schema and Telegram public endpoints."""
from pathlib import Path
import importlib.util,json
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('release',ROOT/'tools/release.py')
release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)
baseline=json.loads((ROOT/'database/telegram-schema-source.json').read_text(encoding='utf-8'))['schemas']
code=r'''
import pathlib,json,hashlib,subprocess,re,urllib.request,ssl
manifest=json.loads(pathlib.Path('/var/backups/pripyat-prod-from-test-762-20261101183534/release-manifest.json').read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for base in ['/var/www/stalker','/var/www/stalker-test']:
    assert all(sha(pathlib.Path(base)/name)==digest for name,digest in manifest.items()),'Legacy release differs: '+base
    print(json.dumps({'legacy_root':base,'verified_release_files':len(manifest),'version':762}))
for db,tables in BASELINE.items():
    for name,ddl in tables.items():
        p=subprocess.run(['mysql','--batch','--skip-column-names','--raw','-e','SHOW CREATE TABLE `'+db+'`.`'+name+'`'],capture_output=True,text=True,check=True)
        actual=re.sub(r' AUTO_INCREMENT=\d+','',p.stdout.rstrip('\n').split('\t',1)[1])
        assert actual==ddl,'Legacy schema differs'
print('Legacy VK/OK/TEST schema metadata unchanged: 30 tables')
for host in ['pripyat-game.ru','test-pripyat-game.ru']:
    html=urllib.request.urlopen('https://'+host+'/client/ver0_41/index.html',timeout=20).read().decode('utf-8-sig')
    assert 'index.js?v=762' in html
for path,status in [('/',200),('/server/core/controllers/users.php',404),('/server/universal.php',404),('/server/telegram-login.php',405),('/images/2048%20%D0%B0%D0%B2%D0%B0%D1%82%D0%B0%D1%80%20%D0%B7%D0%B0%D0%B3%D0%BB%D1%83%D1%88%D0%BA%D0%B0.png',200)]:
    try:r=urllib.request.urlopen('https://tg-test-pripyat-game.ru'+path,timeout=20);actual=r.status
    except urllib.error.HTTPError as e:actual=e.code
    assert actual==status,'TG endpoint differs: '+path
print('Telegram HTTPS and endpoint isolation verified')
'''.replace('BASELINE',repr(baseline))
client=release.connect()
try:print(release.run_remote_python(client,code))
finally:client.close()
