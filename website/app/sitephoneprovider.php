<?php
require_once __DIR__.'/sitephoneidentity.php';
/** Incoming verification only; no response fields containing credentials are logged. */
final class SitePhoneProvider {
 public function __construct(private array $config) {}
 private function request(string $path,array $args,bool $post): array {
  $c=$this->config;
  if(($c['enabled']??false)!==true||($c['provider']??'')!=='zvonok'||($c['api_version']??'')!=='v1'||empty($c['api_key'])||empty($c['campaign_id']))throw new RuntimeException('phone_disabled');
  $args['public_key']=$c['api_key'];$url='https://zvonok.com/manager/cabapi_external/api/v1/phones/'.$path.'/';
  if(!$post)$url.='?'.http_build_query($args);
  $ch=curl_init($url);$bytes='';
  curl_setopt_array($ch,[CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>15,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_WRITEFUNCTION=>function($ch,$chunk)use(&$bytes){if(strlen($bytes)+strlen($chunk)>131072)return 0;$bytes.=$chunk;return strlen($chunk);}]);
  if($post)curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>http_build_query($args),CURLOPT_HTTPHEADER=>['Content-Type: application/x-www-form-urlencoded']]);
  try{$ok=curl_exec($ch);$status=curl_getinfo($ch,CURLINFO_HTTP_CODE);}finally{curl_close($ch);}
  if($ok===false||$status!==200)throw new RuntimeException('phone_provider_unavailable');
  $data=json_decode($bytes,true,32,JSON_THROW_ON_ERROR);if(!is_array($data))throw new RuntimeException('phone_provider_invalid');return $data;
 }
 public function start(string $phone): array {
  $phone=SitePhoneIdentity::normalize($phone);
  $r=$this->request('confirm',['phone'=>$phone,'campaign_id'=>$this->config['campaign_id']],true);
  $d=$r['data']??null;
  if(($r['status']??'')!=='ok'||!is_array($d)||($d['phone']??'')!==$phone||!preg_match('/^[1-9][0-9]{0,19}$/D',(string)($d['call_id']??''))||!is_array($d['allowed_phones_for_call']??null)||!count($d['allowed_phones_for_call']))throw new RuntimeException('phone_provider_invalid');
  $numbers=[];foreach($d['allowed_phones_for_call'] as $number)$numbers[]=SitePhoneIdentity::normalize($number);
  return ['provider_check_id'=>(string)$d['call_id'],'call_phone'=>$numbers[0]];
 }
 public static function confirmed(array $row,string $id,string $phone): bool {
  return (string)($row['call_id']??'')===$id&&($row['phone']??'')===SitePhoneIdentity::normalize($phone)&&($row['status']??'')==='pincode_ok'&&is_string($row['completed']??null)&&$row['completed']!=='';
 }
 public function check(string $id,string $phone): bool {
  if(!preg_match('/^[1-9][0-9]{0,19}$/D',$id))throw new InvalidArgumentException('invalid_check');
  $r=$this->request('call_by_id',['call_id'=>$id,'expand'=>0],false);
  if(!array_is_list($r))throw new RuntimeException('phone_provider_invalid');
  foreach($r as $row)if(is_array($row)&&self::confirmed($row,$id,$phone))return true;
  return false;
 }
}
