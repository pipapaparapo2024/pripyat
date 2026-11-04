<?php
/** Canonical, mutual Telegram friendship. Never reads VK/OK data. */
final class TelegramFriends {
    private $db;
    public function __construct(PDO $db){$this->db=$db;}
    private function q(string $sql,array $args=[]){$s=$this->db->prepare($sql);$s->execute($args);return $s;}
    public function playerId(string $external): ?int {
        $id=$this->q('SELECT player_id FROM telegram_identities WHERE telegram_id=?',[$external])->fetchColumn();
        return $id===false?null:(int)$id;
    }
    private function lockPlayers(array $ids): void {
        sort($ids,SORT_NUMERIC);
        foreach(array_unique($ids) as $id){
            if(!$this->q('SELECT id FROM users WHERE id=? FOR UPDATE',[$id])->fetchColumn())throw new InvalidArgumentException('player_missing');
        }
    }
    private function projectLocked(int $uid): void {
        $rows=$this->q('SELECT player_low,player_high,friends_since_ms FROM telegram_friendships WHERE player_low=? OR player_high=?',[$uid,$uid])->fetchAll(PDO::FETCH_ASSOC);
        $ids=[$uid];$since=[];
        foreach($rows as $r){$friend=(int)$r['player_low']===$uid?(int)$r['player_high']:(int)$r['player_low'];$ids[]=$friend;$since[(string)$friend]=(int)$r['friends_since_ms'];}
        sort($ids,SORT_NUMERIC);
        $this->q('UPDATE users SET friends=?,friends_since=? WHERE id=?',[implode(',',$ids),json_encode($since,JSON_FORCE_OBJECT),$uid]);
    }
    public function sync(int $uid): void {
        $this->db->beginTransaction();
        try{$this->lockPlayers([$uid]);$this->projectLocked($uid);$this->db->commit();}
        catch(Throwable $e){$this->db->rollBack();throw $e;}
    }
    public function invite(int $uid,int $now): string {
        $this->db->beginTransaction();
        try{
            $this->lockPlayers([$uid]);
            $code=$this->q('SELECT code FROM telegram_friend_invites WHERE owner_player_id=? AND revoked_at IS NULL ORDER BY created_at,code LIMIT 1',[$uid])->fetchColumn();
            if($code===false){$code=bin2hex(random_bytes(24));$this->q('INSERT INTO telegram_friend_invites (code,owner_player_id,created_at) VALUES (?,?,?)',[$code,$uid,$now]);}
            $this->db->commit();return 'https://t.me/pripyat_game_test_bot?start=f_'.$code;
        }catch(Throwable $e){$this->db->rollBack();throw $e;}
    }
    public function accept(int $uid,string $parameter,int $sinceMs): string {
        if(!preg_match('/^f_([a-f0-9]{48})$/D',$parameter,$m))return 'invalid';
        $owner=$this->q('SELECT owner_player_id FROM telegram_friend_invites WHERE code=? AND revoked_at IS NULL',[$m[1]])->fetchColumn();
        if($owner===false)return 'invalid';$owner=(int)$owner;
        if($owner===$uid)return 'self';
        $low=min($uid,$owner);$high=max($uid,$owner);
        $this->db->beginTransaction();
        try{
            // Same deterministic user lock order for accept/remove and gameplay writers.
            $this->lockPlayers([$low,$high]);
            $active=$this->q('SELECT owner_player_id FROM telegram_friend_invites WHERE code=? AND revoked_at IS NULL FOR UPDATE',[$m[1]])->fetchColumn();
            if((int)$active!==$owner)throw new InvalidArgumentException('invite_revoked');
            $existing=$this->q('SELECT friends_since_ms FROM telegram_friendships WHERE player_low=? AND player_high=?',[$low,$high])->fetchColumn();
            if($existing===false)$this->q('INSERT INTO telegram_friendships (player_low,player_high,friends_since_ms) VALUES (?,?,?)',[$low,$high,$sinceMs]);
            $this->projectLocked($low);$this->projectLocked($high);
            $this->db->commit();return $existing===false?'added':'existing';
        }catch(Throwable $e){$this->db->rollBack();throw $e;}
    }
    public function remove(int $uid,int $other): bool {
        if($other<1||$uid===$other)return false;
        $low=min($uid,$other);$high=max($uid,$other);
        $this->db->beginTransaction();
        try{
            $this->lockPlayers([$low,$high]);
            $s=$this->q('DELETE FROM telegram_friendships WHERE player_low=? AND player_high=?',[$low,$high]);$removed=$s->rowCount()===1;
            // Does NOT change rewards, damage logs, gym_pump_cooldowns or invitations.
            $this->projectLocked($low);$this->projectLocked($high);$this->db->commit();return $removed;
        }catch(Throwable $e){$this->db->rollBack();throw $e;}
    }
    public function list(int $uid,string $scope,int $page=0): array {
        if(!in_array($scope,['friends','others'],true))throw new InvalidArgumentException('invalid_scope');
        $page=max(0,min(100000,$page));$offset=$page*8;
        $relation='EXISTS (SELECT 1 FROM telegram_friendships f WHERE (f.player_low=? AND f.player_high=u.id) OR (f.player_high=? AND f.player_low=u.id))';
        $where='u.id<>? AND '.($scope==='others'?'NOT ':'').$relation;
        $total=(int)$this->q('SELECT COUNT(*) FROM users u WHERE '.$where,[$uid,$uid,$uid])->fetchColumn();
        $rows=$this->q('SELECT u.id,u.nick,u.level FROM users u WHERE '.$where.' ORDER BY u.id LIMIT 8 OFFSET '.$offset,[$uid,$uid,$uid])->fetchAll(PDO::FETCH_ASSOC);
        foreach($rows as &$r){$r['id']=(int)$r['id'];$r['level']=(int)$r['level'];$r['nick']=trim((string)$r['nick'])?:'Сталкер #'.$r['id'];}unset($r);
        return ['scope'=>$scope,'page'=>$page,'total'=>$total,'players'=>$rows,'has_next'=>$offset+count($rows)<$total];
    }
}
