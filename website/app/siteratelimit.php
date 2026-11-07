<?php
/** Межпроцессный лимит запросов. Ключи не содержат почту/телефон/IP открытым текстом. */
final class SiteRateLimit {
 public function __construct(private string $directory,private string $secret) {
  if(strlen($secret)<32||!is_dir($directory))throw new RuntimeException('rate_limit_not_configured');
 }
 public function consume(string $scope,string $identity,int $limit,int $seconds,int $now): void {
  if($limit<1||$seconds<1||!preg_match('/^[a-z-]+$/D',$scope))throw new InvalidArgumentException('invalid_rate_limit');
  $name=hash_hmac('sha256',$scope.':'.$identity,$this->secret);
  $path=$this->directory.'/'.$name.'.json';$f=fopen($path,'c+');
  if(!$f||!flock($f,LOCK_EX))throw new RuntimeException('rate_limit_unavailable');
  try{
   $raw=stream_get_contents($f);$d=$raw===''?[]:json_decode($raw,true,8,JSON_THROW_ON_ERROR);
   if(!is_array($d))throw new RuntimeException('rate_limit_corrupted');
   $events=array_values(array_filter($d,fn($t)=>is_int($t)&&$t>$now-$seconds));
   if(count($events)>=$limit)throw new DomainException('rate_limited');
   $events[]=$now;rewind($f);ftruncate($f,0);fwrite($f,json_encode($events,JSON_THROW_ON_ERROR));fflush($f);
  }finally{flock($f,LOCK_UN);fclose($f);}
 }
}
