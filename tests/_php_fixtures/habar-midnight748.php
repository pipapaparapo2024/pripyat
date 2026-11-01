<?php
require __DIR__.'/habar-lifecycle747.php';
$cases=[
 ['2026-10-07T13:59:29+03:00','2026-11-06T00:00:00+03:00'],
 ['2026-10-07T00:00:00+03:00','2026-11-06T00:00:00+03:00'],
 ['2026-10-07T23:59:59+03:00','2026-11-06T00:00:00+03:00'],
 ['2026-12-15T15:00:00+03:00','2027-01-14T00:00:00+03:00'],
 ['2028-02-01T12:00:00+03:00','2028-03-02T00:00:00+03:00']
];
$output=[];
foreach(['UTC','Europe/Moscow','America/New_York'] as $zone){
 date_default_timezone_set($zone);
 foreach($cases as [$start,$end]){
  $received=strtotime($start)*1000;$expiry=strtotime($end)*1000;
  verify747(Gameops::habarExpiresAtMs($received)===$expiry,'PHP expiry timezone/month boundary mismatch');
  if($zone==='UTC')$output[]=['start'=>$received,'end'=>$expiry];
 }
}
$start=strtotime('2026-10-07T13:59:29+03:00')*1000;$end=strtotime('2026-11-06T00:00:00+03:00')*1000;
foreach([$end-1,$end,$end+1] as $now){
 fresh747();HabarSql747::$row['habar_bought']='2';HabarSql747::$row['habar_bought_ts']=strval($start);HabarSql747::$row['habar_days_collected']='10';HabarSql747::$row['habar_last_collect_ts']='0';HabarSql747::$nowOverride=$now;
 $before=HabarSql747::$row;(new Habar($registry))->collectDay();
 if($now<$end)verify747(intval(HabarSql747::$row['coins'])===105 && intval(HabarSql747::$row['habar_days_collected'])===11,'collection before expiry rejected');
 else verify747($tools->result===['error'=>58] && HabarSql747::$row===$before,'collection at/after midnight allowed or state changed');
 verify747(HabarSql747::$row['habar_bought_ts']===strval($start),'original receipt date changed');
}
HabarSql747::$nowOverride=null;
echo 'MIDNIGHT_CASES='.json_encode($output)."\n";
echo "Midnight expiry: timezone-independent, month/year/leap boundary, last millisecond allowed, midnight denied, receipt preserved\n";
