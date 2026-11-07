<?php
/** Shared lock namespace for native and website requests on the same character. */
final class NativePlayerSessionLock {
 public static function name(string $database,int $uid): string {
  if(!in_array($database,['stalker','stalker_ok'],true)||$uid<1||$uid>2147483647)throw new InvalidArgumentException('invalid_native_player');
  return 'pripyat.native.prod.'.$database.'.player.'.$uid;
 }
 public static function acquire(PDO $db,string $database,int $uid): string {
  $name=self::name($database,$uid);$q=$db->prepare('SELECT GET_LOCK(?,10)');$q->execute([$name]);if((int)$q->fetchColumn()!==1)throw new RuntimeException('native_player_busy');return $name;
 }
 public static function release(PDO $db,string $name): void {$q=$db->prepare('SELECT RELEASE_LOCK(?)');$q->execute([$name]);}
}
