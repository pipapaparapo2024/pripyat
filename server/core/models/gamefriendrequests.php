<?php
/** Requests are scoped to the supplied world database, never a client-selected database. */
final class GameFriendRequests {
 public function __construct(private PDO $db,private bool $telegram=false){}
 private function q(string $s,array $a=[]):PDOStatement{$q=$this->db->prepare($s);$q->execute($a);return $q;}
 public function incoming(int $uid):array{return ['requests'=>$this->q("SELECT r.sender_id AS id,u.nick FROM game_friend_requests r JOIN users u ON u.id=r.sender_id WHERE recipient_id=? AND status='pending' ORDER BY created_at DESC LIMIT 50",[$uid])->fetchAll(PDO::FETCH_ASSOC)];}
 public function act(int $uid,int $other,string $action):array{
  if($uid<1||$other<1||$other>2147483647||$uid===$other||!in_array($action,['send','accept','decline'],true))throw new DomainException('invalid_request');
  $this->db->beginTransaction();try{
   $ids=[$uid,$other];sort($ids,SORT_NUMERIC);$rows=$this->q('SELECT id,friends,friends_since FROM users WHERE id IN (?,?) ORDER BY id FOR UPDATE',$ids)->fetchAll(PDO::FETCH_ASSOC);if(count($rows)!==2)throw new DomainException('player_missing');
   if($action==='send'){
    $self=array_values(array_filter($rows,fn($r)=>(int)$r['id']===$uid))[0];if(in_array($other,array_map('intval',explode(',',(string)$self['friends'])),true))throw new DomainException('already_friends');
    $existing=$this->q('SELECT status,updated_at FROM game_friend_requests WHERE sender_id=? AND recipient_id=? FOR UPDATE',[$uid,$other])->fetch(PDO::FETCH_ASSOC);
    if($existing&&$existing['status']==='pending'){$this->db->commit();return ['ok'=>true];}
    if($existing&&(int)$existing['updated_at']>time()-3600)throw new DomainException('request_cooldown');
    if((int)$this->q('SELECT COUNT(*) FROM game_friend_requests WHERE sender_id=? AND created_at>?',[$uid,time()-3600])->fetchColumn()>=20)throw new DomainException('too_many_requests');
    $this->q("INSERT INTO game_friend_requests(sender_id,recipient_id,status,created_at,updated_at) VALUES(?,?,'pending',?,?) ON DUPLICATE KEY UPDATE status='pending',created_at=VALUES(created_at),updated_at=VALUES(updated_at)",[$uid,$other,time(),time()]);
   }else{
    $status=$this->q('SELECT status FROM game_friend_requests WHERE sender_id=? AND recipient_id=? FOR UPDATE',[$other,$uid])->fetchColumn();if($status!=='pending')throw new DomainException('request_missing');
    $this->q('UPDATE game_friend_requests SET status=?,updated_at=? WHERE sender_id=? AND recipient_id=?',[$action==='accept'?'accepted':'declined',time(),$other,$uid]);
    if($action==='accept'){
     $since=(int)floor(microtime(true)*1000);
     if($this->telegram)$this->q('INSERT IGNORE INTO telegram_friendships(player_low,player_high,friends_since_ms) VALUES(?,?,?)',[$ids[0],$ids[1],$since]);
     foreach($rows as $row){$id=(int)$row['id'];$partner=$id===$uid?$other:$uid;$friends=array_values(array_unique(array_merge(array_filter(array_map('intval',explode(',',(string)$row['friends'])),fn($v)=>$v>0),[$id,$partner])));sort($friends,SORT_NUMERIC);$map=json_decode($row['friends_since']?:'{}',true);if(!is_array($map))$map=[];$map[(string)$partner]=$map[(string)$partner]??$since;$this->q('UPDATE users SET friends=?,friends_since=? WHERE id=?',[implode(',',$friends),json_encode($map,JSON_FORCE_OBJECT|JSON_THROW_ON_ERROR),$id]);}
     $this->q("UPDATE game_friend_requests SET status='accepted',updated_at=? WHERE sender_id=? AND recipient_id=? AND status='pending'",[time(),$uid,$other]);
    }
   }
   $this->db->commit();return ['ok'=>true];
  }catch(Throwable $e){if($this->db->inTransaction())$this->db->rollBack();throw $e;}
 }
}
