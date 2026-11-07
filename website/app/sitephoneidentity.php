<?php
/** Самостоятельные аккаунты сайта: нормализация и защищённое хранение телефона. */
final class SitePhoneIdentity {
 public static function normalize(string $raw): string {
  $raw=trim($raw);
  if(strlen($raw)>40||!preg_match('/^\+?[0-9 ()-]+$/D',$raw))throw new InvalidArgumentException('invalid_phone');
  $digits=preg_replace('/[^0-9]/','',$raw);
  // Keep existing Russian spellings and HMACs; other countries require explicit +country code.
  if(!str_starts_with($raw,'+')){
   if(preg_match('/^89[0-9]{9}$/D',$digits))$digits='7'.substr($digits,1);
   elseif(!preg_match('/^79[0-9]{9}$/D',$digits))throw new InvalidArgumentException('invalid_phone');
  }
  // International syntax only. Actual reachability and ownership are checked by Zvonok.
  if(!preg_match('/^[1-9][0-9]{3,14}$/D',$digits)||($digits[0]==='7'&&strlen($digits)!==11))throw new InvalidArgumentException('invalid_phone');
  return '+'.$digits;
 }
 private static function key(string $key): void {
  if(strlen($key)!==SODIUM_CRYPTO_SECRETBOX_KEYBYTES)throw new RuntimeException('invalid_phone_key');
 }
 public static function fingerprint(string $phone,string $key): string {
  self::key($key);return hash_hmac('sha256','site-phone-v1:'.self::normalize($phone),$key);
 }
 public static function encrypt(string $phone,string $key): string {
  self::key($key);$nonce=random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
  return $nonce.sodium_crypto_secretbox(self::normalize($phone),$nonce,$key);
 }
 public static function decrypt(string $encrypted,string $key): string {
  self::key($key);
  if(strlen($encrypted)<SODIUM_CRYPTO_SECRETBOX_NONCEBYTES+SODIUM_CRYPTO_SECRETBOX_MACBYTES)throw new RuntimeException('invalid_phone_ciphertext');
  $plain=sodium_crypto_secretbox_open(substr($encrypted,SODIUM_CRYPTO_SECRETBOX_NONCEBYTES),substr($encrypted,0,SODIUM_CRYPTO_SECRETBOX_NONCEBYTES),$key);
  if($plain===false)throw new RuntimeException('invalid_phone_ciphertext');return self::normalize($plain);
 }
}
