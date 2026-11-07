<?php
final class NativeAvatarCache {
 public static function valid(string $url): bool {
  if(strlen($url)>4096||parse_url($url,PHP_URL_SCHEME)!=='https')return false;$host=strtolower((string)parse_url($url,PHP_URL_HOST));
  foreach(['userapi.com','vk.com','vk.ru','vkuserphoto.ru','vk-cdn.net','mycdn.me','okcdn.ru','vkuser.net'] as $suffix)if($host===$suffix||str_ends_with($host,'.'.$suffix))return true;return false;
 }
 private static function path(string $platform,int $uid): string {
  if(!in_array($platform,['vk','ok'],true)||$uid<1||$uid>2147483647)throw new InvalidArgumentException('invalid_avatar_identity');
  return '/tmp/pripyat-native-avatar-cache/'.$platform.'/'.$uid.'.json';
 }
 public static function put(string $platform,int $uid,string $url): bool {
  if(!self::valid($url))return false;$path=self::path($platform,$uid);if(!is_dir(dirname($path)))return false;
  $tmp=tempnam(dirname($path),'.avatar-');try{file_put_contents($tmp,json_encode(['url'=>$url,'updated_at'=>time()],JSON_THROW_ON_ERROR));chmod($tmp,0644);return rename($tmp,$path);}finally{if(is_file($tmp))unlink($tmp);}
 }
 public static function get(string $platform,int $uid): ?string {
  $path=self::path($platform,$uid);if(!is_file($path))return null;$data=json_decode(file_get_contents($path),true);$url=$data['url']??null;return is_string($url)&&self::valid($url)?$url:null;
 }
}
