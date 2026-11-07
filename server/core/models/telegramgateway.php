<?php
final class TelegramGateway {
    const DEV_METHODS=['users.devGetLogs','users.devGrantEnergy','bosses.devGrantKeys','bosses.devResetDailyLimits','users.devGrantWeapons','users.devGrantShmot','users.devGrantCurrency','users.devSetRyukzakLevel','users.setDevFlag','users.setDevCombo','users.toggleDevKeyring','users.devPeekRouletteCups','users.resetSession'];
    public static function requiresDeveloper(string $method): bool {return in_array($method,self::DEV_METHODS,true);}
    const CLASSES = ['users','event','vassilich','habar','hapuga','shmot','base','gangs','bp','tasks','top','bosses','roulette','zone','dice','yashik','weapons','skills','poker','blackjack','zaruba','ryukzak','hata','achievements','rewardlinks','dvor','raznaryadka','game2048','zanachki'];
    public static function allowed(string $method): bool {
        if($method==='telegramavatars.get')return true;
        if(self::requiresDeveloper($method))return true;
        if(in_array($method,['telegramstars.create','telegramstars.status'],true))return true;
        if(in_array($method,['telegramfriends.list','telegramfriends.requests','telegramfriends.send','telegramfriends.accept','telegramfriends.decline','telegramfriends.remove'],true))return true;
        if (!preg_match('/^([a-z0-9]+)\.([A-Za-z][A-Za-z0-9]*)$/D', $method, $m) || !in_array($m[1], self::CLASSES, true)) return false;
        // Legacy UID-based admin and platform-specific identity operations stay closed.
        if (preg_match('/^(dev|reset|setDev|toggleDev)/i', $m[2])) return false;
        if ($m[1] === 'event' && $m[2] !== 'get') return false;
        if ($m[1] === 'users' && in_array($m[2], ['setFriendsScopeGranted','setFriendsCache'], true)) return false;
        return true;
    }
    public static function authenticate(PDO $db, string $token, string $key, int $now): array {
        if (!preg_match('/^[a-f0-9]{64}$/D', $token)) return ['code'=>5];
        $hash=hash('sha256',$token);
        $q=$db->prepare('SELECT player_id,expires_at,request_key FROM telegram_sessions WHERE token_hash=?');
        $q->execute([$hash]); $session=$q->fetch(PDO::FETCH_ASSOC);
        if (!$session) return ['code'=>5];
        if ((int)$session['expires_at'] <= $now) return ['code'=>3];
        if (!preg_match('/^[a-f0-9]{32}$/D', $key) || !hash_equals((string)$session['request_key'],$key)) return ['code'=>4,'req_key'=>$session['request_key']];
        $next=bin2hex(random_bytes(16));
        $q=$db->prepare('UPDATE telegram_sessions SET request_key=? WHERE token_hash=? AND request_key=? AND expires_at>?');
        $q->execute([$next,$hash,$key,$now]);
        if ($q->rowCount() !== 1) return ['code'=>4];
        return ['uid'=>(int)$session['player_id'],'req_key'=>$next];
    }
    public static function parameters(string $method, array $params, int $uid, PDO $db): array {
        if ($method === 'users.save' && isset($params['udata_json'])) {
            if (!is_string($params['udata_json'])) throw new InvalidArgumentException('invalid_save');
            $data=json_decode($params['udata_json'],true,64,JSON_THROW_ON_ERROR);
            if (!is_array($data)) throw new InvalidArgumentException('invalid_save');
            // Canonical friendship cannot be replaced by a client cache or full snapshot.
            unset($data['id'],$data['friends'],$data['friends_since'],$data['friends_scope_granted'],$data['energy'],$data['energy_time']);
            $params['udata_json']=json_encode($data,JSON_THROW_ON_ERROR);
        }
        if ($method === 'users.get') {
            $q=$db->prepare('SELECT player_low,player_high,friends_since_ms FROM telegram_friendships WHERE player_low=? OR player_high=?');
            $q->execute([$uid,$uid]);$ids=[$uid];$since=[];
            foreach ($q->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $friend=(int)$row['player_low']===$uid ? (int)$row['player_high'] : (int)$row['player_low'];
                $ids[]=$friend;$since[(string)$friend]=(int)$row['friends_since_ms'];
            }
            $list=implode(',',$ids);
            // Canonical projection is updated under user locks by TelegramFriends::sync.
            // A late request must never restore an old friendship after removal.
            $params['users']=$list;
        }
        return $params;
    }
}
