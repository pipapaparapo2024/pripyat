"""Read-only resolve the requested username among existing TEST bot players."""
from pathlib import Path
import importlib.util
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('release',ROOT/'tools/release.py');release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)
php=r'''<?php
$c=require '/etc/pripyat/telegram-test.php';$db=new PDO('mysql:host=127.0.0.1;port=3306;dbname=stalker_telegram_test;charset=utf8mb4',$c['db_user'],$c['db_password']);
$rows=$db->query('SELECT player_id,telegram_id FROM telegram_identities ORDER BY player_id LIMIT 100')->fetchAll(PDO::FETCH_ASSOC);$matches=[];
foreach($rows as $row){
    $ch=curl_init('https://api.telegram.org/bot'.$c['bot_token'].'/getChat');curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>http_build_query(['chat_id'=>$row['telegram_id']]),CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>8]);$raw=curl_exec($ch);curl_close($ch);$r=json_decode($raw?:'',true);
    if(($r['ok']??false)&&strtolower($r['result']['username']??'')==='ne_mafiya')$matches[]=['player_id'=>(int)$row['player_id'],'telegram_id'=>(string)$row['telegram_id'],'username'=>$r['result']['username']];
}
echo json_encode(['matches'=>$matches,'checked'=>count($rows)]);
'''
code='import subprocess\np=subprocess.run(["php"],input='+repr(php)+',capture_output=True,text=True)\nassert p.returncode==0,"Private identity lookup failed"\nprint(p.stdout)'
client=release.connect()
try:print(release.run_remote_python(client,code))
finally:client.close()
