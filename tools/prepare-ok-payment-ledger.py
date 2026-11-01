"""Create only the isolated OK payment ledger; default is a read-only plan."""
from pathlib import Path
import importlib.util,json,sys
root=Path(__file__).resolve().parents[1]
assert len(sys.argv) in (2,3) and sys.argv[1] in ('test','prod') and (len(sys.argv)==2 or sys.argv[2]=='--apply')
target=sys.argv[1];apply=len(sys.argv)==3
spec=importlib.util.spec_from_file_location('release',root/'tools/release.py');r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
base='/var/www/stalker-test' if target=='test' else '/var/www/stalker';expected='stalker_test' if target=='test' else 'stalker_ok'
php='<?php\n'+(root/'server/core/models/okpaymentcredit.php').read_text(encoding='utf-8').replace('<?php','',1)+"\n$_POST['platform']='ok';require "+repr(base+'/server/core/models/registry.php')+";$r=new Registry;\n"
php+="$expected="+repr(expected)+";$apply="+('true' if apply else 'false')+";\n"+r"""
if($r['db']!==$expected)throw new Exception('Unexpected database');
$d=new mysqli($r['server'],$r['user'],$r['pass'],$r['db']);
$q=$d->query("SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ok_payment_transactions'");$existed=$q->num_rows>0;
if($apply && !$existed)$d->query(OkPaymentCredit::CREATE_SQL);
$q=$d->query("SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ok_payment_transactions'");$row=$q->fetch_assoc();
if($row && $row['ENGINE']!=='InnoDB')throw new Exception('Unexpected ledger engine');
if($row){$q=$d->query('SHOW COLUMNS FROM ok_payment_transactions');$cols=[];while($col=$q->fetch_assoc())$cols[$col['Field']]=$col;if(($cols['transaction_id']['Type']??'')!=='varchar(128)' || ($cols['transaction_id']['Key']??'')!=='PRI')throw new Exception('Unexpected ledger key');foreach(['ok_uid'=>'varchar(20)','game_uid'=>'bigint','product_id'=>'int','amount'=>'int','reward_field'=>'varchar(16)','reward_count'=>'bigint','created_at'=>'bigint'] as $field=>$type)if(($cols[$field]['Type']??'')!==$type)throw new Exception('Unexpected ledger schema');}
echo json_encode(['database'=>$expected,'apply'=>$apply,'existed'=>$existed,'ledger_ready'=>!!$row,'existing_tables_unchanged'=>true]);
"""
c=r.connect()
try:print(r.run_remote_python(c,'import subprocess\np=subprocess.run(["php"],input='+repr(php)+',text=True,capture_output=True)\nassert p.returncode==0,p.stderr\nprint(p.stdout)'))
finally:c.close()
