<?php
require __DIR__.'/../../website/app/sitephoneprovider.php';
$row=['call_id'=>'1234','phone'=>'+79991234567','status'=>'pincode_ok','completed'=>'2026-11-04T12:15:30Z'];
function checkPhone($value){if(!$value)throw new RuntimeException('Phone assertion failed');}
checkPhone(SitePhoneProvider::confirmed($row,'1234','89991234567'));
foreach(['in_process','completed','user','pincode_nook','attempts_exc'] as $status)checkPhone(!SitePhoneProvider::confirmed(array_replace($row,['status'=>$status]),'1234',$row['phone']));
checkPhone(!SitePhoneProvider::confirmed($row,'1235',$row['phone']));
checkPhone(!SitePhoneProvider::confirmed($row,'1234','+79991234568'));
checkPhone(!SitePhoneProvider::confirmed(array_replace($row,['completed'=>null]),'1234',$row['phone']));
foreach(['+77001234567','+375291234567','+33123456789'] as $phone){
 $foreign=array_replace($row,['phone'=>$phone]);
 checkPhone(SitePhoneProvider::confirmed($foreign,'1234',$phone));
 checkPhone(!SitePhoneProvider::confirmed($foreign,'1234',$row['phone']));
 checkPhone(!SitePhoneProvider::confirmed(array_replace($foreign,['status'=>'completed']),'1234',$phone));
 checkPhone(!SitePhoneProvider::confirmed($foreign,'1235',$phone));
}
echo "Site phone provider: exact success, identity and call binding passed\n";
