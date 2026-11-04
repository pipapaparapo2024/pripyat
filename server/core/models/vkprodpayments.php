<?php
/** Native VK PROD receipts: atomic credit and ledger; no schema changes. */
final class VkProdPayments {
    public static function verify(array $input,string $secret,string $appId,array $allowed,bool $allowSandbox=false): array {
        $input=self::verifySignature($input,$secret,$appId);
        // Catalog lookup is read-only; VK may request it before selecting payment mode.
        // Sandbox is opt-in for the closed developer rehearsal only.
        if(!in_array($input['notification_type']??'', array_merge(['get_item','get_item_test','order_status_change'],$allowSandbox?['order_status_change_test']:[]),true))throw new InvalidArgumentException('production_notifications_only');
        $uid=(string)($input['user_id']??'');
        if(!preg_match('/^[1-9][0-9]{0,9}$/D',$uid)||(int)$uid>2147483647||!in_array($uid,$allowed,true))throw new InvalidArgumentException('developer_required');
        return $input;
    }
    public static function verifySignature(array $input,string $secret,string $appId): array {
        $signature=$input['sig']??null;unset($input['sig']);
        if(!is_string($signature)||!preg_match('/^[a-f0-9]{32}$/D',$signature)||$secret==='')throw new InvalidArgumentException('invalid_signature');
        foreach($input as $k=>$v)if(!is_string($k)||!is_scalar($v))throw new InvalidArgumentException('invalid_payload');
        ksort($input);$text='';foreach($input as $k=>$v)$text.=$k.'='.$v;
        if(!hash_equals(md5($text.$secret),$signature))throw new InvalidArgumentException('invalid_signature');
        if((string)($input['app_id']??'')!==$appId)throw new InvalidArgumentException('wrong_app');
        return $input;
    }
    public static function catalog(array $prices): array {
        $out=[];$offset=0;$names=['stew'=>'тушёнки','coins'=>'рублей','cigarettes'=>'сухарей'];
        foreach($names as $field=>$title){
            foreach($prices[$field]['default'] as $i=>$amount){
                $price=$prices[$field]['price'][$i]/7;
                if($price<1||floor($price)!=$price)throw new RuntimeException('invalid_catalog');
                $out[$offset+$i]=['field'=>$field,'count'=>(int)$amount,'price'=>(int)$price,'title'=>$amount.' '.$title];
            }$offset+=count($prices[$field]['default']);
        }
        foreach([50,110,180,400,850,1300,2000,3500] as $i=>$amount)$out[100+$i]=['field'=>'energy','count'=>$amount,'price'=>[3,7,10,20,40,60,85,120][$i],'title'=>$amount.' энергии'];
        return $out;
    }
    public static function productId($raw): int {
        if(!is_scalar($raw)||!preg_match('/^(?:item)?([0-9]{1,3})$/D',(string)$raw,$m))throw new InvalidArgumentException('invalid_product');
        return (int)$m[1];
    }
    public static function credit(PDO $db,array $input,array $product,int $now,bool $allowSandbox=false): string {
        if(($input['notification_type']??'')!=='order_status_change'&&!($allowSandbox&&($input['notification_type']??'')==='order_status_change_test'))throw new InvalidArgumentException('production_notifications_only');
        $tid=(string)($input['order_id']??'');$uid=(int)$input['user_id'];
        if(!preg_match('/^[1-9][0-9]{0,17}$/D',$tid)||($input['status']??'')!=='chargeable')throw new InvalidArgumentException('invalid_order');
        if(isset($input['receiver_id'])&&(string)$input['receiver_id']!==(string)$input['user_id'])throw new InvalidArgumentException('receiver_mismatch');
        if(isset($input['item_price'])&&(string)$input['item_price']!==(string)$product['price'])throw new InvalidArgumentException('price_mismatch');
        // Separate sandbox order IDs in the existing signed BIGINT ledger; no schema change.
        if(($input['notification_type']??'')==='order_status_change_test')$tid='-'.$tid;
        $db->beginTransaction();
        try{
            $q=$db->prepare('INSERT IGNORE INTO trans (tid,uid,time,count) VALUES (?,?,?,?)');$q->execute([$tid,$uid,$now,$product['price']]);
            if($q->rowCount()===0){
                $q=$db->prepare('SELECT uid,count FROM trans WHERE tid=?');$q->execute([$tid]);$old=$q->fetch(PDO::FETCH_ASSOC);
                if(!$old||(int)$old['uid']!==$uid||(int)$old['count']!==$product['price'])throw new InvalidArgumentException('transaction_conflict');
                $db->commit();return 'duplicate';
            }
            $q=$db->prepare('SELECT id,energy,energy_time,max_energy FROM users WHERE id=? FOR UPDATE');$q->execute([$uid]);$user=$q->fetch(PDO::FETCH_ASSOC);
            if(!$user)throw new InvalidArgumentException('unknown_player');
            $field=$product['field'];if(!in_array($field,['stew','coins','cigarettes','energy'],true)||$product['count']<=0)throw new RuntimeException('invalid_product');
            if($field==='energy'){
                $anchor=(int)$user['energy_time']?:$now;$max=(int)$user['max_energy']?:50;$elapsed=max(0,$now-$anchor);
                $energy=max((int)$user['energy'],min($max,(int)$user['energy']+intdiv($elapsed,300)));
                $anchor=$energy>=$max?$now:$now-($elapsed%300);
                $q=$db->prepare('UPDATE users SET energy=?,energy_time=?,votes_spent=CAST(votes_spent AS DECIMAL(65,0))+? WHERE id=?');$q->execute([$energy+$product['count'],$anchor,$product['price'],$uid]);
            }else{
                $q=$db->prepare('UPDATE users SET `'.$field.'`=CAST(`'.$field.'` AS DECIMAL(65,0))+CAST(? AS DECIMAL(65,0)), votes_spent=CAST(votes_spent AS DECIMAL(65,0))+? WHERE id=?');$q->execute([$product['count'],$product['price'],$uid]);
            }
            $db->commit();return 'credited';
        }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
    }
}
