<?php
namespace RewardAuditFixture;
$events=[];
function openlog(...$args){return true;}
function syslog($priority,$message){global $events;$events[]=json_decode($message,true,32,JSON_THROW_ON_ERROR);}
function closelog(){}
$root=dirname(__DIR__,2);
$source=file_get_contents($root.'/server/core/models/rewardaudit.php');
eval('namespace RewardAuditFixture;'.substr($source,5));
$code='r1_prod_vk_'.str_repeat('a',32);
RewardAudit::write('claim_result','credited','stalker',134895421,$code);
RewardAudit::write('claim_result',"bad\nsecret",'injected',-1,$code);
if(count($events)!==2||$events[0]['player_id']!==134895421||$events[0]['reward_hash']!==hash('sha256',$code)||$events[1]['reason']!=='unknown'||$events[1]['world']!=='unknown'||$events[1]['player_id']!==0||str_contains(json_encode($events),$code))throw new \RuntimeException('Unsafe reward diagnostics');
echo "reward audit privacy and identities passed\n";
