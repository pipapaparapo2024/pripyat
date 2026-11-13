<?php
/** Only authenticated Telegram receipts may credit inventory. Client invoice status is not proof. */
final class TelegramStars {
    private $db,$catalog,$bot;
    public function __construct(PDO $db,array $catalog,$bot){$this->db=$db;$this->catalog=$catalog;$this->bot=$bot;}
    private function q(string $sql,array $args=[]){$q=$this->db->prepare($sql);$q->execute($args);return $q;}
    public static function product(array $catalog,int $id): array {
        $names=['stew'=>'тушёнки','coins'=>'рублей','cigarettes'=>'сухарей','energy'=>'энергии'];
        foreach($names as $field=>$name){$index=array_search($id,$catalog[$field]['ids'],true);if($index!==false){
            return ['id'=>$id,'field'=>$field,'count'=>$catalog[$field]['amounts'][$index],'stars'=>$catalog[$field]['stars'][$index],'title'=>$catalog[$field]['amounts'][$index].' '.$name];
        }}
        throw new InvalidArgumentException('unknown_product');
    }
    public static function matches(array $order,string $telegramId,array $payment): bool {
        return (string)$order['telegram_id']===$telegramId && ($payment['currency']??'')==='XTR'
            && is_int($payment['total_amount']??null) && $payment['total_amount']===(int)$order['stars']
            && ($payment['invoice_payload']??'')==='tg1_'.$order['order_id'];
    }
    public function create(int $uid,int $productId,int $now): array {
        $p=self::product($this->catalog,$productId);
        $external=$this->q('SELECT telegram_id FROM telegram_identities WHERE player_id=?',[$uid])->fetchColumn();
        if($external===false)throw new InvalidArgumentException('unknown_player');
        $recent=(int)$this->q('SELECT COUNT(*) FROM telegram_payment_orders WHERE player_id=? AND created_at>?',[$uid,$now-60])->fetchColumn();
        if($recent>=10)throw new InvalidArgumentException('too_many_orders');
        $id=bin2hex(random_bytes(24));
        $this->q('INSERT INTO telegram_payment_orders (order_id,player_id,telegram_id,product_id,stars,reward_field,reward_count,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?)',[$id,$uid,(string)$external,$productId,$p['stars'],$p['field'],$p['count'],$now,$now+1800]);
        $description=TelegramEnvironment::name()==='prod'?'Покупка для персонажа в Telegram «Припять».':'Покупка для персонажа в Telegram TEST «Припять».';
        $url=$this->bot->call('createInvoiceLink',['title'=>$p['title'],'description'=>$description,'payload'=>'tg1_'.$id,'currency'=>'XTR','prices'=>[['label'=>$p['title'],'amount'=>$p['stars']]]]);
        if(!is_string($url)||!preg_match('~^https://t\.me/\$[A-Za-z0-9_-]+$~D',$url))throw new RuntimeException('invalid_invoice_url');
        error_log('[telegram-stars] event=invoice-created');
        return ['order_id'=>$id,'invoice_url'=>$url,'stars'=>$p['stars'],'product_id'=>$productId];
    }
    private function orderId(array $payment): string {
        if(!is_string($payment['invoice_payload']??null)||!preg_match('/^tg1_([a-f0-9]{48})$/D',$payment['invoice_payload'],$m))throw new InvalidArgumentException('invalid_invoice');
        return $m[1];
    }
    public function precheckout(string $external,array $query,int $now): bool {
        try{$id=$this->orderId($query);}catch(InvalidArgumentException $e){return false;}
        $queryId=$query['id']??'';if(!is_string($queryId)||strlen($queryId)<1||strlen($queryId)>255)return false;
        $this->db->beginTransaction();
        try{
            $o=$this->q('SELECT * FROM telegram_payment_orders WHERE order_id=? FOR UPDATE',[$id])->fetch(PDO::FETCH_ASSOC);
            $ok=$o && self::matches($o,$external,$query) && (int)$o['expires_at']>$now && in_array($o['status'],['created','checkout'],true) && ($o['checkout_id']===null||$o['checkout_id']===$queryId);
            if($ok)$this->q("UPDATE telegram_payment_orders SET status='checkout',checkout_id=? WHERE order_id=?",[$queryId,$id]);
            $this->db->commit();return (bool)$ok;
        }catch(Throwable $e){$this->db->rollBack();throw $e;}
    }
    public static function energyAfterPurchase(array $user,int $amount,int $now): array {
        $saved=(int)$user['energy'];$anchor=(int)$user['energy_time'];$max=(int)$user['max_energy']?:50;
        if($anchor<=0)$anchor=$now;
        $elapsed=max(0,$now-$anchor);$energy=max($saved,min($max,$saved+intdiv($elapsed,300)));
        $base=$energy>=$max?$now:$now-($elapsed%300);
        return [$energy+$amount,$base];
    }
    public function credit(string $external,array $payment,int $now): string {
        $id=$this->orderId($payment);$charge=$payment['telegram_payment_charge_id']??'';
        if(!is_string($charge)||!preg_match('/^[\x21-\x7e]{1,255}$/D',$charge))throw new InvalidArgumentException('invalid_charge');
        $this->db->beginTransaction();
        try{
            $o=$this->q('SELECT * FROM telegram_payment_orders WHERE order_id=? FOR UPDATE',[$id])->fetch(PDO::FETCH_ASSOC);
            if(!$o||!self::matches($o,$external,$payment))throw new InvalidArgumentException('receipt_mismatch');
            $old=$this->q('SELECT order_id FROM telegram_payment_transactions WHERE charge_id=?',[$charge])->fetchColumn();
            if($old!==false){if($old!==$id)throw new InvalidArgumentException('charge_conflict');$this->db->commit();return 'duplicate';}
            if(!in_array($o['status'],['created','checkout'],true))throw new InvalidArgumentException('order_already_paid');
            $field=$o['reward_field'];if(!in_array($field,['stew','coins','cigarettes','energy'],true))throw new RuntimeException('invalid_reward');
            $user=$this->q('SELECT id,energy,energy_time,max_energy FROM users WHERE id=? FOR UPDATE',[$o['player_id']])->fetch(PDO::FETCH_ASSOC);
            if(!$user)throw new RuntimeException('player_missing');
            $this->q('INSERT INTO telegram_payment_transactions (charge_id,order_id,player_id,stars,credited_at) VALUES (?,?,?,?,?)',[$charge,$id,$o['player_id'],$o['stars'],$now]);
            if($field==='energy'){
                [$energy,$anchor]=self::energyAfterPurchase($user,(int)$o['reward_count'],$now);
                $this->q('UPDATE users SET energy=?,energy_time=? WHERE id=?',[$energy,$anchor,$o['player_id']]);
            }else{
                // SQL integer arithmetic preserves balances above JS's exact-number range.
                $this->q('UPDATE users SET `'.$field.'`=CAST(`'.$field.'` AS DECIMAL(65,0))+CAST(? AS DECIMAL(65,0)) WHERE id=?',[$o['reward_count'],$o['player_id']]);
            }
            $this->q("UPDATE telegram_payment_orders SET status='paid' WHERE order_id=?",[$id]);
            $this->db->commit();error_log('[telegram-stars] event=credited');return 'credited';
        }catch(Throwable $e){$this->db->rollBack();error_log('[telegram-stars] event=credit-rejected');throw $e;}
    }
    public function status(int $uid,string $id): array {
        if(!preg_match('/^[a-f0-9]{48}$/D',$id))throw new InvalidArgumentException('invalid_order');
        $status=$this->q('SELECT status FROM telegram_payment_orders WHERE order_id=? AND player_id=?',[$id,$uid])->fetchColumn();
        if($status===false)throw new InvalidArgumentException('unknown_order');return ['payment_status'=>$status];
    }
    public function recentPayments(int $limit=10): array {
        $limit=max(1,min(20,$limit));
        return $this->q('SELECT t.charge_id,t.stars,t.credited_at,t.refunded_at,o.telegram_id,o.order_id FROM telegram_payment_transactions t JOIN telegram_payment_orders o ON o.order_id=t.order_id ORDER BY t.credited_at DESC LIMIT '.$limit)->fetchAll(PDO::FETCH_ASSOC);
    }
    /** Owner-initiated refund; the source charge and recipient are resolved only from our receipt ledger. */
    public function refund(string $charge,int $now): array {
        if(!preg_match('/^[\x21-\x7e]{1,255}$/D',$charge))throw new InvalidArgumentException('invalid_charge');
        $this->db->beginTransaction();
        try{
            $row=$this->q('SELECT t.order_id,t.refunded_at,o.telegram_id FROM telegram_payment_transactions t JOIN telegram_payment_orders o ON o.order_id=t.order_id WHERE t.charge_id=? FOR UPDATE',[$charge])->fetch(PDO::FETCH_ASSOC);
            if(!$row)throw new InvalidArgumentException('unknown_charge');
            if($row['refunded_at']!==null)throw new InvalidArgumentException('already_refunded');
            $this->bot->call('refundStarPayment',['user_id'=>(int)$row['telegram_id'],'telegram_payment_charge_id'=>$charge]);
            $this->q('UPDATE telegram_payment_transactions SET refunded_at=? WHERE charge_id=? AND refunded_at IS NULL',[$now,$charge]);
            $this->q("UPDATE telegram_payment_orders SET status='refunded' WHERE order_id=?",[$row['order_id']]);
            $this->db->commit();error_log('[telegram-stars] event=refund-requested');
            return ['telegram_id'=>(string)$row['telegram_id']];
        }catch(Throwable $e){if($this->db->inTransaction())$this->db->rollBack();throw $e;}
    }
    public function refunded(string $external,array $payment,int $now): void {
        $id=$this->orderId($payment);$charge=$payment['telegram_payment_charge_id']??'';
        $this->db->beginTransaction();
        try{
            $o=$this->q('SELECT * FROM telegram_payment_orders WHERE order_id=? FOR UPDATE',[$id])->fetch(PDO::FETCH_ASSOC);
            if(!$o||!self::matches($o,$external,$payment))throw new InvalidArgumentException('refund_mismatch');
            $q=$this->q('UPDATE telegram_payment_transactions SET refunded_at=COALESCE(refunded_at,?) WHERE charge_id=? AND order_id=?',[$now,$charge,$id]);
            if(!$this->q('SELECT charge_id FROM telegram_payment_transactions WHERE charge_id=? AND order_id=?',[$charge,$id])->fetchColumn())throw new InvalidArgumentException('unknown_refund');
            $this->q("UPDATE telegram_payment_orders SET status='refunded' WHERE order_id=?",[$id]);$this->db->commit();
            // Keep audit history. Reclaiming already-used game goods needs an explicit support decision.
            error_log('[telegram-stars] event=refunded');
        }catch(Throwable $e){$this->db->rollBack();throw $e;}
    }
}
