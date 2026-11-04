"""Verify webhook authentication and harmless duplicate updates; no chat messages."""
from pathlib import Path
import importlib.util
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('release',ROOT/'tools/release.py')
release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)
php=r'''<?php
$c=require '/etc/pripyat/telegram-test.php';
function hookRequest($secret){
    $ch=curl_init('https://tg-test-pripyat-game.ru/server/telegram-bot.php');
    curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_HTTPHEADER=>['Content-Type: application/json','X-Telegram-Bot-Api-Secret-Token: '.$secret],CURLOPT_POSTFIELDS=>'{"update_id":1099511627776}',CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>15]);
    $body=curl_exec($ch);$status=curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);return $status;
}
if(hookRequest('invalid-secret')!==403)throw new RuntimeException('Forged webhook accepted');
if(hookRequest($c['webhook_secret'])!==200||hookRequest($c['webhook_secret'])!==200)throw new RuntimeException('Authenticated noop update failed');
$file='/var/lib/pripyat-tg-test/bot-updates/1099511627776';
if(trim(file_get_contents($file))!=='done')throw new RuntimeException('Update not acknowledged');
unlink($file); // Only the exact synthetic no-message update marker.
$ch=curl_init('https://api.telegram.org/bot'.$c['bot_token'].'/getWebhookInfo');curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>15]);$raw=curl_exec($ch);curl_close($ch);$r=json_decode($raw?:'',true);
if(!($r['ok']??false))throw new RuntimeException('Webhook info failed');
echo json_encode(['webhook_auth'=>'verified','duplicate_noop'=>'verified','pending_update_count'=>$r['result']['pending_update_count'],'url'=>$r['result']['url'],'last_error_date'=>$r['result']['last_error_date']??null]);
'''
code='import subprocess,re\np=subprocess.run(["php"],input='+repr(php)+',capture_output=True,text=True)\nprint(p.stdout)\nif p.returncode:\n m=re.search(r"Uncaught RuntimeException: ([^\\n]+) in Standard input",p.stderr)\n print(m.group(1) if m else "Private webhook verification failed")\n raise RuntimeError("Webhook verification incomplete")'
client=release.connect()
try:print(release.run_remote_python(client,code))
finally:client.close()
