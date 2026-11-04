"""Real controller/MySQL concurrency audit across four TEST worlds. Fixture-only writes; no DDL."""
from pathlib import Path
import importlib.util
ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('p',ROOT/'tools/provision-new-server.py');p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
setup=r'''<?php
require '/var/www/pripyat-rewards-test/app/rewardlinkpublisher.php';
$c=json_decode(file_get_contents('/etc/pripyat/rewards-admin-test.json'),true);
$marker='reward-audit-'.bin2hex(random_bytes(12));$before=[];
function connectRewardAudit($name){global $c;$v=$c['databases'][$name];return new PDO('mysql:host=127.0.0.1;dbname='.$name.';charset=utf8mb4',$v['user'],$v['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);}
foreach(RewardLinkTargets::DATABASES['test'] as $name){
 $db=connectRewardAudit($name);$q=$db->query('SELECT COUNT(*) FROM users WHERE id IN (2147000001,2147000002)');if($q->fetchColumn()!=0)throw new RuntimeException('Fixture collision');
 $before[$name]=hash('sha256',json_encode($db->query('SELECT * FROM users ORDER BY id')->fetchAll(PDO::FETCH_ASSOC)));
}
// All four collision checks precede the first write.
foreach(RewardLinkTargets::DATABASES['test'] as $name){$db=connectRewardAudit($name);foreach([2147000001,2147000002] as $id){$q=$db->prepare("INSERT INTO users(id,nick,exp,coins,cigarettes,shmot,create_time,visit) VALUES (?,?,0,10,1000,'[]',?,?)");$q->execute([$id,$marker,time(),time()]);}}
$publisher=new RewardLinkPublisher('test','connectRewardAudit');
$result=$publisher->create(['vk','ok','telegram','site'],[['kind'=>'currency','field'=>'coins','amount'=>7]],$marker,300,time());
foreach($result as $r)if(!$r['created'])throw new RuntimeException('Fixture campaign setup failed');
echo json_encode(['marker'=>$marker,'before'=>$before,'links'=>$result]);
'''
worker=r'''<?php
$maps=['vk'=>'stalker_test','ok'=>'stalker_ok_test','telegram'=>'stalker_telegram_test','site'=>'stalker_site_test'];
$v=json_decode(stream_get_contents(STDIN),true);$name=$maps[$v['platform']]??null;
if(!$name||!in_array($v['uid'],[2147000001,2147000002],true))throw new RuntimeException('Fixture only');
$all=json_decode(file_get_contents('/etc/pripyat/rewards-admin-test.json'),true);$c=$all['databases'][$name];
require '/var/www/stalker-tg-test/public/server/core/models/gameops.php';
require '/var/www/stalker-tg-test/public/server/core/controllers/rewardlinks.php';
class RewardAuditTools {function output($x){echo json_encode($x);}function error($code){echo json_encode(['error'=>$code]);}}
$registry=['server'=>'127.0.0.1','user'=>$c['user'],'pass'=>$c['password'],'db'=>$name,'utb'=>'users','uid'=>$v['uid'],'user_params'=>['code'=>$v['code']],'tools'=>new RewardAuditTools];
(new Rewardlinks($registry))->claim();
'''
finish=r'''<?php
$state=json_decode(stream_get_contents(STDIN),true);$all=json_decode(file_get_contents('/etc/pripyat/rewards-admin-test.json'),true);
$report=[];
foreach($state['before'] as $name=>$hash){
 $c=$all['databases'][$name];$db=new PDO('mysql:host=127.0.0.1;dbname='.$name.';charset=utf8mb4',$c['user'],$c['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
 $rows=$db->query('SELECT id,nick,coins FROM users WHERE id IN (2147000001,2147000002) ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);
 $report[$name]=['balances'=>array_map(fn($r)=>(int)$r['coins'],$rows),'receipts'=>(int)$db->query('SELECT COUNT(*) FROM reward_link_claims WHERE user_id IN (2147000001,2147000002)')->fetchColumn()];
 foreach($rows as $r)if($r['nick']!==$state['marker'])throw new RuntimeException('Cleanup marker mismatch');
 $db->beginTransaction();
 $db->exec('DELETE FROM reward_link_claims WHERE user_id IN (2147000001,2147000002)');
 $q=$db->prepare('DELETE FROM users WHERE id IN (2147000001,2147000002) AND nick=?');$q->execute([$state['marker']]);
 $q=$db->prepare('DELETE FROM reward_links WHERE label=?');$q->execute([$state['marker']]);$db->commit();
 if(hash('sha256',json_encode($db->query('SELECT * FROM users ORDER BY id')->fetchAll(PDO::FETCH_ASSOC)))!==$hash)throw new RuntimeException('Non-fixture user data changed');
}
echo json_encode($report);
'''
code=r'''
from pathlib import Path
import subprocess,json,datetime,concurrent.futures
backup=Path('/var/backups')/('pripyat-rewards-audit-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));backup.mkdir(mode=0o700)
def php(source,payload=None):
 if payload is None:r=subprocess.run(['php'],input=source,text=True,capture_output=True)
 else:
  file=backup/('worker.php' if source==WORKER else 'cleanup.php')
  if not file.exists():file.write_text(source);file.chmod(0o600)
  r=subprocess.run(['php',str(file)],input=json.dumps(payload),text=True,capture_output=True)
 if r.returncode:raise RuntimeError('Reward fixture PHP operation failed; private diagnostics suppressed')
 return json.loads(r.stdout)
state=php(SETUP);(backup/'fixture-state.json').write_text(json.dumps(state));(backup/'fixture-state.json').chmod(0o600)
def claim(platform,code,uid=2147000001):return php(WORKER,{'platform':platform,'code':code,'uid':uid})
try:
 for source,link in state['links'].items():
  for target in state['links']:
   if source!=target:assert claim(target,link['code']).get('reason')=='notfound'
 jobs=[(platform,link['code']) for platform,link in state['links'].items() for _ in range(4)]
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:results=list(pool.map(lambda args:claim(*args),jobs))
 for i,platform in enumerate(state['links']):
  rows=results[i*4:i*4+4]
  assert sum(r.get('claimed',0) for r in rows)==1,'Concurrent duplicate reward'
  assert sum(r.get('reason')=='already' for r in rows)==3
 for platform,link in state['links'].items():
  assert claim(platform,link['code']).get('reason')=='already'
  assert claim(platform,link['code'],2147000002).get('claimed')==1
finally:
 report=php(FINISH,state)
 (backup/'result.json').write_text(json.dumps(report))
for db,r in report.items():assert r['balances']==[17,17] and r['receipts']==2,db
print(json.dumps({'four_test_databases':report,'cross_world_attempts_rejected':12,'parallel_claim_attempts':16,'one_award_per_player_per_link':True,'all_fixture_rows_removed':True,'non_fixture_players_unchanged':True,'backup':str(backup)}))
'''.replace('WORKER',repr(worker)).replace('SETUP',repr(setup)).replace('FINISH',repr(finish))
p.remote('root',code)
