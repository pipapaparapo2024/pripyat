"""Authorized one-time gameplay reset + public site/native release. Telegram is untouched."""
from pathlib import Path
import subprocess
code=r'''
from pathlib import Path
import subprocess,json,datetime,shutil,time
marker=Path('/var/lib/pripyat-public-launched-20261106.json');assert not marker.exists(),'Already released; refusing another reset'
b=Path('/var/backups')/('public-launch-reset-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));b.mkdir(mode=0o700)
paths=[Path('/etc/pripyat/vk-ok-native-prod.json'),Path('/etc/pripyat/website-access-test.json'),Path('/var/www/pripyat-site/private/site-runtime.json')]
original=[json.loads(p.read_text()) for p in paths]
for i,p in enumerate(paths):shutil.copy2(p,b/('config-'+str(i)+'.json'))
native,access,runtime=original
# Brief maintenance: reject new native and website game requests; preserve all payment ledgers.
native['enabled']=False;access['enabled']=False;runtime['access']['enabled']=False;runtime['native']['enabled']=False
for p,c in zip(paths,[native,access,runtime]):p.write_text(json.dumps(c))
time.sleep(25)
dbs=['stalker','stalker_ok','stalker_site_test']
for db in dbs:
 if db!='stalker_site_test':
  assert subprocess.check_output(['mysql','-N','-e','SELECT COUNT(*) FROM '+db+'.site_payment_orders'],text=True).strip()=='0','Native orders require reconciliation'
 else:
  assert subprocess.check_output(['mysql','-N','-e',"SELECT COUNT(*) FROM stalker_site_test.site_payment_orders WHERE status NOT IN ('succeeded','canceled')"],text=True).strip()=='0','Pending website payment'
 f=b/(db+'.sql')
 with f.open('wb') as out:subprocess.run(['mysqldump','--single-transaction','--routines','--triggers',db],stdout=out,check=True)
 f.chmod(0o600);assert f.stat().st_size>1000
 # Validate restoration in an isolated short-lived database before deleting gameplay.
 scratch='pripyat_launch_restore_check';subprocess.run(['mysql','-e','CREATE DATABASE '+scratch],check=True)
 try:
  with f.open('rb') as src:subprocess.run(['mysql',scratch],stdin=src,check=True)
  old=subprocess.check_output(['mysql','-N','-e','SELECT COUNT(*) FROM '+db+'.users'],text=True)
  new=subprocess.check_output(['mysql','-N','-e','SELECT COUNT(*) FROM '+scratch+'.users'],text=True);assert old==new
 finally:subprocess.run(['mysql','-e','DROP DATABASE '+scratch],check=True)
# Per-world transaction. Keep identities, confirmed phones, account passwords and all payment records.
for db in dbs:
 tables=['boss_damage_log','boss_instance_claims','boss_instances','boss_last_kill','zone_respect_leader','roulette_state']
 sql='START TRANSACTION;'+''.join('DELETE FROM '+t+';' for t in tables)
 if db=='stalker_site_test':
  sql+="DELETE FROM game_friend_requests;DELETE FROM site_sessions;DELETE FROM site_email_tokens;DELETE FROM site_phone_checks;UPDATE site_accounts SET auth_version=auth_version+1;"
 else:sql+="UPDATE secure SET token=MD5(RANDOM_BYTES(32)),req_key=MD5(RANDOM_BYTES(32)),time=0,lifetime=0;"
 sql+='UPDATE reward_links SET active=0;DELETE FROM users;COMMIT;'
 subprocess.run(['mysql',db],input=sql,text=True,check=True)
 assert subprocess.check_output(['mysql','-N','-e','SELECT COUNT(*) FROM '+db+'.users'],text=True).strip()=='0'
# Open only requested worlds; TEST payments remain separately gated by immutable tester policy.
native['enabled']=True;native['public_access']=True;native['payments']['vk_developer_sandbox']=False
access['enabled']=True
for platform in ['email','vk','ok']:access[platform]['mode']='open'
runtime['access']=access;runtime['native']=native
for p,c in zip(paths,[native,access,runtime]):p.write_text(json.dumps(c))
result={'backup':str(b),'reset_worlds':dbs,'public_site_native':True,'vk_sandbox':False,'telegram_untouched':True,'payment_history_preserved':True}
marker.write_text(json.dumps(result));marker.chmod(0o600);print(json.dumps(result))
'''
r=subprocess.run(['ssh','-o','ConnectTimeout=10','-i',str(Path.home()/'.ssh/id_ed25519_stalker'),'root@135.106.159.212','python3','-'],input=code,text=True,encoding='utf-8',capture_output=True)
if r.returncode:raise SystemExit(r.stderr)
print(r.stdout)
