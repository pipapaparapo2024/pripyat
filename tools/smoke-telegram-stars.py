"""Exercise real TEST SQL/HTTP payment paths with a disposable identity, never spend Stars."""
from pathlib import Path
import importlib.util
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('release',ROOT/'tools/release.py');release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)
source=(ROOT/'tools/smoke-telegram-test.py').read_text(encoding='utf-8')
header=source.split("php=r'''",1)[1].split('try{\n',1)[0].replace('4503599627370401','4503599627370421')
cleanup=source.split('}finally{',1)[1].split("'''",1)[0]
cleanup=cleanup.replace("['telegram_sessions','telegram_roles']","['telegram_payment_transactions','telegram_payment_orders','telegram_sessions','telegram_roles']")
body=r'''
try{
    require '/var/www/stalker-tg-test/public/server/core/models/telegramaccess.php';
    $access=new TelegramAccess;$access->change(TelegramAccess::OWNER,$external,true);
    require '/var/www/stalker-tg-test/public/server/core/models/telegramstars.php';
    $session=postTg('telegram-login.php',['init_data'=>$raw]);$uid=(int)($session['player_id']??0);checkSmoke($uid>0,'Fixture login');
    checkSmoke(empty($session['roles']),'Ordinary identity received developer role');
    checkSmoke((apiTg('users.devGetLogs')['status']??'')==='error','Ordinary user can read logs');
    apiTg('users.get');
    $invoice=apiTg('telegramstars.create',['product_id'=>0]);
    checkSmoke(isset($invoice['invoice_url'])&&str_starts_with($invoice['invoice_url'],'https://t.me/$'),'Real invoice creation');
    checkSmoke((int)$invoice['stars']===4,'Invoice amount');
    $catalog=json_decode(file_get_contents('/var/www/stalker-tg-test/public/server/json/telegram_stars.json'),true);
    $fakeBot=new class {function call($method,$body){return 'https://t.me/$fixture';}};
    $stars=new TelegramStars($db,$catalog,$fakeBot);$now=time();
    function receipt($order,$charge){return ['currency'=>'XTR','total_amount'=>(int)$order['stars'],'invoice_payload'=>'tg1_'.$order['order_id'],'telegram_payment_charge_id'=>$charge];}
    function balance($field){global $db,$uid;return (string)$db->query('SELECT `'.$field.'` FROM users WHERE id='.(int)$uid)->fetchColumn();}
    function rejectCredit($stars,$external,$p,$label){try{$stars->credit($external,$p,time());}catch(Throwable $e){return;}throw new RuntimeException($label);}
    $p=receipt($invoice,'fixture-stars-'.bin2hex(random_bytes(12)));
    checkSmoke(balance('stew')==='0','Creating invoice granted goods');
    rejectCredit($stars,(string)((int)$external+1),$p,'Wrong buyer accepted');
    $bad=$p;$bad['total_amount']=5;rejectCredit($stars,$external,$bad,'Wrong price accepted');
    $bad=$p;$bad['currency']='RUB';rejectCredit($stars,$external,$bad,'Wrong currency accepted');
    $q=$p;$q['id']='fixture-checkout';checkSmoke($stars->precheckout($external,$q,$now),'Precheckout rejected');
    checkSmoke($stars->precheckout($external,$q,$now),'Repeated query rejected');$q['id']='other-query';checkSmoke(!$stars->precheckout($external,$q,$now),'Second checkout accepted');
    checkSmoke(balance('stew')==='0','Precheckout granted goods');
    // Exercise the HTTPS webhook, including authentication. It cannot send anything to the fake identity.
    $updateId=4503599627370421;$markers=[];
    function deliverFixture($payment,$authorized=true){
        global $external,$c,$updateId,$markers;
        $id=$updateId++;$markers[]='/var/lib/pripyat-tg-test/bot-updates/'.$id;
        $data=['update_id'=>$id,'message'=>['message_id'=>1,'chat'=>['id'=>(int)$external,'type'=>'private'],'from'=>['id'=>(int)$external,'is_bot'=>false],'successful_payment'=>$payment]];
        $ch=curl_init('https://tg-test-pripyat-game.ru/server/telegram-bot.php');
        curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($data),CURLOPT_HTTPHEADER=>['Content-Type: application/json','X-Telegram-Bot-Api-Secret-Token: '.($authorized?$c['webhook_secret']:'invalid')],CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>20]);
        curl_exec($ch);$status=curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);return $status;
    }
    checkSmoke(deliverFixture($p,false)===403,'Unsigned webhook accepted');checkSmoke(balance('stew')==='0','Unsigned receipt credited');
    checkSmoke(deliverFixture($p)===200,'Signed webhook failed');checkSmoke(balance('stew')==='4','Webhook failed to credit');
    checkSmoke(deliverFixture($p)===200&&balance('stew')==='4','Duplicate credited twice');
    $bad=$p;$bad['telegram_payment_charge_id'].='other';rejectCredit($stars,$external,$bad,'Paid order accepted second charge');
    $large=$stars->create($uid,0,$now);$db->exec("UPDATE users SET stew=9007199254740993 WHERE id=$uid");
    $stars->credit($external,receipt($large,'fixture-large-'.$uid),$now);checkSmoke(balance('stew')==='9007199254740997','Large integer precision lost');
    $overflow=$stars->create($uid,0,$now);$db->exec("UPDATE users SET stew=9223372036854775807 WHERE id=$uid");
    rejectCredit($stars,$external,receipt($overflow,'fixture-overflow-'.$uid),'Overflow accepted');
    checkSmoke($stars->status($uid,$overflow['order_id'])['payment_status']==='created','Order not rolled back');
    $count=$db->prepare('SELECT COUNT(*) FROM telegram_payment_transactions WHERE order_id=?');$count->execute([$overflow['order_id']]);checkSmoke((int)$count->fetchColumn()===0,'Ledger not rolled back');
    $energy=$stars->create($uid,100,$now);$db->exec('UPDATE users SET energy=20,max_energy=50,energy_time='.($now-601).' WHERE id='.$uid);
    $stars->credit($external,receipt($energy,'fixture-energy-'.$uid),$now);checkSmoke(balance('energy')==='72','Energy regeneration lost');
    apiTg('users.save',['udata_json'=>json_encode(['energy'=>1,'energy_time'=>1])]);checkSmoke(balance('energy')==='72','Stale save overwrote paid energy');
    $late=$stars->create($uid,0,$now-1900);$db->exec("UPDATE users SET stew=0 WHERE id=$uid");
    $lateReceipt=receipt($late,'fixture-late-'.$uid);$q=$lateReceipt;$q['id']='expired';checkSmoke(!$stars->precheckout($external,$q,$now),'Expired checkout accepted');
    checkSmoke($stars->credit($external,$lateReceipt,$now)==='credited','Late receipt dropped');
    $stars->refunded($external,$lateReceipt,$now);checkSmoke($stars->status($uid,$late['order_id'])['payment_status']==='refunded','Refund missing');
    checkSmoke($stars->credit($external,$lateReceipt,$now)==='duplicate'&&balance('stew')==='4','Refund receipt credited twice');
    $roles=$db->query("SELECT player_id FROM telegram_roles WHERE role='developer'")->fetchAll(PDO::FETCH_COLUMN);checkSmoke(array_map('intval',$roles)===[18],'Developer allowlist changed');
    echo "Stars TEST: invoice, webhook secret, owner/amount/currency checks, precheckout/retry, exactly-once credit, BIGINT precision, SQL rollback, energy/save, expiry/refund and developer denial passed. No Stars spent.\n";
}finally{
    foreach($markers??[] as $path)if(is_file($path))unlink($path);
'''
php=header+body+cleanup
code='import subprocess\np=subprocess.run(["runuser","-u","pripyat-tg-test","--","php"],input='+repr(php)+',cwd="/var/www/stalker-tg-test/public/server",capture_output=True,text=True)\nprint(p.stdout)\nif p.returncode:\n print(p.stderr[-1600:]);raise RuntimeError("Stars TEST smoke failed")'
client=release.connect()
try:print(release.run_remote_python(client,code))
finally:client.close()
