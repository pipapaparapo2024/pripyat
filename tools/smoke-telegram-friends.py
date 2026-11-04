"""Real Telegram TEST friendship/API integration using three synthetic identities only."""
from pathlib import Path
import importlib.util
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('release',ROOT/'tools/release.py')
release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)
php=r'''<?php
$c=require '/etc/pripyat/telegram-test.php';
$db=new PDO('mysql:host=127.0.0.1;port=3306;dbname=stalker_telegram_test;charset=utf8mb4',$c['db_user'],$c['db_password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
$externals=['4503599627370411','4503599627370412','4503599627370413'];$ids=[];
function sqlFriends($query,$args=[]){global $db;$q=$db->prepare($query);$q->execute($args);return $q;}
function checkFriends($value,$label){if(!$value)throw new RuntimeException($label);}
foreach($externals as $external)checkFriends(sqlFriends('SELECT player_id FROM telegram_identities WHERE telegram_id=?',[$external])->fetchColumn()===false,'Fixture already exists');
function requestFriends($path,$body){
    $ch=curl_init('https://tg-test-pripyat-game.ru/server/'.$path);curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>http_build_query($body),CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>20]);
    $raw=curl_exec($ch);curl_close($ch);$result=json_decode($raw?:'',true);checkFriends(is_array($result),'HTTP JSON invalid');return $result;
}
function loginFriends($external,$invite=''){
    global $c,$ids;
    $f=['auth_date'=>(string)time(),'user'=>json_encode(['id'=>(int)$external,'first_name'=>'Friend fixture'])];if($invite!=='')$f['start_param']=$invite;
    ksort($f);$l=[];foreach($f as $k=>$v)$l[]=$k.'='.$v;
    $f['hash']=hash_hmac('sha256',implode("\n",$l),hash_hmac('sha256',$c['bot_token'],'WebAppData',true));
    $r=requestFriends('telegram-login.php',['init_data'=>http_build_query($f)]);
    checkFriends(isset($r['player_id'],$r['token'],$r['req_key']),'Login failed');$ids[$external]=(int)$r['player_id'];return $r;
}
function apiFriends(&$session,$method,$params=[]){
    $r=requestFriends('telegram-api.php',['method'=>$method,'token'=>$session['token'],'req_key'=>$session['req_key'],'payload'=>json_encode($params)]);
    if(!empty($r['req_key']))$session['req_key']=$r['req_key'];
    checkFriends(($r['status']??'')!=='error','API rejected '.$method.' code='.($r['code']??'?'));return $r;
}
try{
    require '/var/www/stalker-tg-test/public/server/core/models/telegramaccess.php';$access=new TelegramAccess;
    foreach($externals as $external)$access->change(TelegramAccess::OWNER,$external,true);
    $a=loginFriends($externals[0]);$aid=(int)$a['player_id'];
    $link=apiFriends($a,'telegramfriends.invite')['link'];parse_str(parse_url($link,PHP_URL_QUERY),$query);$code=$query['start'];
    checkFriends(apiFriends($a,'telegramfriends.invite')['link']===$link,'Invite changed unexpectedly');
    // New player enters through a signed invitation.
    $b=loginFriends($externals[1],$code);$bid=(int)$b['player_id'];checkFriends($b['friend_result']==='added','New player invitation failed');
    $since=(int)sqlFriends('SELECT friends_since_ms FROM telegram_friendships WHERE player_low=? AND player_high=?',[min($aid,$bid),max($aid,$bid)])->fetchColumn();
    $b=loginFriends($externals[1],$code);checkFriends($b['friend_result']==='existing','Repeat invitation');
    checkFriends((int)sqlFriends('SELECT friends_since_ms FROM telegram_friendships WHERE player_low=? AND player_high=?',[min($aid,$bid),max($aid,$bid)])->fetchColumn()===$since,'Repeat changed friendship date');
    foreach([[$aid,$bid],[$bid,$aid]] as [$uid,$other]){
        $r=sqlFriends('SELECT friends,friends_since FROM users WHERE id=?',[$uid])->fetch(PDO::FETCH_ASSOC);
        checkFriends(in_array((string)$other,explode(',',$r['friends']),true),'Mutual cache missing');
        checkFriends((int)json_decode($r['friends_since'],true)[(string)$other]===$since,'Mutual date missing');
    }
    $third=loginFriends($externals[2]);$cid=(int)$third['player_id'];
    $friends=apiFriends($a,'telegramfriends.list',['scope'=>'friends']);checkFriends(in_array($bid,array_column($friends['players'],'id'),true),'Friend list missing');
    $others=apiFriends($a,'telegramfriends.list',['scope'=>'others']);checkFriends(!in_array($bid,array_column($others['players'],'id'),true)&&!in_array($aid,array_column($others['players'],'id'),true),'Others contains friend/self');
    foreach([[$aid,$bid],[$bid,$aid]] as [$uid,$other])sqlFriends('UPDATE users SET gym_pump_cooldowns=?,coins=123 WHERE id=?',[json_encode([(string)$other=>1793530000000]),$uid]);
    sqlFriends('INSERT INTO boss_damage_log (uid,boss_id,diff_idx,damage,critical,is_sedoy,time) VALUES (?,0,0,100,0,0,?)',[$bid,$since-1]);
    checkFriends((int)sqlFriends('SELECT COALESCE(SUM(damage),0) FROM boss_damage_log WHERE uid=? AND time>=?',[$bid,$since])->fetchColumn()===0,'Old damage crossed friendship date');
    checkFriends(apiFriends($a,'telegramfriends.remove',['id'=>$bid])['removed']===true,'Remove failed');
    foreach([[$aid,$bid],[$bid,$aid]] as [$uid,$other]){
        $r=sqlFriends('SELECT friends,friends_since,gym_pump_cooldowns,coins FROM users WHERE id=?',[$uid])->fetch(PDO::FETCH_ASSOC);
        checkFriends(!in_array((string)$other,explode(',',$r['friends']),true),'Removal not mutual');
        checkFriends(!isset(json_decode($r['friends_since'],true)[(string)$other]),'Old friendship date remains');
        checkFriends((int)json_decode($r['gym_pump_cooldowns'],true)[(string)$other]===1793530000000 && (int)$r['coins']===123,'Removal changed cooldown/reward');
    }
    // A late client snapshot cannot restore friendship.
    apiFriends($a,'users.save',['udata_json'=>json_encode(['friends'=>"$aid,$bid",'friends_since'=>json_encode([(string)$bid=>$since]),'nick'=>'Friend fixture'])]);
    $fresh=apiFriends($a,'users.get');checkFriends(!in_array((string)$bid,explode(',',$fresh['udata']['friends']),true),'Old client restored friendship');
    usleep(2000);$b=loginFriends($externals[1],$code);checkFriends($b['friend_result']==='added','Readd existing account failed');
    $after=(int)sqlFriends('SELECT friends_since_ms FROM telegram_friendships WHERE player_low=? AND player_high=?',[min($aid,$bid),max($aid,$bid)])->fetchColumn();checkFriends($after>$since,'Readd reused old date');
    $self=loginFriends($externals[0],$code);checkFriends($self['friend_result']==='self','Self invitation accepted');
    sqlFriends('UPDATE telegram_friend_invites SET revoked_at=? WHERE owner_player_id=?',[time(),$aid]);
    $third=loginFriends($externals[2],$code);checkFriends($third['friend_result']==='invalid','Revoked link accepted');
    echo "Telegram friends HTTPS/MySQL: new/existing invite, repeat date, mutual list/remove, separate others, preserved cooldown/rewards, old-damage cutoff, stale snapshot, readd and revoked link verified\n";
}finally{
    if(isset($access))foreach($externals as $external)$access->change(TelegramAccess::OWNER,$external,false);
    foreach($externals as $external){$id=sqlFriends('SELECT player_id FROM telegram_identities WHERE telegram_id=?',[$external])->fetchColumn();if($id)$ids[$external]=(int)$id;}
    if($ids){
        $db->beginTransaction();
        foreach($ids as $external=>$id){
            foreach(['telegram_sessions','telegram_roles'] as $table)sqlFriends("DELETE FROM `$table` WHERE player_id=?",[$id]);
            sqlFriends('DELETE FROM telegram_friendships WHERE player_low=? OR player_high=?',[$id,$id]);
            sqlFriends('DELETE FROM telegram_friend_invites WHERE owner_player_id=?',[$id]);
            sqlFriends('DELETE FROM boss_damage_log WHERE uid=?',[$id]);
            sqlFriends('DELETE FROM users WHERE id=?',[$id]);
            sqlFriends('DELETE FROM telegram_identities WHERE player_id=? AND telegram_id=?',[$id,(string)$external]);
        }
        $db->commit();echo "Only the three synthetic friendship fixtures removed\n";
    }
}
'''
code='import subprocess\np=subprocess.run(["runuser","-u","pripyat-tg-test","--","php"],input='+repr(php)+',cwd="/var/www/stalker-tg-test/public/server",capture_output=True,text=True)\nprint(p.stdout)\nif p.returncode: print(p.stderr[-1800:]);raise RuntimeError("Friendship integration failed")'
client=release.connect()
try:print(release.run_remote_python(client,code))
finally:client.close()
