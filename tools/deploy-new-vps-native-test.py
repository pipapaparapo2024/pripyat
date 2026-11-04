"""Deploy VK/OK TEST only to new VPS. No DDL, PROD changes, or real payments."""
from pathlib import Path
import importlib.util,re,base64,json
ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('p',ROOT/'tools/provision-new-server.py');p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
registry=(ROOT/'server/core/models/registry.example.php').read_text(encoding='utf-8-sig')
start=registry.index('        function __construct(){');end=registry.index('\n        function set(',start)
constructor=r'''        function __construct(){
            $path=getenv('PRIPYAT_NATIVE_TEST_CONFIG');
            if(!$path||!is_file($path))throw new RuntimeException('test_disabled');
            $config=json_decode(file_get_contents($path),true,32,JSON_THROW_ON_ERROR);
            if(($config['enabled']??false)!==true||$config['environment']!=='test')throw new RuntimeException('test_disabled');
            require_once __DIR__.'/nativetestboundary.php';
            $platform=$_POST['platform']??'vk';$uid=$_POST['uid']??'';
            if(!is_string($platform)||!in_array($platform,['vk','ok'],true)||!is_string($uid)||!ctype_digit($uid))throw new InvalidArgumentException('invalid_platform');
            $name=$platform==='ok'?'stalker_ok_test':'stalker_test';$db=$config['databases'][$name];
            if($db['database']!==$name)throw new RuntimeException('database_mismatch');
            if(($_POST['method']??'')==='security.getToken'){
                $raw=$_POST['params']??'';
                if(!is_string($raw)||strlen($raw)>32768)throw new InvalidArgumentException('invalid_launch');
                $launch=json_decode(base64_decode(base64_decode(spec_decode($raw))),true,32,JSON_THROW_ON_ERROR);
                if(!is_array($launch))throw new InvalidArgumentException('invalid_launch');
                NativeTestBoundary::resolve($launch,$platform,$uid,$config['api_secret'],$config['access'],time(),(string)$config['api_id']);
            } else {
                // Native tokens are scoped to a TEST DB; validate the saved signed platform too.
                $pdo=new PDO('mysql:host=127.0.0.1;dbname='.$name.';charset=utf8mb4',$db['user'],$db['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
                $q=$pdo->prepare('SELECT vk_params FROM secure WHERE id=?');$q->execute([$uid]);$saved=$q->fetchColumn();
                if($saved===false)throw new InvalidArgumentException('login_required');
                $launch=json_decode($saved,true,32,JSON_THROW_ON_ERROR);
                // Session expiry is checked by universal.php; launch can be older than a day.
                $ts=(string)($launch['vk_ts']??'');$when=($platform==='ok'&&strlen($ts)===13)?intdiv((int)$ts,1000):(int)$ts;
                NativeTestBoundary::resolve($launch,$platform,$uid,$config['api_secret'],$config['access'],$when,(string)$config['api_id']);
            }
            foreach(['api_id','api_secret','api_service'] as $key)$this->vars[$key]=$config[$key];
            $this->vars['server']='127.0.0.1';$this->vars['db']=$name;$this->vars['user']=$db['user'];$this->vars['pass']=$db['password'];$this->vars['platform']=$platform;
        }
'''
registry=registry[:start]+constructor+registry[end:]
files={}
for f in (ROOT/'server').rglob('*'):
 if f.is_file() and f.suffix in ['.php','.json'] and f.name not in ['registry.php','registry.example.php','universal_pay.php','ok_pay_callback.php'] and not f.name.startswith(('migrate','reset_','dev_')):files[f.relative_to(ROOT).as_posix()]=base64.b64encode(f.read_bytes()).decode()
files['server/core/models/registry.php']=base64.b64encode(registry.encode()).decode()
gateway="""<?php
chdir(__DIR__);
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'){http_response_code(405);exit;}
$method=$_POST['method']??'';
require_once __DIR__.'/core/models/nativetestmethodpolicy.php';
if(!NativeTestMethodPolicy::allows($method)){http_response_code(403);exit;}
try{require __DIR__.'/universal-internal.php';}
catch(InvalidArgumentException $e){$reason=in_array($e->getMessage(),['app_id_mismatch','invalid_launch','platform_mismatch','uid_mismatch','invalid_launch_time','expired_launch','closed_test_access_denied','login_required','invalid_platform'],true)?$e->getMessage():'request_rejected';error_log('[native-test] auth_rejected reason='.$reason);http_response_code(403);header('Content-Type: application/json');echo json_encode(['status'=>'error','code'=>47,'reason'=>$reason,'text'=>$reason==='app_id_mismatch'?'На TEST настроено другое приложение ВК. Сообщите разработчику.':'Не удалось подтвердить вход в TEST.']);}
catch(Throwable $e){http_response_code(503);error_log('[native-test] request_failed type='.get_class($e));header('Content-Type: application/json');echo json_encode(['status'=>'error','code'=>99,'text'=>'Не удалось выполнить действие.']);}
"""
files['server/universal-internal.php']=files.pop('server/universal.php');files['server/universal.php']=base64.b64encode(gateway.encode()).decode()
files['server-fallback.png']=base64.b64encode((ROOT/'assets/images/2048 аватар заглушка.png').read_bytes()).decode()
for f in (ROOT/'_client/development/libs').glob('*.js'):files['client/ver0_41/libs/'+f.name]=base64.b64encode(f.read_bytes()).decode()
html=(ROOT/'_client/development/index.html').read_text(encoding='utf-8-sig');version=int(re.search(r'index\.js\?v=(\d+)',html)[1])+1
html=re.sub(r'index\.js\?v=\d+','index.js?v='+str(version),html).replace('</head>','<script>window.__nativeTestPaymentsDisabled=true;</script></head>');files['client/ver0_41/index.html']=base64.b64encode(html.encode()).decode()
p.remote('root',r'''
from pathlib import Path
import subprocess,json,base64,os,pwd,shutil,datetime
def run(args):
 r=subprocess.run(args,capture_output=True,text=True)
 if r.returncode:raise RuntimeError('Command failed: '+args[0]+'; private diagnostics suppressed')
 return r.stdout
base=Path('/var/www/stalker-native-test');assert not base.exists(),'Refusing overwrite'
backup=Path('/var/backups')/('pripyat-native-test-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));backup.mkdir(mode=0o700)
for name,value in FILES.items():
 dest=base/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(base64.b64decode(value));dest.chmod(0o644)
 if name.endswith('.php'):run(['php','-l',str(dest)])
tg=Path('/var/www/stalker-tg-test/public')
for name in ['images','sounds','spine','fonts']:
 (base/'client/ver0_41'/name).symlink_to(tg/name,target_is_directory=True)
source=tg/'server/images';dest=base/'server/images'
if source.is_dir():dest.symlink_to(source,target_is_directory=True)
run(['useradd','--system','--no-create-home','--shell','/usr/sbin/nologin','pripyat-native-test']);account=pwd.getpwnam('pripyat-native-test')
private=Path('/etc/pripyat');config=private/'vk-ok-native-test.json';shutil.copy2(config,backup/'config-before.json');(backup/'config-before.json').chmod(0o600)
c=json.loads(config.read_text());c['databases']={k:v for k,v in json.loads((private/'test-platform-databases.json').read_text()).items() if k in ['stalker_test','stalker_ok_test']};c['access']=json.loads((private/'closed-test-access.json').read_text());c['enabled']=True
config.write_text(json.dumps(c));os.chown(config,0,account.pw_gid);config.chmod(0o640)
log=base/'server/php_errors.log';log.touch();os.chown(log,account.pw_uid,account.pw_gid);log.chmod(0o600)
pool=Path('/etc/php/8.5/fpm/pool.d/pripyat-native-test.conf');assert not pool.exists();pool.write_text('[pripyat-native-test]\nuser = pripyat-native-test\ngroup = pripyat-native-test\nlisten = /run/php/php8.5-fpm-native-test.sock\nlisten.owner = www-data\nlisten.group = www-data\nlisten.mode = 0660\npm = ondemand\npm.max_children = 4\npm.process_idle_timeout = 20s\nchdir = /var/www/stalker-native-test/server\nenv[PRIPYAT_NATIVE_TEST_CONFIG] = /etc/pripyat/vk-ok-native-test.json\nphp_admin_flag[display_errors] = off\nphp_admin_value[open_basedir] = /var/www/stalker-native-test:/etc/pripyat/vk-ok-native-test.json:/tmp\n')
site=Path('/etc/nginx/sites-available/test-pripyat-game.ru');assert not site.exists()
site.write_text("""server {
 listen 80;
 listen [::]:80;
 server_name test-pripyat-game.ru;
 root /var/www/stalker-native-test;
 location = / { return 302 /client/ver0_41/index.html; }
 location = /server/universal.php { include snippets/fastcgi-php.conf; fastcgi_pass unix:/run/php/php8.5-fpm-native-test.sock; }
 location = /server/json/links.json { try_files $uri =404; }
 location = /server/json/donuts.json { try_files $uri =404; }
 location /server/images/ { try_files $uri =404; }
 location = /server/images/noicon.png { alias /var/www/stalker-native-test/server-fallback.png; }
 location ~ \\.php$ { return 404; }
 location ~ /\\. { deny all; }
 location /server/ { return 404; }
 location / { try_files $uri $uri/ =404; }
}
""");Path('/etc/nginx/sites-enabled/test-pripyat-game.ru').symlink_to(site)
run(['php-fpm8.5','-t']);run(['nginx','-t']);run(['systemctl','reload','php8.5-fpm']);run(['systemctl','reload','nginx'])
print(json.dumps({'native_test_deployed':True,'version':VERSION,'files':len(FILES),'databases':list(c['databases']),'payments_enabled':False,'sql_ddl':False,'prod_changed':False,'backup':str(backup)}))
'''.replace('FILES',repr(files)).replace('VERSION',str(version)))
