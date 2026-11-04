"""Stage TEST OIDC + shared TG game. Providers remain disabled until privately configured."""
from pathlib import Path
import importlib.util,base64
ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('p',ROOT/'tools/provision-new-server.py');p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
files={'app/auth.php':ROOT/'website/app/auth.php'}
for name in ['telegramoidc','telegramauth','telegramloginstore','telegramplayerlock','gameaccesspolicy','rewardlinktargets']:files['app/'+name+'.php']=ROOT/'server/core/models'/(name+'.php')
for f in (ROOT/'assets/libs').glob('*'):
 if f.is_file():files['game-libs/'+f.name]=f
for f in (ROOT/'_client/website-build/libs').glob('*.js'):files['game-libs/'+f.name]=f
assert (ROOT/'_client/website-build/libs/index.js').is_file()
payload={n:base64.b64encode(f.read_bytes()).decode() for n,f in files.items()}
p.remote('root',r'''
from pathlib import Path
import base64,subprocess,json,os,pwd,shutil,re,datetime
def run(args):
 r=subprocess.run(args,capture_output=True,text=True)
 if r.returncode:raise RuntimeError('Command failed: '+args[0]+('; '+r.stderr if args[0]=='nginx' else '; private diagnostics suppressed'))
 return r.stdout
base=Path('/var/www/pripyat-site');assert base.is_dir()
backup=Path('/var/backups')/('pripyat-website-auth-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));backup.mkdir(mode=0o700)
for name,value in FILES.items():
 dest=base/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(base64.b64decode(value));dest.chmod(0o644)
 if name.endswith('.php'):run(['php','-l',str(dest)])
game=base/'game';game.mkdir(exist_ok=True)
html=Path('/var/www/stalker-tg-test/public/index.html').read_text()
html=re.sub(r'<script src="https://telegram.org/js/telegram-web-app.js"></script>','',html)
html=re.sub(r'index\.js\?v=\d+','index.js?v=1',html).replace('https://tg-test-pripyat-game.ru/','https://pripyat-game-site.ru/game/')
(game/'index.html').write_text(html)
try:user=pwd.getpwnam('pripyat-site-test')
except KeyError:
 run(['useradd','--system','--no-create-home','--shell','/usr/sbin/nologin','pripyat-site-test']);user=pwd.getpwnam('pripyat-site-test')
private=Path('/etc/pripyat');config=private/'website-auth-test.json';shutil.copy2(config,backup/'auth-before.json');(backup/'auth-before.json').chmod(0o600)
c=json.loads(config.read_text());c['access']=json.loads((private/'closed-test-access.json').read_text());config.write_text(json.dumps(c,indent=2));os.chown(config,0,user.pw_gid);config.chmod(0o640)
gameconfig=private/'website-game-test.php'
if not gameconfig.exists():shutil.copy2(private/'telegram-test.php',gameconfig)
os.chown(gameconfig,0,user.pw_gid);gameconfig.chmod(0o640)
state=Path('/var/lib/pripyat-site-test');state.mkdir(exist_ok=True);os.chown(state,user.pw_uid,user.pw_gid);state.chmod(0o700)
pool=Path('/etc/php/8.5/fpm/pool.d/pripyat-site-test.conf');assert not pool.exists()
pool.write_text('[pripyat-site-test]\nuser = pripyat-site-test\ngroup = pripyat-site-test\nlisten = /run/php/php8.5-fpm-site-test.sock\nlisten.owner = www-data\nlisten.group = www-data\nlisten.mode = 0660\npm = ondemand\npm.max_children = 3\npm.process_idle_timeout = 20s\nenv[PRIPYAT_WEBSITE_AUTH_CONFIG] = /etc/pripyat/website-auth-test.json\nenv[PRIPYAT_WEBSITE_GAME_CONFIG] = /etc/pripyat/website-game-test.php\nphp_admin_value[session.save_path] = /var/lib/pripyat-site-test\nphp_admin_flag[display_errors] = off\nphp_admin_value[open_basedir] = /var/www/pripyat-site:/etc/pripyat/website-auth-test.json:/etc/pripyat/website-game-test.php:/var/lib/pripyat-site-test:/tmp\n')
site=Path('/etc/nginx/sites-available/pripyat-site');text=site.read_text();shutil.copy2(site,backup/'nginx-before.conf')
needle=' location / { try_files $uri $uri/ =404; }';assert needle in text
text=text.replace(needle,BLOCK+'\n'+needle)
needle=' server_name pripyat-game-site.ru www.pripyat-game-site.ru;';assert needle in text
text=text.replace(needle,needle+'\n if ($host = www.pripyat-game-site.ru) { return 301 https://pripyat-game-site.ru$request_uri; }',1)
site.write_text(text)
tg=Path('/etc/nginx/sites-available/tg-test-pripyat-game.ru');t=tg.read_text();shutil.copy2(tg,backup/'tg-nginx-before.conf')
needle=' location / { try_files $uri $uri/ =404; }';assert needle in t
t=t.replace(needle,' location ~ "^/images/telegram-avatars/[a-f0-9]{64}\\.jpg$" { add_header Access-Control-Allow-Origin "https://pripyat-game-site.ru"; add_header X-Content-Type-Options nosniff; try_files $uri =404; }\n'+needle);tg.write_text(t)
shutil.copy2(site,backup/'nginx-staged.conf');shutil.copy2(tg,backup/'tg-nginx-staged.conf')
try:run(['php-fpm8.5','-t']);run(['nginx','-t'])
except Exception:
 shutil.copy2(backup/'nginx-before.conf',site);shutil.copy2(backup/'tg-nginx-before.conf',tg);pool.unlink();raise
run(['systemctl','reload','php8.5-fpm']);run(['systemctl','reload','nginx'])
print(json.dumps({'website_oidc_routes_staged':True,'telegram_provider_enabled':bool(c.get('enabled') and c.get('telegram',{}).get('enabled')),'other_providers_enabled':False,'shared_game_database':'stalker_telegram_test','sql_executed':False,'backup':str(backup)}))
'''.replace('FILES',repr(payload)).replace('BLOCK',repr(''' location ~ ^/auth/(status|bootstrap|logout|telegram/start|telegram/callback)$ {
  include fastcgi_params;
  fastcgi_param SCRIPT_FILENAME /var/www/pripyat-site/app/auth.php;
  fastcgi_pass unix:/run/php/php8.5-fpm-site-test.sock;
 }
 location = /game { return 301 /game/; }
 location = /game/ { root /var/www/pripyat-site; try_files /game/index.html =404; }
 location = /game/index.html { alias /var/www/pripyat-site/game/index.html; }
 location /game/libs/ { alias /var/www/pripyat-site/game-libs/; }
 location /game/ { alias /var/www/stalker-tg-test/public/; }
 location = /server/telegram-api.php {
  include fastcgi_params;
  fastcgi_param SCRIPT_FILENAME /var/www/stalker-tg-test/public/server/telegram-api.php;
  fastcgi_pass unix:/run/php/php8.5-fpm-tg-test.sock;
 }
 location = /server/json/links.json { alias /var/www/stalker-tg-test/public/server/json/links.json; }
 location = /server/json/donuts.json { alias /var/www/stalker-tg-test/public/server/json/donuts.json; }
 location /server/images/ { alias /var/www/stalker-tg-test/public/server/images/; }
''')))
