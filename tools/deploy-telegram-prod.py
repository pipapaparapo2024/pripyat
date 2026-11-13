"""Publish the authorized Telegram PROD bot using the reviewed TEST runtime and separate PROD DB."""
from pathlib import Path
import base64
import importlib.util
import json
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('provision',ROOT/'tools/provision-new-server.py')
provision=importlib.util.module_from_spec(spec)
spec.loader.exec_module(provision)
files={}
for path in (ROOT/'server/core/models').glob('telegram*.php'):
    files['server/core/models/'+path.name]=base64.b64encode(path.read_bytes()).decode()
for name in ['telegram-login.php','telegram-api.php','telegram-bot.php']:
    files['server/'+name]=base64.b64encode((ROOT/'server'/name).read_bytes()).decode()
for path in (ROOT/'_client/telegram-build/libs').glob('*.js'):
    files['libs/'+path.name]=base64.b64encode(path.read_bytes()).decode()
assert 'libs/index.js' in files
REMOTE=r"""
from pathlib import Path
import base64,datetime,hashlib,json,os,pwd,re,secrets,shutil,subprocess,tempfile
FILES=PAYLOAD
def run(args,body=None):
    result=subprocess.run(args,input=body,capture_output=True,text=True)
    if result.returncode:raise RuntimeError('Failed '+args[0]+'; private diagnostics suppressed')
    return result.stdout.strip()
def sql(query):return run(['mysql','-N','--raw'],query)
def write_private(path,data,gid=0):
    fd,tmp=tempfile.mkstemp(prefix='.'+path.name,dir=path.parent)
    try:
        os.fchmod(fd,0o640 if gid else 0o600);os.fchown(fd,0,gid)
        with os.fdopen(fd,'w') as stream:stream.write(data)
        os.replace(tmp,path)
    finally:
        if os.path.exists(tmp):os.unlink(tmp)
root=Path('/var/www/stalker-tg-prod')
assert not root.exists(),'PROD runtime already exists; use a reviewed incremental release'
source=Path('/var/www/stalker-tg-test/public')
assert source.is_dir()
private=Path('/etc/pripyat')
token_file=private/'telegram-prod-token.json'
if not token_file.is_file():token_file=private/'telegram-prod-bot.json'
bot=json.loads(token_file.read_text())
token=bot['bot_token']
probe=run(['curl','--silent','--fail','--noproxy','*','--max-time','15',
    '--connect-to','api.telegram.org:443:127.0.0.1:10443','--config','-'],
    'url = "https://api.telegram.org/bot'+token+'/getMe"\n')
identity=json.loads(probe)
assert identity.get('ok') and identity['result']['username']=='pripyat_game_bot'
backup=Path('/var/backups')/('telegram-prod-launch-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
backup.mkdir(mode=0o700)
database='stalker_telegram'
assert sql('SELECT COUNT(*) FROM stalker_telegram.users')=='0'
before=sql("SELECT table_name FROM information_schema.tables WHERE table_schema='stalker_telegram' ORDER BY table_name").splitlines()
definitions={t:sql('SHOW CREATE TABLE stalker_telegram.'+t) for t in before}
with (backup/'database-before.sql').open('w') as stream:
    result=subprocess.run(['mysqldump','--single-transaction','--routines','--triggers',database],stdout=stream,stderr=subprocess.PIPE)
    assert result.returncode==0
(backup/'database-before.sql').chmod(0o600)
created=[]
for table in ['game_friend_requests','site_payment_orders','site_payment_receipts']:
    if table in before:continue
    ddl=sql('SHOW CREATE TABLE stalker_telegram_test.'+table).split('\t',1)[1]
    ddl=re.sub(r' AUTO_INCREMENT=\d+','',ddl)
    assert 'stalker_telegram_test' not in ddl
    sql('USE stalker_telegram; '+ddl+';')
    created.append(table)
assert all(sql('SHOW CREATE TABLE stalker_telegram.'+t)==definitions[t] for t in before)
account_name='pripyat-tg-prod'
try:account=pwd.getpwnam(account_name)
except KeyError:
    run(['useradd','--system','--no-create-home','--shell','/usr/sbin/nologin',account_name])
    account=pwd.getpwnam(account_name)
stage=backup/'runtime'
shutil.copytree(source,stage,ignore=shutil.ignore_patterns('telegram-avatars','*.log','*.stamp','*.lock','*.tmp','registry.php'))
for name,value in FILES.items():
    target=stage/name
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_bytes(base64.b64decode(value));target.chmod(0o644)
html=(stage/'index.html').read_text()
html=re.sub(r'libs/index\.js\?v=[^"\s]+','libs/index.js?v='+hashlib.sha256((stage/'libs/index.js').read_bytes()).hexdigest()[:12],html)
html=html.replace('https://tg-test-pripyat-game.ru/','https://pripyat-game-site.ru/telegram/')
(stage/'index.html').write_text(html)
avatar_dir=stage/'images/telegram-avatars';avatar_dir.mkdir(mode=0o755,exist_ok=True)
os.chown(avatar_dir,account.pw_uid,account.pw_gid)
for path in stage.rglob('*.php'):run(['php','-l',str(path)])
db=json.loads((private/'new-platform-databases.json').read_text())[database]
assert db['database']==database and db['host']=='127.0.0.1'
live=json.loads((private/'yookassa-live.json').read_text())
runtime=json.loads(Path('/var/www/pripyat-site/private/site-runtime.json').read_text())
payment=dict(runtime['payments'])
assert str(payment['shop_id'])==str(live['shop_id']) and payment['secret_key']==live['secret_key']
assert payment['require_test_payment'] is False and payment['receipt_mode']=='npdcheck'
config={'enabled':True,'environment':'prod','database':database,'bot_username':'pripyat_game_bot',
    'bot_token':token,'db_user':db['user'],'db_password':db['password'],'bot_api_environment':'production',
    'bot_api_relay_port':10443,'stars_enabled':True,'webhook_secret':secrets.token_urlsafe(40),
    'website_rub_payments':payment}
config_path=private/'telegram-prod.php'
assert not config_path.exists()
payload=base64.b64encode(json.dumps(config).encode()).decode()
write_private(config_path,"<?php return json_decode(base64_decode('"+payload+"'),true);",account.pw_gid)
state=Path('/var/lib/pripyat-tg-prod')
for directory in [state,state/'bot-updates',Path('/var/log/pripyat-tg-prod')]:
    directory.mkdir(mode=0o700,exist_ok=True);os.chown(directory,account.pw_uid,account.pw_gid)
write_private(state/'access.json',json.dumps({'allowed':[]}),account.pw_gid)
os.chown(state/'access.json',account.pw_uid,account.pw_gid)
pool=Path('/etc/php/8.5/fpm/pool.d/pripyat-tg-prod.conf')
assert not pool.exists()
pool.write_text('''[pripyat-tg-prod]
user = pripyat-tg-prod
group = pripyat-tg-prod
listen = /run/php/php8.5-fpm-tg-prod.sock
listen.owner = www-data
listen.group = www-data
listen.mode = 0660
pm = ondemand
pm.max_children = 8
pm.process_idle_timeout = 20s
chdir = /var/www/stalker-tg-prod/public/server
env[PRIPYAT_TELEGRAM_CONFIG] = /etc/pripyat/telegram-prod.php
php_admin_flag[display_errors] = off
php_admin_flag[log_errors] = on
php_admin_value[error_log] = /var/log/pripyat-tg-prod/php.log
php_admin_value[open_basedir] = /var/www/stalker-tg-prod:/etc/pripyat/telegram-prod.php:/var/log/pripyat-tg-prod:/var/lib/pripyat-tg-prod:/tmp
''')
nginx=Path('/etc/nginx/sites-available/pripyat-site')
original=nginx.read_text()
(backup/'nginx-before.conf').write_text(original)
routes=[]
for name in ['telegram-login','telegram-api','telegram-bot']:
    routes.append(' location = /telegram/server/'+name+'.php {\n  access_log off;\n  include fastcgi_params;\n  fastcgi_param SCRIPT_FILENAME /var/www/stalker-tg-prod/public/server/'+name+'.php;\n  fastcgi_pass unix:/run/php/php8.5-fpm-tg-prod.sock;\n }')
routes+=[' location = /telegram { return 302 /telegram/; }',
 ' location = /telegram/server/json/links.json { alias /var/www/stalker-tg-prod/public/server/json/links.json; }',
 ' location = /telegram/server/json/donuts.json { alias /var/www/stalker-tg-prod/public/server/json/donuts.json; }',
 ' location ^~ /telegram/server/images/ { alias /var/www/stalker-tg-prod/public/server/images/; }',
 ' location ^~ /telegram/server/ { return 404; }',
 ' location ^~ /telegram/ {\n  alias /var/www/stalker-tg-prod/public/;\n  index index.html;\n  location ~ \\.(?:php|log|stamp|lock|tmp)$ { return 404; }\n }']
marker=' location = /game {'
assert original.count(marker)==1 and '/telegram/server/telegram-login.php' not in original
root.mkdir(mode=0o755)
shutil.move(str(stage),str(root/'public'))
try:
    nginx.write_text(original.replace(marker,'\n'.join(routes)+'\n'+marker,1))
    run(['php-fpm8.5','-t']);run(['nginx','-t'])
    run(['systemctl','reload','php8.5-fpm']);run(['systemctl','reload','nginx'])
except Exception:
    nginx.write_text(original)
    raise
# Verify public paths before registering the webhook and menu.
run(['curl','--fail','--silent','--show-error','--max-time','15','https://pripyat-game-site.ru/telegram/'])
php='''<?php
require '/var/www/stalker-tg-prod/public/server/core/models/telegrambotclient.php';
$c=require '/etc/pripyat/telegram-prod.php';
$bot=new TelegramBotClient($c['bot_token'],'production',null,10443);
$me=$bot->call('getMe',[]);
if($me['username']!=='pripyat_game_bot')throw new RuntimeException('wrong_bot');
$before=$bot->call('getWebhookInfo',[]);
file_put_contents(BACKUP.'/webhook-before.json',json_encode($before));
chmod(BACKUP.'/webhook-before.json',0600);
$bot->call('setWebhook',['url'=>'https://pripyat-game-site.ru/telegram/server/telegram-bot.php',
 'secret_token'=>$c['webhook_secret'],'allowed_updates'=>['message','callback_query','pre_checkout_query']]);
$bot->call('setChatMenuButton',['menu_button'=>['type'=>'web_app','text'=>'Играть','web_app'=>['url'=>'https://pripyat-game-site.ru/telegram/']]]);
$test=require '/etc/pripyat/telegram-test.php';
$testBot=new TelegramBotClient($test['bot_token'],'production',null,10443);
$commands=$testBot->call('getMyCommands',[]);
if($commands)$bot->call('setMyCommands',['commands'=>$commands]);
$ownerCommands=array_merge($commands,[['command'=>'supportplayers','description'=>'Управление помощниками поддержки'],['command'=>'supportread','description'=>'Прочитать обращение'],['command'=>'supportreply','description'=>'Ответить на обращение'],['command'=>'paymentlist','description'=>'Последние Stars-платежи'],['command'=>'refund','description'=>'Подтверждённый возврат Stars']]);
$bot->call('setMyCommands',['scope'=>['type'=>'chat','chat_id'=>1355806786],'commands'=>$ownerCommands]);
$description=$testBot->call('getMyDescription',[]);
if(!empty($description['description']))$bot->call('setMyDescription',['description'=>$description['description']]);
$short=$testBot->call('getMyShortDescription',[]);
if(!empty($short['short_description']))$bot->call('setMyShortDescription',['short_description'=>$short['short_description']]);
$after=$bot->call('getWebhookInfo',[]);
if(($after['url']??'')!=='https://pripyat-game-site.ru/telegram/server/telegram-bot.php')throw new RuntimeException('webhook_mismatch');
echo json_encode(['bot'=>$me['username'],'webhook'=>'registered','commands'=>count($commands),'pending_updates'=>$after['pending_update_count']??null]);
'''.replace('BACKUP',repr(str(backup)))
bot_result=json.loads(run(['php'],php))
print(json.dumps({'backup':str(backup),'database':database,'new_tables':created,'bot':bot_result,
 'url':'https://pripyat-game-site.ru/telegram/','stars_enabled':True,'website_live_shop_credentials':'reused_privately',
 'website_prod_login':'requires_separate_oidc_credentials','test_runtime_changed':False}))
""".replace('PAYLOAD',repr(files))
provision.remote('root',REMOTE)
