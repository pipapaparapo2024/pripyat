"""Stage closed native PROD on loopback only. No DNS, schema, TEST or TG changes."""
from pathlib import Path
import importlib.util,base64,re
ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('p',ROOT/'tools/provision-new-server.py');p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
registry=(ROOT/'server/core/models/registry.example.php').read_text(encoding='utf-8-sig')
a=registry.index('        function __construct(){');b=registry.index('\n        function set(',a)
registry=registry[:a]+"        function __construct(){ require_once __DIR__.'/nativeprodregistrybootstrap.php'; NativeProdRegistryBootstrap::apply($this->vars); }\n"+registry[b:]
files={}
for folder in ['server/core','server/json']:
 for f in (ROOT/folder).rglob('*'):
  if f.is_file() and f.suffix in ['.php','.json'] and f.name not in ['registry.php','registry.example.php']:
   files[f.relative_to(ROOT).as_posix()]=base64.b64encode(f.read_bytes()).decode()
sources={'server/core/models/registry.php':None,'server/universal.php':'server/native-prod-gateway.php','server/universal-internal.php':'server/universal.php','server/native-entry.php':'server/native-prod-entry.php','server/universal_pay.php':'server/native-prod-vk-pay.php','server/ok_pay_callback.php':'server/native-prod-ok-pay.php','server/ok-pay-legacy-core.php':'server/ok_pay_callback.php','server/maintenance.html':'maintenance.html','server/client-shell.html':'_client/development/index.html'}
for dest,src in sources.items():
 data=registry.encode() if src is None else (ROOT/src).read_bytes()
 files[dest]=base64.b64encode(data).decode()
for f in (ROOT/'_client/development/libs').glob('*.js'):files['client/ver0_41/libs/'+f.name]=base64.b64encode(f.read_bytes()).decode()
files['server-fallback.png']=base64.b64encode((ROOT/'assets/images/2048 аватар заглушка.png').read_bytes()).decode()
maintenance_image=base64.b64encode((ROOT/'assets/images/maintenance-background.jpg').read_bytes()).decode()
p.remote('root',r'''
from pathlib import Path
import subprocess,json,base64,os,pwd,shutil,datetime,re
def run(args):
 r=subprocess.run(args,capture_output=True,text=True)
 if r.returncode:raise RuntimeError('Staging command failed: '+args[0]+'; private output suppressed')
 return r.stdout
base=Path('/var/www/stalker-native-prod');assert not base.exists(),'Refusing overwrite'
backup=Path('/var/backups')/('closed-native-prod-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));backup.mkdir(mode=0o700)
config=Path('/etc/pripyat/vk-ok-native-prod.json');c=json.loads(config.read_text());assert c['environment']=='prod' and str(c['api_id'])=='54574178' and c.get('api_secret')
shutil.copy2(config,backup/'config-before.json');(backup/'config-before.json').chmod(0o600)
for name,value in FILES.items():
 dest=base/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(base64.b64decode(value));dest.chmod(0o644)
 if name.endswith('.php'):run(['php','-l',str(dest)])
test=Path('/var/www/stalker-native-test');html=(test/'client/ver0_41/index.html').read_text();version=int(re.search(r'index\.js\?v=(\d+)',html)[1])+1
shell=base/'server/client-shell.html';text=shell.read_text(encoding='utf-8-sig');text=re.sub(r'index\.js\?v=\d+','index.js?v='+str(version),text);shell.write_text(text)
for name in ['images','sounds','fonts','spine']:
 shutil.copytree((test/'client/ver0_41'/name).resolve(),base/'client/ver0_41'/name,symlinks=False)
shutil.copytree((test/'server/images').resolve(),base/'server/images',symlinks=False)
background=base/'client/ver0_41/images/maintenance-background.jpg';background.write_bytes(base64.b64decode(IMAGE_PAYLOAD));background.chmod(0o644)
run(['useradd','--system','--no-create-home','--shell','/usr/sbin/nologin','pripyat-native-prod']);account=pwd.getpwnam('pripyat-native-prod')
all_db=json.loads(Path('/etc/pripyat/new-platform-databases.json').read_text());c['databases']={k:all_db[k] for k in ['stalker','stalker_ok']}
c['app_ids']={'vk':'54574178','ok':'512005669202'}
c['launch_app_ids']={'vk':'54574178','ok':'54574178'}
developers=['1113977365','382448269','438953352','184138040'];c['access']={'vk':{'ids':developers},'ok':{'ids':[],'native_ids':['587256562321']}}
c['enabled']=True;c['payments']={'vk_enabled':False,'ok_enabled':False};c['configuration_status']='closed_loopback_staged';c['credentials_verified']=False
config.write_text(json.dumps(c));os.chown(config,0,account.pw_gid);config.chmod(0o640)
log=base/'server/php_errors.log';log.touch();os.chown(log,account.pw_uid,account.pw_gid);log.chmod(0o600)
fpm=Path('/etc/pripyat/native-prod-fpm.conf');assert not fpm.exists()
fpm.write_text('[global]\npid = /run/php/pripyat-native-prod.pid\nerror_log = /var/log/pripyat-native-prod-fpm.log\ninclude = /etc/pripyat/native-prod-pool.conf\n')
Path('/etc/pripyat/native-prod-pool.conf').write_text('[pripyat-native-prod]\nuser = pripyat-native-prod\ngroup = pripyat-native-prod\nlisten = /run/php/pripyat-native-prod.sock\nlisten.owner = www-data\nlisten.group = www-data\nlisten.mode = 0660\npm = ondemand\npm.max_children = 4\npm.process_idle_timeout = 20s\nchdir = /var/www/stalker-native-prod/server\nenv[PRIPYAT_NATIVE_PROD_CONFIG] = /etc/pripyat/vk-ok-native-prod.json\nphp_admin_flag[display_errors] = off\nphp_admin_value[open_basedir] = /var/www/stalker-native-prod:/etc/pripyat/vk-ok-native-prod.json:/tmp\n')
unit=Path('/etc/systemd/system/pripyat-native-prod-fpm.service');assert not unit.exists()
unit.write_text('[Unit]\nDescription=Pripyat isolated native PROD PHP-FPM\nAfter=network.target mysql.service\n[Service]\nType=simple\nExecStart=/usr/sbin/php-fpm8.5 --nodaemonize --fpm-config /etc/pripyat/native-prod-fpm.conf\nExecReload=/bin/kill -USR2 $MAINPID\nRestart=on-failure\n[Install]\nWantedBy=multi-user.target\n')
site=Path('/etc/nginx/sites-available/pripyat-native-prod-staging');assert not site.exists()
locations=[]
for url,script in [('/client/ver0_41/','native-entry.php'),('/client/ver0_41/index.html','native-entry.php'),('/client/ver0_41/index.php','native-entry.php'),('/server/universal.php','universal.php'),('/server/universal_pay.php','universal_pay.php'),('/server/ok_pay_callback.php','ok_pay_callback.php')]:
 locations.append('location = '+url+' { include fastcgi_params; fastcgi_param SCRIPT_FILENAME /var/www/stalker-native-prod/server/'+script+'; fastcgi_pass unix:/run/php/pripyat-native-prod.sock; }')
site.write_text('log_format pripyat_native_prod \'$remote_addr [$time_local] "$request_method $uri $server_protocol" $status $body_bytes_sent\';\nserver {\n listen 127.0.0.1:8081;\n server_name pripyat-game.ru localhost;\n root /var/www/stalker-native-prod;\n access_log /var/log/nginx/pripyat-native-prod.access.log pripyat_native_prod;\n location = / { return 302 /client/ver0_41/$is_args$args; }\n'+'\n'.join(locations)+'\n location = /server/json/links.json { try_files $uri =404; }\n location = /server/json/donuts.json { try_files $uri =404; }\n location = /server/images/noicon.png { alias /var/www/stalker-native-prod/server-fallback.png; }\n location /server/images/ { try_files $uri =404; }\n location ~ \\.php$ { return 404; }\n location ~ /\\. { deny all; }\n location /server/ { return 404; }\n location / { try_files $uri $uri/ =404; }\n}\n')
Path('/etc/nginx/sites-enabled/pripyat-native-prod-staging').symlink_to(site)
definition,body=site.read_text().split('\n',1)
Path('/etc/nginx/conf.d/pripyat-native-prod-log-format.conf').write_text(definition+'\n');site.write_text(body)
run(['php-fpm8.5','-t','--fpm-config',str(fpm)]);run(['nginx','-t']);run(['systemctl','daemon-reload']);run(['systemctl','enable','--now','pripyat-native-prod-fpm']);run(['systemctl','reload','nginx'])
print(json.dumps({'closed_prod_staged':True,'version':version,'listen':'127.0.0.1:8081','worlds':list(c['databases']),'payments_enabled':False,'prod_database_writes':False,'dns_changed':False,'test_or_tg_changed':False,'backup':str(backup)}))
'''.replace('FILES',repr(files)).replace('IMAGE_PAYLOAD',repr(maintenance_image)))
