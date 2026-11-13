"""One source release across isolated runtime profiles. Never deploys registry, private config or migrations."""
from pathlib import Path
import subprocess,json,hashlib,zipfile,tempfile,sys
root=Path(__file__).resolve().parents[1];work=Path(tempfile.gettempdir())/'pripyat-reviewed-release';work.mkdir(exist_ok=True)
ssh=['ssh','-o','BatchMode=yes','-i',str(Path.home()/'.ssh/id_ed25519_stalker'),'root@135.106.159.212','python3','-']
def remote(code):
 r=subprocess.run(ssh,input=code,text=True,capture_output=True,encoding='utf-8')
 if r.returncode:raise RuntimeError(r.stdout+r.stderr)
 return r.stdout
mode=sys.argv[1] if len(sys.argv)>1 else 'plan'
if mode=='plan':
 targets={};payload={}
 def add(source,dest):
  p=root/source;data=p.read_bytes()
  if not source.startswith('assets/'):data=data.replace(b'\r\n',b'\n')
  digest=hashlib.sha256(data).hexdigest();payload[digest]=data
  if dest in targets:assert targets[dest]['sha256']==digest,'Conflicting target '+dest
  targets[dest]={'source':source,'sha256':digest}
 natives=['/var/www/stalker-native-test','/var/www/stalker-native-prod'];tgs=['/var/www/stalker-tg-test/public','/var/www/stalker-tg-prod/public'];site='/var/www/pripyat-site'
 bases=natives+tgs+[site]
 for folder in ['server/core/models','server/core/controllers','server/json']:
  for p in sorted((root/folder).glob('*')):
   if p.suffix not in ['.php','.json'] or p.name in ['registry.php','registry.example.php']:continue
   rel=p.relative_to(root).as_posix()
   for b in bases:add(rel,b+'/'+rel)
 # Source models flattened by the existing website deployments retain those paths.
 aliases=json.loads(remote("from pathlib import Path\nimport json\nprint(json.dumps({b:[p.name for p in Path(b).glob('*.php')] for b in ['/var/www/pripyat-site/app','/var/www/pripyat-site/telegram-website-prod/app']}))"))
 for b,names in aliases.items():
  for name in names:
   for src in ['website/app/'+name,'server/core/models/'+name]:
    if (root/src).is_file():add(src,b+'/'+name);break
 for p in (root/'website/app').glob('*.php'):add(p.relative_to(root).as_posix(),site+'/app/'+p.name)
 for name in ['telegram-login.php','telegram-api.php','telegram-bot.php']:
  for b in tgs:add('server/'+name,b+'/server/'+name)
 for name in ['site-api.php','social-api.php','site-payments-webhook.php']:add('server/'+name,site+'/server/'+name)
 # Isolated Telegram website PROD is built from the same website source.
 for n in ['telegramprodhttp','telegramwebsitepayments','sitepayments','siteyookassa','sitesessions','sitereceipthistory']:add('website/app/'+n+'.php',site+'/telegram-website-prod/app/'+n+'.php')
 for n in ['telegramauth','telegramenvironment','telegramloginstore','telegramplayerlock','telegramoidc','gameaccesspolicy','rewardlinktargets']:add('server/core/models/'+n+'.php',site+'/telegram-website-prod/app/'+n+'.php')
 add('server/core/models/erasedaccounts.php',site+'/telegram-website-prod/server/core/models/erasedaccounts.php');add('server/json/site_prices.json',site+'/telegram-website-prod/server/json/site_prices.json')
 for p in (root/'rewards-admin').iterdir():
  if p.is_file():add(p.relative_to(root).as_posix(),'/var/www/pripyat-rewards-test/public/'+p.name)
 for n in ['rewardstotp','rewardstotp-gate','rewardsauth']:add('website/app/'+n+'.php','/var/www/pripyat-rewards-test/app/'+n+'.php')
 for n in ['rewardlinkpublisher','rewardlinktargets']:add('server/core/models/'+n+'.php','/var/www/pripyat-rewards-test/app/'+n+'.php')
 # Publish public website pages without touching runtime/private configuration.
 for p in (root/'website').rglob('*'):
  if not p.is_file() or 'app' in p.relative_to(root/'website').parts or p.suffix not in ['.html','.js','.css','.svg','.png','.webp','.ico','.txt']:continue
  rel=p.relative_to(root/'website').as_posix();add(p.relative_to(root).as_posix(),site+'/public/'+rel)
 assets=json.loads((root/'assets/manifest.json').read_text(encoding='utf-8'))
 for name,entry in assets.items():
  source='assets/'+name;assert hashlib.sha256((root/source).read_bytes()).hexdigest()==entry['sha256']
  for b in natives+tgs:
   rel='server/images/'+name.split('/',1)[1] if name.startswith('server-images/') else ('client/ver0_41/'+name if b in natives else name)
   add(source,b+'/'+rel)
  if name.startswith('libs/'):add(source,site+'/game-libs/'+name.split('/',1)[1])
 version=hashlib.sha256((root/'_client/development/libs/index.js').read_bytes()).hexdigest()[:12]
 for b in natives:
  add('_client/development/libs/index.js',b+'/client/ver0_41/libs/index.unified-'+version+'.js');add('_client/development/libs/index.js',b+'/client/ver0_41/libs/index.js')
 for n in ['native-avatar-sync.js','native-site-link.js']:
  for b in natives:add('server/'+n,b+'/client/ver0_41/libs/'+n)
 siteversion=hashlib.sha256((root/'_client/website-build/libs/index.js').read_bytes()).hexdigest()[:12]
 for p in (root/'_client/website-build/libs').glob('*.js'):
  for prefix in [site+'/game-libs',site+'/game-libs/unified-'+siteversion]:add(p.relative_to(root).as_posix(),prefix+'/'+p.name)
 tgversion=hashlib.sha256((root/'_client/telegram-build/libs/index.js').read_bytes()).hexdigest()[:12]
 for p in (root/'_client/telegram-build/libs').glob('*.js'):
  for b in tgs:add(p.relative_to(root).as_posix(),b+'/libs/'+p.name)
 manifest={'source_revision':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'versions':{'native':version,'website':siteversion,'telegram':tgversion},'targets':targets}
 before=json.loads(remote("from pathlib import Path\nimport hashlib,json\ntargets="+repr(list(targets))+"\nprint(json.dumps({n:hashlib.sha256(Path(n).read_bytes()).hexdigest() if Path(n).is_file() else None for n in targets}))"))
 changed={n:e for n,e in targets.items() if before[n]!=e['sha256']};manifest['before']=before;manifest['changed']=list(changed)
 (work/'manifest.json').write_text(json.dumps(manifest),encoding='utf-8')
 with zipfile.ZipFile(work/'payload.zip','w',zipfile.ZIP_DEFLATED) as z:
  z.writestr('manifest.json',json.dumps(manifest))
  for digest in {e['sha256'] for e in changed.values()}:z.writestr('blobs/'+digest,payload[digest])
 print(json.dumps({'targets':len(targets),'changed':len(changed),'payload_bytes':(work/'payload.zip').stat().st_size,'versions':manifest['versions']}))
elif mode in ['apply','verify']:
 subprocess.run(['scp','-q','-i',str(Path.home()/'.ssh/id_ed25519_stalker'),str(work/'payload.zip'),'root@135.106.159.212:/var/backups/pripyat-unified-payload.zip'],check=True)
 code=(root/'tools/unify-reviewed-release-remote.py').read_text(encoding='utf-8');print(remote('MODE='+repr(mode)+'\n'+code))
else:raise SystemExit('Use plan, apply or verify')
