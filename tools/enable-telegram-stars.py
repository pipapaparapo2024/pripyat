"""Enable only the already deployed Stars TEST code; never makes a payment."""
from pathlib import Path
import importlib.util
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('release',ROOT/'tools/release.py');release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)
php=r'''<?php
$path='/etc/pripyat/telegram-test.php';$c=require $path;
if($c['database']!=='stalker_telegram_test')throw new RuntimeException('Wrong database');
$db=new PDO('mysql:host=127.0.0.1;port=3306;dbname=stalker_telegram_test;charset=utf8mb4',$c['db_user'],$c['db_password']);
foreach(['telegram_payment_orders','telegram_payment_transactions'] as $table)$db->query("SELECT 1 FROM `$table` LIMIT 0");
$backup='/var/backups/telegram-stars-enable-'.gmdate('YmdHis');mkdir($backup,0700);copy($path,$backup.'/config-before.php');chmod($backup.'/config-before.php',0600);
$c['stars_enabled']=true;file_put_contents($path,"<?php\nreturn ".var_export($c,true).";\n");chgrp($path,'pripyat-tg-test');chmod($path,0640);
echo json_encode(['stars_test_enabled'=>true,'backup'=>$backup]);
'''
code='import subprocess\np=subprocess.run(["php"],input='+repr(php)+',capture_output=True,text=True)\nassert p.returncode==0,"Private Stars activation failed"\nsubprocess.run(["systemctl","reload","php8.5-fpm"],check=True)\nprint(p.stdout)'
client=release.connect()
try:print(release.run_remote_python(client,code))
finally:client.close()
