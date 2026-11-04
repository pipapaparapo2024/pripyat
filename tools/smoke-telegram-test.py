"""HTTP smoke test of Telegram TEST using a reserved synthetic Telegram identity.
Removes only rows owned by the newly-created fixture. Never uses a real player.
"""
from pathlib import Path
import importlib.util
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('release',ROOT/'tools/release.py')
release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)
php=r'''<?php
$c=require '/etc/pripyat/telegram-test.php';
$db=new PDO('mysql:host=127.0.0.1;port=3306;dbname=stalker_telegram_test;charset=utf8mb4',$c['db_user'],$c['db_password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$external='4503599627370401';
$q=$db->prepare('SELECT player_id FROM telegram_identities WHERE telegram_id=?');$q->execute([$external]);
if($q->fetchColumn()!==false)throw new RuntimeException('Fixture ID already exists, refusing test');
function checkSmoke($v,$label){if(!$v)throw new RuntimeException($label);}
function postTg($path,$data){
    $ch=curl_init('https://tg-test-pripyat-game.ru/server/'.$path);
    curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>http_build_query($data),CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>25]);
    $body=curl_exec($ch);$status=curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
    $out=json_decode($body?:'',true);
    if(!is_array($out))throw new RuntimeException('Invalid HTTP JSON: '.$status);
    return $out;
}
$fields=['auth_date'=>(string)time(),'user'=>json_encode(['id'=>(int)$external,'first_name'=>'TG fixture'],JSON_UNESCAPED_UNICODE)];
ksort($fields);$lines=[];foreach($fields as $k=>$v)$lines[]=$k.'='.$v;
$fields['hash']=hash_hmac('sha256',implode("\n",$lines),hash_hmac('sha256',$c['bot_token'],'WebAppData',true));
$raw=http_build_query($fields);$uid=null;$session=null;
function apiTg($method,$params=[],$extra=[]){
    global $session;
    $r=postTg('telegram-api.php',array_merge(['method'=>$method,'payload'=>json_encode($params,JSON_UNESCAPED_UNICODE),'token'=>$session['token'],'req_key'=>$session['req_key']],$extra));
    if(!empty($r['req_key']))$session['req_key']=$r['req_key'];
    return $r;
}
try{
    require '/var/www/stalker-tg-test/public/server/core/models/telegramaccess.php';
    $access=new TelegramAccess;$access->change(TelegramAccess::OWNER,$external,true);
    $bad=postTg('telegram-login.php',['init_data'=>$raw.'x']);checkSmoke(($bad['code']??'')==='telegram_auth_rejected','Forged login accepted');
    $session=postTg('telegram-login.php',['init_data'=>$raw]);
    checkSmoke(isset($session['player_id'],$session['req_key'],$session['token']),'Login failed');$uid=(int)$session['player_id'];
    $oldKey=$session['req_key'];
    $get=apiTg('users.get');
    checkSmoke(isset($get['udata']) && (int)$get['udata']['id']===$uid,'users.get failed code='.($get['code']??'?'));
    checkSmoke((int)$get['udata']['coins']===10 && (int)$get['udata']['cigarettes']===1000,'Initial balance');
    $replay=apiTg('users.get',[],['req_key'=>$oldKey]);checkSmoke(($replay['code']??0)===4,'Replay accepted');
    $forged=apiTg('users.get',[],['token'=>str_repeat('0',64)]);checkSmoke(($forged['code']??0)===5,'Forged session accepted');
    $denied=apiTg('users.devGrantCurrency');checkSmoke(($denied['status']??'')==='error','Dev operation accepted');
    $save=apiTg('users.save',['udata_json'=>json_encode(['nick'=>'TG Smoke','snd_vol'=>'0.23','coins'=>'999999','id'=>2147483647])]);
    checkSmoke(($save['status']??'')!=='error','Save failed code='.($save['code']??'?'));
    $again=postTg('telegram-login.php',['init_data'=>$raw]);
    checkSmoke(($again['player_id']??'')===(string)$uid,'Repeat login changed account');$session=$again;
    $reload=apiTg('users.get');
    checkSmoke(($reload['udata']['nick']??'')==='TG Smoke' && abs((float)$reload['udata']['snd_vol']-0.23)<0.001,'Progress did not persist');
    checkSmoke((int)$reload['udata']['coins']===10,'Client created currency');
    $mismatch=apiTg('users.get',[],['uid'=>'2147483647']);checkSmoke(($mismatch['code']??0)===54,'UID spoof accepted');
    $expiry=$db->prepare('UPDATE telegram_sessions SET expires_at=0 WHERE token_hash=?');$expiry->execute([hash('sha256',$session['token'])]);
    $expired=apiTg('users.get');checkSmoke(($expired['code']??0)===3,'Expired session accepted');
    echo "Telegram HTTPS smoke: signed login, load, save, repeat login, currency/UID spoof rejection, dev denial, expiry and replay verified\n";
}finally{
    if(isset($access))$access->change(TelegramAccess::OWNER,$external,false);
    if($uid===null){$q->execute([$external]);$uid=$q->fetchColumn();}
    if($uid){
        $verify=$db->prepare('SELECT telegram_id FROM telegram_identities WHERE player_id=?');$verify->execute([$uid]);
        checkSmoke((string)$verify->fetchColumn()===$external,'Fixture cleanup identity mismatch');
        $db->beginTransaction();
        foreach(['telegram_sessions','telegram_roles'] as $t){$s=$db->prepare("DELETE FROM `$t` WHERE player_id=?");$s->execute([$uid]);}
        $s=$db->prepare('DELETE FROM users WHERE id=?');$s->execute([$uid]);
        $s=$db->prepare('DELETE FROM telegram_identities WHERE player_id=? AND telegram_id=?');$s->execute([$uid,$external]);
        $db->commit();echo "Fixture player/session rows removed; no real accounts touched\n";
    }
}
'''
code='''import subprocess
p=subprocess.run(['runuser','-u','pripyat-tg-test','--','php'],input=PHP,cwd='/var/www/stalker-tg-test/public/server',capture_output=True,text=True)
print(p.stdout)
if p.returncode:
    # Fixture diagnostics contain labels only; never echo raw requests/config.
    print(p.stderr[-2200:]);raise RuntimeError('Telegram smoke failed')
'''.replace('PHP',repr(php))
client=release.connect()
try:print(release.run_remote_python(client,code))
finally:client.close()
