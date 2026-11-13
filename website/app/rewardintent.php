<?php
require_once __DIR__.'/rewardaudit.php';
final class RewardIntent {
 public static function audit(string $stage,string $reason,int $uid=0,?string $platform=null):void{
  $i=$_SESSION['reward_intent']??[];if(!is_string($i['code']??null))return;
  $platform=$platform??($i['platform']??'');
  $world=['vk'=>'stalker','ok'=>'stalker_ok','site'=>'stalker_site_test'][$platform]??'unknown';
  if(str_starts_with($i['code'],'r1_test_'))$world=['vk'=>'stalker_test','ok'=>'stalker_ok_test','site'=>'stalker_site_test'][$platform]??'unknown';
  RewardAudit::write($stage,$reason,$world,$uid,$i['code']);
 }
 public static function capture(array $input,int $now):void{
  if(!isset($input['reward']))return;$code=$input['reward'];$platform=$input['platform']??null;
  if(!is_string($code)||!preg_match('/^r1_(test|prod)_(vk|ok|site)_[a-f0-9]{32}$/D',$code,$m)||$platform!==$m[2])throw new DomainException('invalid_reward_intent');
  $_SESSION['reward_intent']=['code'=>$code,'platform'=>$platform,'expires_at'=>$now+3600];
  self::audit('capture','received');
 }
 public static function current(string $platform,int $now):?string{$i=$_SESSION['reward_intent']??[];return ($i['platform']??null)===$platform&&($i['expires_at']??0)>$now?$i['code']:null;}
}
