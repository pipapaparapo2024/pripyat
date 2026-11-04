"""Closed TEST HTTP checks with a temporary synthetic identity; no real login impersonation."""
from pathlib import Path
import importlib.util
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('release',ROOT/'tools/release.py');release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)
source=(ROOT/'tools/smoke-telegram-test.py').read_text(encoding='utf-8')
header=source.split("php=r'''",1)[1].split('try{\n',1)[0].replace('4503599627370401','4503599627370431')
cleanup=source.split('}finally{',1)[1].split("'''",1)[0]
body=r'''
try{
    require '/var/www/stalker-tg-test/public/server/core/models/telegramaccess.php';$access=new TelegramAccess;
    checkSmoke(!$access->allowed($external),'Fixture unexpectedly allowed');
    $denied=postTg('telegram-login.php',['init_data'=>$raw,'invite_code'=>'f_'.str_repeat('a',48)]);
    checkSmoke(($denied['code']??'')==='telegram_access_denied','Unlisted login accepted');$q->execute([$external]);checkSmoke($q->fetchColumn()===false,'Blocked login created player');
    $access->change(TelegramAccess::OWNER,$external,true);
    $session=postTg('telegram-login.php',['init_data'=>$raw]);$uid=(int)($session['player_id']??0);checkSmoke($uid>0,'Allowed login failed');
    checkSmoke(isset(apiTg('users.get')['udata']),'Allowed API failed');
    $avatar=apiTg('telegramavatars.get',['player_id'=>18]);
    checkSmoke(array_key_exists('photo_url',$avatar),'Avatar endpoint failed');
    if($avatar['photo_url']!==null){
        checkSmoke((bool)preg_match('~^https://tg-test-pripyat-game\.ru/images/telegram-avatars/[a-f0-9]{64}\.jpg\?v=[0-9]+$~D',$avatar['photo_url']),'Unsafe photo URL');
        $ch=curl_init($avatar['photo_url']);curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>10]);$bytes=curl_exec($ch);$status=curl_getinfo($ch,CURLINFO_HTTP_CODE);$type=curl_getinfo($ch,CURLINFO_CONTENT_TYPE);curl_close($ch);
        checkSmoke($status===200&&str_starts_with($type,'image/jpeg')&&getimagesizefromstring($bytes)!==false,'Cached avatar is not a usable image');
    }
    $bad=apiTg('telegramavatars.get',['player_id'=>'../../etc/passwd']);checkSmoke(($bad['status']??'')==='error','Avatar path injection accepted');
    $access->change(TelegramAccess::OWNER,$external,false);
    $revoked=apiTg('users.get');checkSmoke(($revoked['code']??0)===403,'Active session still allowed after deny');
    $revoked=apiTg('telegramstars.create',['product_id'=>0]);checkSmoke(($revoked['code']??0)===403,'Revoked player can create invoice');
    $revoked=apiTg('telegramavatars.get',['player_id'=>18]);checkSmoke(($revoked['code']??0)===403,'Revoked player can query avatar');
    checkSmoke((postTg('telegram-login.php',['init_data'=>$raw])['code']??'')==='telegram_access_denied','Revoked login accepted');
    echo json_encode(['closed_login'=>'passed','no_blocked_player_created'=>true,'active_session_revocation'=>'passed','friend_invite_bypass'=>'rejected','avatar_endpoint'=>'passed','owner_real_photo_available'=>$avatar['photo_url']!==null,'no_database_migrations'=>true])."\n";
}finally{
'''
php=header+body+cleanup
code='import subprocess\np=subprocess.run(["runuser","-u","pripyat-tg-test","--","php"],input='+repr(php)+',cwd="/var/www/stalker-tg-test/public/server",capture_output=True,text=True)\nprint(p.stdout)\nif p.returncode:\n print(p.stderr[-1600:]);raise RuntimeError("Access smoke failed")'
client=release.connect()
try:print(release.run_remote_python(client,code))
finally:client.close()
