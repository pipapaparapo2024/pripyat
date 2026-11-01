<?php
define('HABAR_RESTORE_TEST',true);
require __DIR__.'/../../tools/restore-habar-claims.php';
function verify($ok){if(!$ok)throw new Exception('Habar repair regression');}
$now=strtotime('2026-11-01T04:00:00+03:00')*1000;
$row=['id'=>'1','nick'=>'fixture','claimed_at'=>strtotime('2026-10-07T13:59:29+03:00'),'habar_bought'=>'2','habar_bought_ts'=>'1792509429751','habar_days_collected'=>'10','habar_last_collect_ts'=>'1234'];
$plan=planHabarClaimRestore($row,$now);
verify($plan['action']==='restore' && $plan['elapsed_days']===25);
verify($plan['expires_ms']===strtotime('2026-11-06T00:00:00+03:00')*1000);
verify($plan['after']['habar_days_collected']==='10' && $plan['after']['habar_last_collect_ts']==='1234');
verify($plan['after']['habar_bought_ts']===strval($row['claimed_at']*1000));
verify(planHabarClaimRestore($row,$plan['expires_ms']-1)['action']==='restore');
verify(planHabarClaimRestore($row,$plan['expires_ms'])['action']==='expire');
$expired=$row;$expired['claimed_at']=strtotime('2026-09-27T19:30:17+03:00');
$cleared=planHabarClaimRestore($expired,$now);
verify($cleared['action']==='expire' && $cleared['after']===array_fill_keys(array_keys($plan['before']),'0'));
verify(planHabarClaimRestore(array_merge($expired,$cleared['after']),$now)['action']==='skip');
$again=planHabarClaimRestore(array_merge($row,$plan['after']),$now);
verify($again['before']===$again['after']);
$other=$row;$other['habar_bought']='4';verify(planHabarClaimRestore($other,$now)['action']==='skip');
$bought=$row;$bought['habar_bought_ts']=strval($now);verify(planHabarClaimRestore($bought,$now)['action']==='skip');
echo "Habar repair: original dates, 25/30, exact expiry, preserved collections, idempotency, unrelated accounts skipped\n";
