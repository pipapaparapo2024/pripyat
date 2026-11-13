<?php
/** Private structured diagnostics; never record bearer codes, URLs, sessions or exception messages. */
final class RewardAudit {
 public static function write(string $stage,string $reason,string $world,int $uid,string $code): void {
  if(!in_array($world,['stalker','stalker_ok','stalker_site_test','stalker_test','stalker_ok_test','stalker_telegram','stalker_telegram_test'],true))$world='unknown';
  $safe=fn($v)=>preg_match('/^[a-z_]{1,64}$/D',$v)?$v:'unknown';
  $record=['stage'=>$safe($stage),'reason'=>$safe($reason),'world'=>$world,'player_id'=>max(0,$uid),'reward_hash'=>hash('sha256',$code)];
  try {if(function_exists('openlog')&&function_exists('syslog')&&function_exists('closelog')&&openlog('pripyat-rewards',LOG_PID,LOG_USER)){syslog(LOG_INFO,json_encode($record,JSON_THROW_ON_ERROR));closelog();}} catch(Throwable $ignored){}
 }
}
