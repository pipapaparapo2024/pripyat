# Executed over SSH by unify-reviewed-release.py. MODE is supplied by the caller.
from pathlib import Path
import os,json,hashlib,zipfile,subprocess,datetime,shutil,re,urllib.request,urllib.error
archive=Path('/var/backups/pripyat-unified-payload.zip');archive.chmod(0o600)
roots=[Path('/var/www')/n for n in ['stalker-native-test','stalker-native-prod','stalker-tg-test','stalker-tg-prod','pripyat-site','pripyat-rewards-test']]
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def command(args):
 r=subprocess.run(args,capture_output=True,text=True);assert r.returncode==0,'Check failed '+args[0]
 return r.stdout
def valid(name):
 p=Path(name);assert any(p.resolve().is_relative_to(r.resolve()) for r in roots),name
 assert '/private/' not in name and p.name not in ['registry.php','registry.example.php'] and not p.name.startswith(('migrate','reset_')),name
 return p
def configuration():
 paths=set(Path('/etc/pripyat').rglob('*'))
 for root in roots:
  paths.update(root.glob('**/registry.php'));paths.update((root/'private').glob('*'))
 return {str(p):digest(p) for p in paths if p.is_file()}
with zipfile.ZipFile(archive) as z:
 manifest=json.loads(z.read('manifest.json'));targets=manifest['targets'];versions=manifest['versions']
 for name in targets:valid(name)
 if MODE=='verify':
  for name,entry in targets.items():assert Path(name).is_file() and digest(Path(name))==entry['sha256'],name
  print(json.dumps({'verified_targets':len(targets),'source_revision':manifest['source_revision'],'versions':versions}));raise SystemExit
 before_configuration=configuration()
 backup=Path('/var/backups')/('pripyat-unified-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));backup.mkdir(mode=0o700)
 stage=backup/'stage';stage.mkdir(mode=0o700)
 changed=manifest['changed'];old_meta={};new_files=[];html_changed=[]
 for name in changed:
  p=valid(name);actual=digest(p) if p.is_file() else None;assert actual==manifest['before'][name],'Concurrent change '+name
  value=z.read('blobs/'+targets[name]['sha256']);assert hashlib.sha256(value).hexdigest()==targets[name]['sha256']
  staged=stage/targets[name]['sha256'];staged.write_bytes(value)
  if p.suffix=='.php':command(['php','-l',str(staged)])
  if p.exists():
   old=backup/'files'/p.relative_to('/');old.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,old);st=p.stat();old_meta[name]=[st.st_uid,st.st_gid,st.st_mode&0o777]
  else:new_files.append(name)
 def write(p,data):
  p.parent.mkdir(parents=True,exist_ok=True);temp=p.with_name('.'+p.name+'.release-new');temp.write_bytes(data)
  uid,gid,mode=old_meta.get(str(p),[0,0,0o644]);os.chown(temp,uid,gid);temp.chmod(mode);os.replace(temp,p)
 def patch_html(name,pattern,replacement):
  p=valid(name);old=backup/'html'/p.relative_to('/');old.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,old);html_changed.append((p,old));text=p.read_text()
  text,count=re.subn(pattern,replacement,text);assert count==1,'Unexpected script entry '+name
  st=p.stat();old_meta[str(p)]=[st.st_uid,st.st_gid,st.st_mode&0o777];write(p,text.encode())
 def reload():
  command(['php-fpm8.5','-t']);command(['nginx','-t']);command(['systemctl','reload','php8.5-fpm']);command(['systemctl','reload','pripyat-native-prod-fpm'])
 def smoke(url,statuses):
  try:r=urllib.request.urlopen(url,timeout=30)
  except urllib.error.HTTPError as e:r=e
  r.read();assert r.code in statuses,(url,r.code)
 try:
  # Models and assets are installed before controllers; entry pages switch last.
  ordered=sorted(changed,key=lambda n:('/controllers/' in n,n))
  for phase in ['test','prod']:
   for name in ordered:
    is_test=name.startswith('/var/www/stalker-native-test/') or name.startswith('/var/www/stalker-tg-test/')
    if is_test!=(phase=='test'):continue
    write(Path(name),(stage/targets[name]['sha256']).read_bytes())
   if phase=='test':
    patch_html('/var/www/stalker-native-test/client/ver0_41/index.html',r'\./libs/index[^" ]*\.js(?:\?[^" ]*)?', './libs/index.unified-'+versions['native']+'.js?v='+versions['native'])
    patch_html('/var/www/stalker-tg-test/public/index.html',r'\./libs/index\.js(?:\?[^" ]*)?', './libs/index.js?v='+versions['telegram'])
   else:
    patch_html('/var/www/stalker-native-prod/server/client-shell.html',r'\./libs/index[^" ]*\.js(?:\?[^" ]*)?', './libs/index.unified-'+versions['native']+'.js?v='+versions['native'])
    patch_html('/var/www/stalker-tg-prod/public/index.html',r'\./libs/index\.js(?:\?[^" ]*)?', './libs/index.js?v='+versions['telegram'])
    patch_html('/var/www/pripyat-site/game/index.html',r'\./libs/index\.js(?:\?[^" ]*)?', './libs/index.js?v='+versions['website'])
    patch_html('/var/www/pripyat-site/game/telegram.html',r'\./libs/[^" ]*/index\.js(?:\?[^" ]*)?', './libs/unified-'+versions['website']+'/index.js')
   reload()
   if phase=='test':
    smoke('https://test-pripyat-game.ru/client/ver0_41/libs/index.unified-'+versions['native']+'.js',{200});smoke('https://tg-test-pripyat-game.ru/server/telegram-api.php',{405})
   else:
    smoke('https://pripyat-game.ru/client/ver0_41/libs/index.unified-'+versions['native']+'.js',{200});smoke('https://pripyat-game-site.ru/auth/status',{200});smoke('https://pripyat-game-site.ru/rewards-admin/login.php',{200});smoke('https://pripyat-game-site.ru/telegram/server/telegram-api.php',{405})
   assert configuration()==before_configuration,'Environment configuration changed'
  for name,e in targets.items():assert digest(Path(name))==e['sha256'],'Final hash mismatch '+name
  (backup/'release-manifest.json').write_text(json.dumps(manifest,indent=2));(backup/'protected-config-sha256.json').write_text(json.dumps(before_configuration))
  for root in roots:
   (root/'release-version.json').write_text(json.dumps({'source_revision':manifest['source_revision'],'versions':versions,'profile':root.name}))
  print(json.dumps({'backup':str(backup),'changed':len(changed),'verified':len(targets),'versions':versions,'protected_configuration_files':len(before_configuration),'configuration_unchanged':True,'sql_executed':False}))
 except Exception:
  for p,old in reversed(html_changed):shutil.copy2(old,p)
  for name in changed:
   old=backup/'files'/Path(name).relative_to('/');p=Path(name)
   if old.exists():shutil.copy2(old,p)
   elif name in new_files and p.exists():p.unlink()
  reload();assert configuration()==before_configuration
  print('Publication rolled back; previous files restored; configuration preserved; backup '+str(backup));raise
