<?php
/** Serializes TEST login and complete API operations, including legacy mysqli writes. No DDL. */
final class TelegramPlayerLock {
    private $db,$name,$released=false;
    public function __construct(PDO $db,int $uid){
        if($uid<1||$uid>2147483647)throw new InvalidArgumentException('invalid_lock_player');
        $this->db=$db;$this->name='pripyat.telegram.test.player.'.$uid;
        $q=$db->prepare('SELECT GET_LOCK(?, 5)');$q->execute([$this->name]);
        if((string)$q->fetchColumn()!=='1'){$this->released=true;throw new RuntimeException('player_busy');}
    }
    public function release(): void {
        if($this->released)return;$this->released=true;
        $q=$this->db->prepare('SELECT RELEASE_LOCK(?)');$q->execute([$this->name]);
    }
    public function __destruct(){try{$this->release();}catch(Throwable $e){/* Closing the nonpersistent PDO connection also releases the lock. */}}
    public static function forSession(PDO $db,string $token): ?self {
        if(!preg_match('/^[a-f0-9]{64}$/D',$token))return null;
        $q=$db->prepare('SELECT player_id FROM telegram_sessions WHERE token_hash=?');$q->execute([hash('sha256',$token)]);
        $uid=$q->fetchColumn();return $uid===false?null:new self($db,(int)$uid);
    }
}
