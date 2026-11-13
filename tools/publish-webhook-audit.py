"""Deploy only webhook audit and its read-only history UI, with backup and harmless HTTPS probes."""
from pathlib import Path
import subprocess,base64
root=Path(__file__).resolve().parents[1]
names=['server/site-payments-webhook.php','website/app/paymentwebhook.php','website/app/paymentattempts.php','website/app/rewardspurchases.php']
files={n:base64.b64encode((root/n).read_bytes()).decode() for n in names}
code=r"""from pathlib import Path
import subprocess,base64,pwd,os,shutil,datetime,json,urllib.request,urllib.error
backup=Path('/var/backups')/('pripyat-webhook-audit-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));backup.mkdir(mode=0o700)
def run(args):
 r=subprocess.run(args,capture_output=True,text=True);assert r.returncode==0,'Check failed: '+args[0]
 return r.stdout
account=pwd.getpwnam('pripyat-site-test');audit=Path('/var/lib/pripyat-payment-webhooks');audit.mkdir(exist_ok=True);os.chown(audit,account.pw_uid,account.pw_gid);audit.chmod(0o750)
changed=[]
try:
 for name,data in FILES.items():
  dest=Path('/var/www/pripyat-site')/(name[8:] if name.startswith('website/') else name);key=str(dest).replace('/','__')
  if dest.exists():shutil.copy2(dest,backup/key)
  changed.append((dest,key));dest.write_bytes(base64.b64decode(data));dest.chmod(0o644);run(['php','-l',str(dest)])
 pool=Path('/etc/php/8.5/fpm/pool.d/pripyat-site-test.conf');key='pool.conf';shutil.copy2(pool,backup/key);changed.append((pool,key));text=pool.read_text()
 if '/var/lib/pripyat-payment-webhooks' not in text:text=text.replace('php_admin_value[open_basedir] = ','php_admin_value[open_basedir] = /var/lib/pripyat-payment-webhooks:')
 pool.write_text(text)
 rotate=Path('/etc/logrotate.d/pripyat-payment-webhooks');key='rotate.conf'
 if rotate.exists():shutil.copy2(rotate,backup/key)
 changed.append((rotate,key));rotate.write_text('/var/lib/pripyat-payment-webhooks/*.jsonl {\n daily\n rotate 30\n maxsize 10M\n missingok\n notifempty\n compress\n delaycompress\n copytruncate\n su pripyat-site-test pripyat-site-test\n}\n')
 run(['php-fpm8.5','-t']);run(['nginx','-t']);run(['logrotate','--debug',str(rotate)]);run(['systemctl','reload','php8.5-fpm'])
 url='https://pripyat-game-site.ru/server/site-payments-webhook.php'
 for body,want in [(None,400),(b'{"type":"audit-smoke","event":"ignored"}',200),(b'{invalid',503)]:
  req=urllib.request.Request(url,data=body,headers={'Content-Type':'application/json'})
  try:r=urllib.request.urlopen(req,timeout=20)
  except urllib.error.HTTPError as e:r=e
  r.read();assert r.code==want,(r.code,want)
 rows=[json.loads(x) for x in (audit/'deliveries.jsonl').read_text().splitlines()[-4:]]
 assert [x['outcome'] for x in rows]==['rejected_request','received','ignored','error:JsonException'],[x['outcome'] for x in rows]
 print('HTTPS webhook probes 400/200/503 recorded; no provider calls or player changes; backup '+str(backup))
except Exception:
 for dest,key in reversed(changed):
  if (backup/key).exists():shutil.copy2(backup/key,dest)
  elif dest.exists():dest.unlink()
 run(['systemctl','reload','php8.5-fpm']);raise
""".replace('FILES',repr(files))
r=subprocess.run(['ssh','-o','BatchMode=yes','-i',str(Path.home()/'.ssh/id_ed25519_stalker'),'root@135.106.159.212','python3','-'],input=code,text=True,capture_output=True)
print(r.stdout,r.stderr);raise SystemExit(r.returncode)
