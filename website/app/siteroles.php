<?php
final class SiteRoles {
 public static function forEmail(string $email,array $config): array {
  $email=strtolower(trim($email));$access=$config['access']??[];
  if($email==='killer_ik@mail.ru')return [];
  if(($access['enabled']??false)!==true||!in_array($access['email']['mode']??'',['allowlist','open'],true))return [];
  $normalize=fn($values)=>array_map(fn($value)=>strtolower(trim($value)),$values);
  return (($access['email']['mode']??'')==='open'||in_array($email,$normalize($access['email']['ids']??[]),true))&&in_array($email,$normalize($config['developer_emails']??[]),true)?['developer']:[];
 }
}
