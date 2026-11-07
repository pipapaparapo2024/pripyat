<?php
final class RewardIntent {
 public static function capture(array $input,int $now):void{
  if(!isset($input['reward']))return;$code=$input['reward'];$platform=$input['platform']??null;
  if(!is_string($code)||!preg_match('/^r1_(test|prod)_(vk|ok|site)_[a-f0-9]{32}$/D',$code,$m)||$platform!==$m[2])throw new DomainException('invalid_reward_intent');
  $_SESSION['reward_intent']=['code'=>$code,'platform'=>$platform,'expires_at'=>$now+3600];
 }
 public static function current(string $platform,int $now):?string{$i=$_SESSION['reward_intent']??[];return ($i['platform']??null)===$platform&&($i['expires_at']??0)>$now?$i['code']:null;}
}
