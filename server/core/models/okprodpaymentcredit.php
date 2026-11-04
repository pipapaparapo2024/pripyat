<?php
/** Closed PROD OK ledger. Existing schema only; reservation and credit share one transaction. */
final class OkProdPaymentCredit {
    public static function credit(PDO $db,string $nativeUid,string $tid,int $product,int $amount,string $field,int $count,callable $resolveUid,int $now): string {
        if(!preg_match('/^[1-9][0-9]{0,19}$/D',$nativeUid)||!preg_match('/^[A-Za-z0-9_-]{1,128}$/D',$tid)||$amount<=0||$count<=0||!in_array($field,['coins','stew','cigarettes','energy'],true))throw new InvalidArgumentException('invalid_receipt');
        $db->beginTransaction();
        try{
            $q=$db->prepare('INSERT IGNORE INTO ok_payment_transactions(transaction_id,ok_uid,product_id,amount,reward_field,reward_count,created_at) VALUES(?,?,?,?,?,?,?)');$q->execute([$tid,$nativeUid,$product,$amount,$field,$count,$now]);
            if($q->rowCount()===0){
                $q=$db->prepare('SELECT ok_uid,product_id,amount FROM ok_payment_transactions WHERE transaction_id=?');$q->execute([$tid]);$old=$q->fetch(PDO::FETCH_ASSOC);
                if(!$old||(string)$old['ok_uid']!==$nativeUid||(int)$old['product_id']!==$product||(int)$old['amount']!==$amount)throw new InvalidArgumentException('transaction_conflict');
                $db->commit();return 'duplicate';
            }
            $uid=(int)$resolveUid();if($uid<=0)throw new InvalidArgumentException('account_mapping_missing');
            $q=$db->prepare('SELECT energy,energy_time,max_energy FROM users WHERE id=? FOR UPDATE');$q->execute([$uid]);$user=$q->fetch(PDO::FETCH_ASSOC);
            if(!$user)throw new InvalidArgumentException('unknown_player');
            if($field==='energy'){
                $anchor=(int)$user['energy_time']?:$now;$max=(int)$user['max_energy']?:50;$elapsed=max(0,$now-$anchor);
                $energy=max((int)$user['energy'],min($max,(int)$user['energy']+intdiv($elapsed,300)));
                $anchor=$energy>=$max?$now:$now-($elapsed%300);
                $q=$db->prepare('UPDATE users SET energy=?,energy_time=?,votes_spent=CAST(votes_spent AS DECIMAL(65,0))+? WHERE id=?');$q->execute([$energy+$count,$anchor,$amount,$uid]);
            }else{
                $q=$db->prepare('UPDATE users SET `'.$field.'`=CAST(`'.$field.'` AS DECIMAL(65,0))+CAST(? AS DECIMAL(65,0)),votes_spent=CAST(votes_spent AS DECIMAL(65,0))+? WHERE id=?');$q->execute([$count,$amount,$uid]);
            }
            $q=$db->prepare('UPDATE ok_payment_transactions SET game_uid=? WHERE transaction_id=?');$q->execute([$uid,$tid]);
            $db->commit();return 'credited';
        }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
    }
}
