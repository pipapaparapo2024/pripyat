"""Publish the owner-only Telegram website-login check to TEST, never PROD."""
from pathlib import Path
import base64, hashlib, importlib.util, json, secrets, time, urllib.error, urllib.parse, urllib.request

ROOT=Path(__file__).resolve().parents[1]
OWNER='1355806786'
HOST='https://pripyat-game-site.ru'
expires=int(time.time())+23*60*60
ticket=secrets.token_urlsafe(32)
ticket_hash=hashlib.sha256(ticket.encode()).hexdigest()
spec=importlib.util.spec_from_file_location('provision',ROOT/'tools/provision-new-server.py')
provision=importlib.util.module_from_spec(spec);spec.loader.exec_module(provision)
files={
    'app/auth.php':ROOT/'website/app/auth.php',
    'app/telegramoidc.php':ROOT/'server/core/models/telegramoidc.php',
    'app/telegramauth.php':ROOT/'server/core/models/telegramauth.php',
    'app/telegramenvironment.php':ROOT/'server/core/models/telegramenvironment.php',
    'app/telegramwebsitepayments.php':ROOT/'website/app/telegramwebsitepayments.php',
    'app/sitepayments.php':ROOT/'website/app/sitepayments.php',
    'app/siteyookassa.php':ROOT/'website/app/siteyookassa.php',
    'app/telegramwebsitetestaccess.php':ROOT/'server/core/models/telegramwebsitetestaccess.php',
    'app/telegramplayerlock.php':ROOT/'server/core/models/telegramplayerlock.php',
    'app/telegramloginstore.php':ROOT/'server/core/models/telegramloginstore.php',
    'public/telegram-login-test.html':ROOT/'website/telegram-login-test.html',
    'public/telegram-login-test.js':ROOT/'website/telegram-login-test.js',
    'public/telegram-payment-return.html':ROOT/'website/telegram-payment-return.html',
}
build=ROOT/'_client/website-build/libs'
scripts=sorted(build.glob('*.js'))
entry=build/'index.js'
assert entry in scripts and b'/auth/telegram' in entry.read_bytes(), 'Run npm run build:website first'
version=hashlib.sha256(b''.join(hashlib.sha256(path.read_bytes()).digest() for path in scripts)).hexdigest()[:16]
bundle='telegram-website-'+version
files.update({f'game-libs/{bundle}/{path.name}':path for path in scripts})
payload={name:base64.b64encode(path.read_bytes()).decode() for name,path in files.items()}
remote=r'''
from pathlib import Path
import base64,datetime,hashlib,json,os,pwd,re,shutil,subprocess,tempfile
FILES=PAYLOAD
BUNDLE=BUNDLE_VALUE
TICKET_HASH=TICKET_HASH_VALUE
TICKET_EXPIRES=TICKET_EXPIRES_VALUE
OWNER_ID=OWNER_VALUE
base=Path('/var/www/pripyat-site');private=Path('/etc/pripyat')
config=private/'website-auth-test.json';gameconfig=private/'website-game-test.php'
diagnostics=Path('/var/lib/pripyat-site-test/website-auth-diagnostics.log')
nginx=Path('/etc/nginx/sites-available/pripyat-site')
assert base.is_dir() and config.is_file() and gameconfig.is_file() and nginx.is_file()
site=json.loads(config.read_text());tg=site.get('telegram',{})
game=subprocess.run(['php','-r',"$c=require '/etc/pripyat/website-game-test.php';echo json_encode(['token'=>$c['bot_token']??'','environment'=>$c['environment']??'','database'=>$c['database']??'']);"],capture_output=True,text=True,check=True)
gc=json.loads(game.stdout);botid=gc['token'].split(':',1)[0]
assert gc['environment']=='test' and gc['database']=='stalker_telegram_test'
assert str(tg.get('client_id',''))==botid and len(tg.get('client_secret',''))>=16
assert tg.get('redirect_uri')=='https://pripyat-game-site.ru/auth/telegram/callback'
probe=subprocess.run(['curl','--noproxy','*','--compressed','--fail','--silent','--show-error','--max-time','12','--connect-to','oauth.telegram.org:443:127.0.0.1:10444','https://oauth.telegram.org/.well-known/jwks.json'],capture_output=True,text=True,check=True)
jwks=json.loads(probe.stdout);assert isinstance(jwks.get('keys'),list) and jwks['keys']
game_html=(base/'game/index.html').read_text(encoding='utf-8')
game_html,count=re.subn(r'(?<=src="\./libs/)index\.js\?v=[^"]+',BUNDLE+'/index.js',game_html)
assert count==1
FILES['game/telegram-test.html']=base64.b64encode(game_html.encode('utf-8')).decode()
backup=Path('/var/backups')/('pripyat-telegram-website-login-test-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
backup.mkdir(mode=0o700)
changed=[config,nginx,diagnostics]+[base/name for name in FILES]
misplaced=[base/'telegram-login-test.html',base/'telegram-login-test.js']
changed+=misplaced
original_meta={str(source):(source.stat().st_uid,source.stat().st_gid,source.stat().st_mode&0o777) for source in changed if source.exists()}
for source in changed:
    if source.exists():
        target=backup/source.relative_to('/');target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,target);target.chmod(0o600)
site['enabled']=True
site.setdefault('access',{})['telegram']={'mode':'allowlist','ids':[OWNER_ID]}
tg=site.setdefault('telegram',{});tg['enabled']=True;tg['oauth_relay_port']=10444;tg['test_access_hash']=TICKET_HASH;tg['test_access_expires_at']=TICKET_EXPIRES
payment_config=json.loads((private/'yookassa-test.json').read_text())
assert payment_config.get('require_test_payment') is True and payment_config.get('secret_key','').startswith('test_')
tg['website_rub_payments']=dict(payment_config,enabled=True,require_test_payment=True)
site['telegram']=tg
user=pwd.getpwnam('pripyat-site-test')
def atomic(path,data,mode=0o644,uid=0,gid=0):
    fd,tmp=tempfile.mkstemp(prefix='.'+path.name+'.',dir=path.parent)
    try:
        with os.fdopen(fd,'wb') as stream:stream.write(data);stream.flush();os.fsync(stream.fileno())
        os.chmod(tmp,mode);os.chown(tmp,uid,gid);os.replace(tmp,path)
    finally:
        if os.path.exists(tmp):os.unlink(tmp)
try:
    (base/'game-libs'/BUNDLE).mkdir(mode=0o755,exist_ok=True)
    for name,value in FILES.items():atomic(base/name,base64.b64decode(value))
    if not diagnostics.exists():atomic(diagnostics,b'',0o660,0,user.pw_gid)
    else:
        os.chown(diagnostics,0,user.pw_gid);os.chmod(diagnostics,0o660)
    for old,key in zip(misplaced,['public/telegram-login-test.html','public/telegram-login-test.js']):
        if old.exists():
            expected=hashlib.sha256(base64.b64decode(FILES[key])).hexdigest()
            assert hashlib.sha256(old.read_bytes()).hexdigest()==expected
            old.unlink()
    old_route_header=' location ~ ^/auth/telegram/(status|test-access|bootstrap|logout|start|callback)$ {'
    route_header=' location ~ ^/auth/telegram/(status|test-access|bootstrap|logout|start|callback|payment-create|payment-status|payment-notification)$ {'
    route=route_header+'\n  access_log off;\n  add_header X-Content-Type-Options nosniff always;\n  add_header Referrer-Policy no-referrer always;\n  include fastcgi_params;\n  fastcgi_param SCRIPT_FILENAME /var/www/pripyat-site/app/auth.php;\n  fastcgi_pass unix:/run/php/php8.5-fpm-site-test.sock;\n }'
    marker=' location ~ ^/auth/(status|bootstrap|logout|telegram/start|telegram/callback)$ {'
    text=nginx.read_text().replace(old_route_header,route_header,1)
    if route_header not in text:
        assert marker in text
        text=text.replace(marker,route+'\n'+marker,1)
    else:
        start=text.index(route_header);end=text.index('\n }',start)+3
        existing=text[start:end]
        if 'access_log off;' not in existing:text=text[:start]+existing.replace(route_header,route_header+'\n  access_log off;',1)+text[end:]
        start=text.index(route_header);end=text.index('\n }',start)+3;existing=text[start:end]
        for directive in ['add_header X-Content-Type-Options nosniff always;','add_header Referrer-Policy no-referrer always;']:
            if directive not in existing:existing=existing.replace(route_header,route_header+'\n  '+directive,1);route_header=route_header
        text=text[:start]+existing+text[end:]
    game_route=' location = /game/telegram-test.html { alias /var/www/pripyat-site/game/telegram-test.html; }'
    if game_route not in text:
        game_marker=' location = /game/index.html {'
        assert game_marker in text
        text=text.replace(game_marker,game_route+'\n'+game_marker,1)
    atomic(nginx,text.encode())
    atomic(config,(json.dumps(site,indent=2)+'\n').encode(),0o640,0,user.pw_gid)
    for name in FILES:
        if name.endswith('.php'):
            subprocess.run(['php','-l',str(base/name)],capture_output=True,text=True,check=True)
    subprocess.run(['php-fpm8.5','-t'],capture_output=True,text=True,check=True)
    subprocess.run(['nginx','-t'],capture_output=True,text=True,check=True)
    subprocess.run(['systemctl','reload','php8.5-fpm'],capture_output=True,text=True,check=True)
    subprocess.run(['systemctl','reload','nginx'],capture_output=True,text=True,check=True)
except Exception:
    for source in changed:
        old=backup/source.relative_to('/')
        if old.exists():
            data=old.read_bytes();uid,gid,mode=original_meta[str(source)]
            atomic(source,data,mode,uid,gid)
        elif source.exists():source.unlink()
    subprocess.run(['php-fpm8.5','-t'],capture_output=True);subprocess.run(['nginx','-t'],capture_output=True)
    subprocess.run(['systemctl','reload','php8.5-fpm'],capture_output=True);subprocess.run(['systemctl','reload','nginx'],capture_output=True)
    raise
print(json.dumps({'environment':'website-test','owner_only_telegram_id':OWNER_ID,'site_auth_enabled':True,'telegram_auth_enabled':True,'oauth_relay':'10444','jwks_via_relay':'verified','status_route':'installed','owner_test_ticket_expires':TICKET_EXPIRES,'sql_changed':False,'prod_changed':False,'github_changed':False,'backup':str(backup)}))
'''.replace('PAYLOAD',repr(payload)).replace('BUNDLE_VALUE',repr(bundle)).replace('TICKET_HASH_VALUE',repr(ticket_hash)).replace('TICKET_EXPIRES_VALUE',str(expires)).replace('OWNER_VALUE',repr(OWNER))
provision.remote('root',remote)

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):return None
jar=urllib.request.HTTPCookieProcessor()
opener=urllib.request.build_opener(jar,NoRedirect())
def request(path,data=None,headers=None):
    req=urllib.request.Request(HOST+path,data=data,headers=headers or {},method='POST' if data is not None else 'GET')
    try:
        with opener.open(req,timeout=20) as response:return response.status,response.headers, response.read()
    except urllib.error.HTTPError as response:return response.code,response.headers,response.read()
status,_,body=request('/auth/telegram/status');assert status==200
csrf=json.loads(body)['csrf']
blocked,_,_=request('/auth/telegram/start');assert blocked==403
blocked_payment,_,_=request('/auth/telegram/payment-create');assert blocked_payment==405
form=urllib.parse.urlencode({'csrf':csrf,'ticket':ticket}).encode()
headers={'Origin':HOST,'Content-Type':'application/x-www-form-urlencoded'}
granted,_,body=request('/auth/telegram/test-access',form,headers);assert granted==200 and json.loads(body).get('authorized') is True
visible,_,body=request('/auth/telegram/status');assert visible==200 and json.loads(body)['providers']['telegram'] is True
rejected,_,body=request('/auth/telegram/callback?code=smoke&state=smoke')
failure=json.loads(body)
assert rejected==401 and failure.get('error')=='authentication_rejected'
reference=failure['reference']
assert len(reference)==16 and all(c in '0123456789abcdef' for c in reference)
provision.remote('root',f"""
from pathlib import Path
lines=Path('/var/lib/pripyat-site-test/website-auth-diagnostics.log').read_text().splitlines()
assert any('reference={reference} event=rejected stage=callback_state ' in line and 'reason=invalid_oidc_state' in line for line in lines)
print('Verified diagnostic reference: {reference}')
""")
started,headers,_=request('/auth/telegram/start');location=headers.get('Location','')
assert started==302 and location.startswith('https://oauth.telegram.org/auth?')
query=urllib.parse.parse_qs(urllib.parse.urlsplit(location).query)
assert query.get('redirect_uri')==['https://pripyat-game-site.ru/auth/telegram/callback'] and query.get('code_challenge_method')==['S256']
assert query.get('state') and 'nonce' not in query
page,_,html=request('/telegram-login-test.html');assert page==200 and b'telegram-test-login' in html
script,_,js=request('/telegram-login-test.js?v=20261109-1');assert script==200 and b'telegram/test-access' in js
game_page,_,game_html=request('/game/telegram-test.html?auth=telegram')
assert game_page==200 and ('./libs/'+bundle+'/index.js').encode() in game_html
for path in scripts:
    status,_,body=request('/game/libs/'+bundle+'/'+path.name)
    assert status==200 and hashlib.sha256(body).digest()==hashlib.sha256(path.read_bytes()).digest()
print(json.dumps({'live_status_route':'200','public_without_grant':'hidden_and_start_blocked','private_ticket':'redeemed','owner_test_page':'enabled_in_owner_session','oauth_start':'302_to_Telegram_with_PKCE','manual_Telegram_identity_login':'still_required','test_url':'https://pripyat-game-site.ru/telegram-login-test.html#tg_test='+ticket},ensure_ascii=False))
