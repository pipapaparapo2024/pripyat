<?php
$nativeModels=__DIR__.'/../server/core/models';if(!is_dir($nativeModels))$nativeModels=__DIR__.'/../../server/core/models';require_once $nativeModels.'/nativeavatarcache.php';
/** Cache is scoped by native world + game ID; never mixes equal IDs across worlds. */
final class SocialProfiles {
 public static function put(string $world,int $uid,?string $url): void {
  if($world!=='vk'||$uid<1||!is_string($url)||strlen($url)>4096||parse_url($url,PHP_URL_SCHEME)!=='https')return;
  $host=strtolower((string)parse_url($url,PHP_URL_HOST));$allowed=false;
  foreach(['userapi.com','vk.com','vk.ru','vkuserphoto.ru','vk-cdn.net','mycdn.me','okcdn.ru','vkuser.net'] as $suffix)if($host===$suffix||str_ends_with($host,'.'.$suffix))$allowed=true;
  if(!$allowed)return;$file=__DIR__.'/../private/social-profiles/'.$world.'-'.$uid.'.json';
  if(is_file($file)&&self::get($world,$uid)===$url)return;
  $tmp=$file.'.'.bin2hex(random_bytes(6)).'.tmp';file_put_contents($tmp,json_encode(['url'=>$url],JSON_THROW_ON_ERROR));chmod($tmp,0600);rename($tmp,$file);
 }
 public static function get(string $world,int $uid): ?string {
  if(in_array($world,['vk','ok'],true)&&$uid>0){$native=NativeAvatarCache::get($world,$uid);if($native!==null)return $native;}
  if($world!=='vk'||$uid<1)return null;$file=__DIR__.'/../private/social-profiles/'.$world.'-'.$uid.'.json';if(!is_file($file))return null;
  $d=json_decode(file_get_contents($file),true);return is_string($d['url']??null)?$d['url']:null;
 }
}
