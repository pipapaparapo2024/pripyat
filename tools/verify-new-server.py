"""Read-only verification of the isolated new VPS, never old production."""
from pathlib import Path
import importlib.util,subprocess,urllib.request,urllib.error,socket,json
ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('provision',ROOT/'tools/provision-new-server.py');p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
for user in ['pripyat-admin','root']:
    subprocess.run(p.SSH+[user+'@'+p.HOST,'sudo -n true'],check=True,capture_output=True)
    print('Fresh SSH key login and sudo passed:',user)
code=r'''
from pathlib import Path
import subprocess,json,stat,gzip
def run(args):return subprocess.check_output(args,text=True,stderr=subprocess.STDOUT)
for service in ['ssh','nginx','php8.5-fpm','mysql','fail2ban','chrony']:assert run(['systemctl','is-active',service]).strip()=='active',service
ssh=run(['sshd','-T']);assert 'passwordauthentication no' in ssh and 'kbdinteractiveauthentication no' in ssh and 'permitrootlogin prohibit-password' in ssh
listeners=run(['ss','-lnt']);assert '127.0.0.1:3306' in listeners and '0.0.0.0:3306 ' not in listeners and '[::]:3306 ' not in listeners
assert 'Status: active' in run(['ufw','status'])
for args in [['nginx','-t'],['php-fpm8.5','-t'],['mysqld','--validate-config']]:run(args)
health=json.loads(run(['curl','--fail','--silent','http://127.0.0.1/__bootstrap_php_health']));assert health['mysql_driver']
config=Path('/etc/pripyat/vk-september-restore.json');assert stat.S_IMODE(config.stat().st_mode)==0o600
php=r"""<?php
$c=json_decode(file_get_contents('/etc/pripyat/vk-september-restore.json'),true);
$db=new PDO('mysql:host=127.0.0.1;port=3306;dbname='.$c['database'].';charset=utf8mb4',$c['user'],$c['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
if((int)$db->query('SELECT COUNT(*) FROM users')->fetchColumn()!==6)throw new RuntimeException('Count mismatch');
$denied=false;try{$db->query('SELECT User FROM mysql.user');}catch(PDOException $e){$denied=true;}
if(!$denied)throw new RuntimeException('Excessive SQL access');
foreach($db->query('SHOW GRANTS FOR CURRENT_USER')->fetchAll(PDO::FETCH_COLUMN) as $g){
 if(preg_match('/\b(ALL PRIVILEGES|CREATE|ALTER|DROP|GRANT OPTION|FILE|SUPER)\b/',$g))throw new RuntimeException('Excessive grants');
}
echo "Restricted MySQL application account verified";
"""
r=subprocess.run(['php'],input=php,text=True,capture_output=True);assert r.returncode==0,'Private PDO/account verification failed'
backups=list(Path('/var/backups/pripyat-database').glob('vk-*.sql.gz'));assert backups
latest=max(backups,key=lambda f:f.stat().st_mtime)
with gzip.open(latest,'rt') as f:sql=f.read()
assert 'CREATE TABLE' in sql and 'INSERT INTO' in sql and '-- Dump completed on' in sql
assert run(['systemctl','is-enabled','pripyat-platform-backup.timer']).strip()=='enabled'
for db in ['stalker','stalker_ok','stalker_telegram']:
 count=run(['mysql','--batch','--skip-column-names','-e','SELECT COUNT(*) FROM '+db+'.users']).strip();assert count=='0'
print(json.dumps({'services':'all active','ssh':'key only, fresh connections passed','mysql':'loopback only, restricted PDO account passed','php_fpm':health,'sql_backup_gzip':'valid','backup_file':str(latest),'daily_backup_timer':'enabled','game_published':False,'https':'not configured; domains not switched'}))
'''
p.remote('root',code)
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
with opener.open('http://'+p.HOST+'/',timeout=10) as r:
    assert r.status==200 and b'Game is not published' in r.read()
print('External HTTP passed')
try:opener.open('http://'+p.HOST+'/__bootstrap_php_health',timeout=10);raise AssertionError('Private PHP health exposed')
except urllib.error.HTTPError as e:assert e.code==403
print('Private PHP health denied externally')
try:
    conn=socket.create_connection((p.HOST,3306),timeout=4);conn.close();raise AssertionError('MySQL publicly reachable')
except (TimeoutError,ConnectionRefusedError,OSError):print('External MySQL blocked')
for host in ['pripyat-game.ru','test-pripyat-game.ru','tg-test-pripyat-game.ru']:
    addresses=socket.gethostbyname_ex(host)[2];assert p.HOST not in addresses
    print('DNS not switched:',host,addresses)
