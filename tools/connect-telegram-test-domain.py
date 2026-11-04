"""Connect only Telegram TEST hostname. No SQL, legacy edits or PHP enablement."""
from pathlib import Path
import importlib.util
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('release',ROOT/'tools/release.py')
release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)
code=r'''
import pathlib,subprocess,json,hashlib,urllib.request,datetime,shutil
domain='tg-test-pripyat-game.ru'
def run(args):return subprocess.run(args,check=True,capture_output=True,text=True).stdout.strip()
for resolver in ['ns1.reg.ru','1.1.1.1','8.8.8.8']:
    print(json.dumps({'dns':resolver,'A':run(['dig','+short',domain,'A','@'+resolver])}),flush=True)
# Evaluate PHP config privately. Never print bot token or Telegram error URL.
php=r''' + '"""' + r'''$c=require '/etc/pripyat/telegram-test.php';
if(($c['enabled']??null)!==false || ($c['database']??'')!=='stalker_telegram_test')exit(2);
$t=$c['bot_token']??'';
if(!preg_match('/^[0-9]+:[A-Za-z0-9_-]{20,}$/D',$t))exit(3);
$raw=@file_get_contents('https://api.telegram.org/bot'.$t.'/getMe');
$r=json_decode($raw?:'',true);
if(!($r['ok']??false))exit(4);
echo json_encode(['bot_valid'=>true,'username'=>$r['result']['username'],'login_enabled'=>false]);
''' + '"""' + r'''
result=subprocess.run(['php','-r',php],capture_output=True,text=True)
assert result.returncode==0,'Private bot/config validation failed (details suppressed)'
print(result.stdout,flush=True)
protected=[p for base in ['/etc/nginx/sites-available','/etc/nginx/sites-enabled'] for p in pathlib.Path(base).iterdir() if p.name!=domain and p.is_file()]
protected += [pathlib.Path(p) for p in ['/var/www/stalker/server/core/models/registry.php','/var/www/stalker-test/server/core/models/registry.php']]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
before={p:sha(p) for p in protected}
backup=pathlib.Path('/var/backups')/('telegram-test-domain-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M%S'))
backup.mkdir(mode=0o700)
site=pathlib.Path('/etc/nginx/sites-available')/domain
link=pathlib.Path('/etc/nginx/sites-enabled')/domain
had_site=site.exists();had_link=link.is_symlink()
if had_site:shutil.copy2(site,backup/'nginx-before.conf')
else:shutil.copyfile('/var/www/stalker-tg-test/config/nginx-http.conf',site)
# ACME must bypass the generic hidden-file deny rule for this new vhost.
initial=site.read_text()
if '/.well-known/acme-challenge/' not in initial:
    initial=initial.replace('    location / {', '    location ^~ /.well-known/acme-challenge/ { root /var/www/stalker-tg-test/public; }\n    location / {',1)
    site.write_text(initial)
assert not link.exists() or (link.is_symlink() and link.resolve()==site.resolve()),'Unexpected site link'
if not had_link:link.symlink_to(site)
try:run(['nginx','-t'])
except BaseException:
    if not had_link:link.unlink()
    if not had_site:site.unlink()
    raise
run(['systemctl','reload','nginx'])
# Webroot mode obtains only this certificate; never rewrites other nginx sites.
cert=subprocess.run(['certbot','certonly','--webroot','-w','/var/www/stalker-tg-test/public','-d',domain,'--cert-name',domain,'--non-interactive','--agree-tos','--register-unsafely-without-email'],capture_output=True,text=True)
if cert.returncode:
    assert all(sha(p)==v for p,v in before.items())
    print('HTTP site enabled; HTTPS certificate pending DNS propagation',flush=True)
    print(cert.stderr[-2500:],flush=True)
    raise SystemExit(2)
text=f''' + '"""' + r'''server {{
    listen 80;
    server_name {domain};
    location ^~ /.well-known/acme-challenge/ {{ root /var/www/stalker-tg-test/public; }}
    location / {{ return 301 https://{domain}$request_uri; }}
}}
server {{
    listen 443 ssl;
    server_name {domain};
    root /var/www/stalker-tg-test/public;
    index index.html;
    ssl_certificate /etc/letsencrypt/live/{domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/{domain}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    access_log /var/log/nginx/pripyat-tg-test-access.log;
    error_log /var/log/nginx/pripyat-tg-test-error.log;
    location / {{ try_files $uri $uri/ =404; }}
    location ~ \.php$ {{ return 503; }}
    location ~ /\. {{ deny all; }}
}}
''' + '"""' + r'''
http=site.read_text();site.write_text(text)
try:run(['nginx','-t']);run(['systemctl','reload','nginx'])
except BaseException:
    site.write_text(http);run(['nginx','-t']);run(['systemctl','reload','nginx']);raise
assert all(sha(p)==v for p,v in before.items()),'Legacy configuration changed'
print(json.dumps({'https_enabled':domain,'backup':str(backup),'legacy_configs_unchanged':True,'database_created':False}),flush=True)
'''
client=release.connect()
try:print(release.run_remote_python(client,code))
finally:client.close()
