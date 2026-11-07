<?php
/** Independent of game backups. A restored account cannot regain access. */
final class ErasedAccounts {
 public static function assertAllowed(string $world,int $uid,?string $file=null): void {
  if(!in_array($world,['site','vk','ok'],true)||$uid<1)throw new InvalidArgumentException('invalid_identity');
  $file??='/tmp/pripyat-privacy/erased-accounts.json';
  if(!is_file($file)){if(PHP_SAPI==='cli')return;throw new RuntimeException('erasure_guard_unavailable');}
  $data=json_decode(file_get_contents($file),true,16,JSON_THROW_ON_ERROR);
  if(!is_array($data)||!isset($data['entries'])||!is_array($data['entries']))throw new RuntimeException('erasure_guard_unavailable');
  $key=hash('sha256',$world.':'.$uid);
  if(isset($data['entries'][$key]))throw new DomainException('account_erased');
 }
}
