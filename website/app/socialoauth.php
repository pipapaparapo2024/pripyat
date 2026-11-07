<?php
final class SocialOAuth {
 // Correlation only. Never put the OAuth state itself in the journal.
 public static function traceId(mixed $state,string $secret): string {
  if($secret===''||!is_string($state)||!preg_match('/^[a-f0-9]{64}$/D',$state))return '-';
  return substr(hash_hmac('sha256','oauth-trace:'.$state,$secret),0,24);
 }
 public static function failureReason(Throwable $error): string {
  return match($error->getMessage()){
   'invalid_social_state','invalid_callback','invalid_token_response','identity_mismatch',
   'social_provider_unavailable','invalid_social_response','invalid_social_config',
   'social_not_configured','rate_limited','access_denied','native_identity_missing',
   'social_link_required','native_mapping_missing','native_character_missing',
   'native_launch_required','closed_test_access_denied'=>$error->getMessage(),
   default=>'other',
  };
 }
 public static function begin(array $config,string $platform,int $now): array {
  if(!in_array($platform,['vk','ok'],true)||(string)($config['client_id']??'')!=='54875983'||($config['redirect_uri']??'')!=='https://pripyat-game-site.ru/auth/vk/callback')throw new InvalidArgumentException('invalid_social_config');
  $verifier=bin2hex(random_bytes(32));$state=bin2hex(random_bytes(32));
  $params=['client_id'=>$config['client_id'],'app_id'=>$config['client_id'],'redirect_uri'=>$config['redirect_uri'],'response_type'=>'code','code_challenge'=>rtrim(strtr(base64_encode(hash('sha256',$verifier,true)),'+/','-_'),'='),'code_challenge_method'=>'s256','state'=>$state,'provider'=>$platform==='ok'?'ok_ru':'vkid','scope'=>'vkid.personal_info'];
  return ['pending'=>['state'=>$state,'verifier'=>$verifier,'platform'=>$platform,'expires_at'=>$now+600],'url'=>'https://id.vk.ru/authorize?'.http_build_query($params)];
 }
 public static function consume(array &$session,string $state,int $now): array {
  $p=$session['social_oauth']??null;unset($session['social_oauth']);
  if(!is_array($p)||($p['expires_at']??0)<=$now||!preg_match('/^[a-f0-9]{64}$/D',$state)||!hash_equals($p['state'],$state))throw new DomainException('invalid_social_state');return $p;
 }
 public static function http(string $url,array $body): array {
  if(!in_array($url,['https://id.vk.ru/oauth2/auth','https://id.vk.ru/oauth2/user_info','https://api.vk.ru/method/users.get'],true))throw new InvalidArgumentException('invalid_endpoint');
  $ch=curl_init($url);$bytes='';curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>http_build_query($body),CURLOPT_HTTPHEADER=>['Content-Type: application/x-www-form-urlencoded'],CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>15,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_WRITEFUNCTION=>function($ch,$chunk)use(&$bytes){if(strlen($bytes)+strlen($chunk)>131072)return 0;$bytes.=$chunk;return strlen($chunk);}]);
  try{$ok=curl_exec($ch);$status=curl_getinfo($ch,CURLINFO_HTTP_CODE);}finally{curl_close($ch);}
  if($ok===false||$status!==200)throw new RuntimeException('social_provider_unavailable');$data=json_decode($bytes,true,32,JSON_THROW_ON_ERROR);if(!is_array($data))throw new RuntimeException('invalid_social_response');return $data;
 }
}
