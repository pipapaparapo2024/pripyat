<?php
// Separate from VK trans: that legacy table has a numeric BIGINT primary key.
class OkPaymentCredit {
    const CREATE_SQL="CREATE TABLE IF NOT EXISTS ok_payment_transactions (transaction_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY, ok_uid VARCHAR(20) CHARACTER SET ascii NOT NULL, game_uid BIGINT NOT NULL DEFAULT 0, product_id INT NOT NULL, amount INT NOT NULL, reward_field VARCHAR(16) CHARACTER SET ascii NOT NULL, reward_count BIGINT NOT NULL, created_at BIGINT NOT NULL) ENGINE=InnoDB";
    static function credit($db,$nativeUid,$tid,$product,$amount,$field,$count,$resolveUid){
        if(!in_array($field,['stew','coins','cigarettes','energy'],true) || $count<=0)throw new RuntimeException('invalid_reward');
        if(!preg_match('/^[a-zA-Z0-9_-]{1,128}$/D',$tid))throw new RuntimeException('invalid_transaction');
        if(!$db->begin_transaction())throw new RuntimeException('transaction_failed');
        try{
            $now=time();$native=strval($nativeUid);
            $s=$db->prepare('INSERT IGNORE INTO ok_payment_transactions (transaction_id,ok_uid,product_id,amount,reward_field,reward_count,created_at) VALUES (?,?,?,?,?,?,?)');
            $s->bind_param('ssiisii',$tid,$native,$product,$amount,$field,$count,$now);
            if(!$s->execute())throw new RuntimeException('reservation_failed');
            $reserved=$s->affected_rows===1;$s->close();
            if(!$reserved){
                $s=$db->prepare('SELECT ok_uid,product_id,amount FROM ok_payment_transactions WHERE transaction_id=?');$s->bind_param('s',$tid);
                if(!$s->execute())throw new RuntimeException('lookup_failed');$row=$s->get_result()->fetch_assoc();$s->close();
                if(!$row || strval($row['ok_uid'])!==$native || intval($row['product_id'])!==$product || intval($row['amount'])!==$amount)throw new RuntimeException('transaction_conflict');
                $db->rollback();return ['duplicate'=>true];
            }
            $uid=intval($resolveUid());if($uid<=0)throw new RuntimeException('account_mapping_missing');
            $s=$db->prepare("SELECT `$field` FROM users WHERE id=? FOR UPDATE");$s->bind_param('i',$uid);
            if(!$s->execute())throw new RuntimeException('user_lookup_failed');$row=$s->get_result()->fetch_assoc();$s->close();
            if(!$row)throw new RuntimeException('user_missing');
            if(!isset($row[$field]) || !preg_match('/^[0-9]{1,65}$/D',strval($row[$field])))throw new RuntimeException('invalid_balance');
            $s=$db->prepare("UPDATE users SET `$field`=CAST(`$field` AS DECIMAL(65,0))+? WHERE id=?");$s->bind_param('ii',$count,$uid);
            if(!$s->execute() || $s->affected_rows!==1)throw new RuntimeException('credit_failed');$s->close();
            $s=$db->prepare('UPDATE ok_payment_transactions SET game_uid=? WHERE transaction_id=?');$s->bind_param('is',$uid,$tid);
            if(!$s->execute())throw new RuntimeException('ledger_failed');$s->close();
            if(!$db->commit())throw new RuntimeException('commit_failed');
            return ['duplicate'=>false,'uid'=>$uid];
        }catch(Throwable $error){$db->rollback();throw $error;}
    }
}
