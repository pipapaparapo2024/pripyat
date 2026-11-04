"""Publish only the new website placeholder and disabled bot settings; no SQL."""
from pathlib import Path
import importlib.util, subprocess, json, base64
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('provision', ROOT/'tools/provision-new-server.py')
p = importlib.util.module_from_spec(spec); spec.loader.exec_module(p)
files = {'index.html': ROOT/'website/index.html', 'style.css': ROOT/'website/style.css',
         'assets/zone.webp': ROOT/'assets/images/side-background-v2.png.webp',
         'assets/trebuchet.ttf': ROOT/'assets/fonts/trebuchet.ttf'}
payload = {name: base64.b64encode(source.read_bytes()).decode() for name, source in files.items()}
config = '''server {
 listen 80;
 listen [::]:80;
 server_name pripyat-game-site.ru www.pripyat-game-site.ru;
 root /var/www/pripyat-site/public;
 index index.html;
 add_header X-Content-Type-Options nosniff always;
 add_header Referrer-Policy strict-origin-when-cross-origin always;
 location / { try_files $uri $uri/ =404; }
 location ~ /\\. { deny all; }
 location ~ \\.php$ { return 404; }
}
'''
p.remote('root', r'''
from pathlib import Path
import os,json,secrets,subprocess,shutil,time
for name,data in PAYLOAD.items():
 path=Path('/var/www/pripyat-site/public')/name
 path.parent.mkdir(parents=True,exist_ok=True)
 path.write_bytes(__import__('base64').b64decode(data))
site=Path('/etc/nginx/sites-available/pripyat-site')
if site.exists():
 shutil.copy2(site,'/var/backups/pripyat-site-'+str(int(time.time()))+'.conf')
 if 'ssl_certificate' in site.read_text(): raise RuntimeError('HTTPS already configured: preserve existing vhost')
site.write_text(CONFIG)
link=Path('/etc/nginx/sites-enabled/pripyat-site')
if not link.exists():link.symlink_to(site)
subprocess.run(['nginx','-t'],check=True)
subprocess.run(['systemctl','reload','nginx'],check=True)
for env in ['test','prod']:
 path=Path('/etc/pripyat/telegram-'+env+'-bot.json')
 settings={'enabled':False,'environment':env,'bot_api_environment':'production','bot_username':'pripyat_game_test_bot' if env=='test' else '', 'bot_token':'','webhook_secret':secrets.token_hex(32)}
 try:fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 except FileExistsError:continue
 with os.fdopen(fd,'w') as f:json.dump(settings,f,indent=2)
print('Website published; bot files prepared disabled; no SQL executed')
'''.replace('CONFIG',repr(config)).replace('PAYLOAD',repr(payload)))
