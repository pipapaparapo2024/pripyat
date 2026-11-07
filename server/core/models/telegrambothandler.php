<?php
final class TelegramBotHandler {
    private $friends,$bot,$welcome,$payments,$access;
    public function __construct($friends,$bot,string $welcome,$payments=null,$access=null){$this->friends=$friends;$this->bot=$bot;$this->welcome=$welcome;$this->payments=$payments;$this->access=$access;}
    public static function authorized(string $expected,string $received): bool {
        return strlen($expected)>=32 && hash_equals($expected,$received);
    }
    private function buttons(string $invite=''): array {
        $parameter=str_starts_with($invite,'g_')?'?reward='.rawurlencode(substr($invite,2)):'?friend='.rawurlencode($invite);
        $url='https://tg-test-pripyat-game.ru/'.($invite!==''?$parameter:'');
        return ['inline_keyboard'=>[[['text'=>'Играть','web_app'=>['url'=>$url]]],[['text'=>'Друзья','callback_data'=>'list:friends:0'],['text'=>'Не друзья','callback_data'=>'list:others:0']],[['text'=>'Пригласить друга','callback_data'=>'invite']]]];
    }
    private function message(int $chat,string $text,array $markup=[]): void {
        $this->bot->call('sendMessage',['chat_id'=>$chat,'text'=>$text,'reply_markup'=>$markup?:$this->buttons(),'link_preview_options'=>['is_disabled'=>true]]);
    }
    private function listing(int $chat,int $uid,string $scope,int $page): void {
        $result=$this->friends->list($uid,$scope,$page);
        $text=($scope==='friends'?'Друзья':'Не друзья').' · '.$result['total']."\n";
        $rows=[];
        foreach($result['players'] as $p){
            $text.=$p['nick'].' · уровень '.$p['level']."\n";
            if($scope==='friends')$rows[]=[['text'=>'Удалить: '.$p['nick'],'callback_data'=>'confirm:'.$p['id']]];
        }
        if(!$result['players'])$text.=$scope==='friends'?'Пока никого. Пригласите друга по своей ссылке.':'Других игроков пока нет.';
        if($scope==='others')$text.="\nЭто другие игроки Telegram TEST. Для взаимного добавления отправьте свою ссылку приглашения.";
        $nav=[];
        if($page>0)$nav[]=['text'=>'←','callback_data'=>'list:'.$scope.':'.($page-1)];
        if($result['has_next'])$nav[]=['text'=>'→','callback_data'=>'list:'.$scope.':'.($page+1)];
        if($nav)$rows[]=$nav;
        $rows[]=[['text'=>'Друзья','callback_data'=>'list:friends:0'],['text'=>'Не друзья','callback_data'=>'list:others:0']];
        $rows[]=[['text'=>'Пригласить','callback_data'=>'invite']];
        $this->message($chat,$text,['inline_keyboard'=>$rows]);
    }
    public function handle(array $update): void {
        if(isset($update['pre_checkout_query'])){
            $q=$update['pre_checkout_query'];$external=$q['from']['id']??null;
            if(!is_int($external)||$external<1)return;
            $ok=false;
            if($this->payments&&(!$this->access||$this->access->allowed((string)$external))){try{$ok=$this->payments->precheckout((string)$external,$q,time());}catch(Throwable $e){$ok=false;}}
            $body=['pre_checkout_query_id'=>(string)$q['id'],'ok'=>$ok];
            if(!$ok)$body['error_message']='Заказ недоступен. Откройте игру и создайте новую покупку.';
            $this->bot->call('answerPreCheckoutQuery',$body);return;
        }
        $callback=$update['callback_query']??null;$message=$callback['message']??($update['message']??null);
        if(!is_array($message)||($message['chat']['type']??'')!=='private')return;
        $sender=$callback['from']??($message['from']??null);
        if(!is_array($sender)||($sender['is_bot']??false)||!is_int($sender['id']??null)||$sender['id']<1)return;
        $chat=$message['chat']['id']??0;
        if(!is_int($chat)||$chat!==$sender['id'])return;
        if(isset($message['successful_payment'])){
            if(!$this->payments)throw new RuntimeException('payments_disabled');
            $this->payments->credit((string)$sender['id'],$message['successful_payment'],time());return;
        }
        if(isset($message['refunded_payment'])){
            if(!$this->payments)throw new RuntimeException('payments_disabled');
            $this->payments->refunded((string)$sender['id'],$message['refunded_payment'],time());return;
        }
        // Always finish legitimate paid receipts/refunds above, even after access revocation.
        $commandText=trim((string)($message['text']??''));$actor=(string)$sender['id'];
        if(!$callback&&$this->access&&preg_match('/^\/(allow|deny|access_list)(?:@[A-Za-z0-9_]+)?(?:\s+(.*))?$/D',$commandText,$m)){
            if($actor!==TelegramAccess::OWNER){$this->message($chat,'Команда доступна только владельцу теста.',['remove_keyboard'=>true]);return;}
            if($m[1]==='access_list'){$this->message($chat,"Доступ к Telegram TEST (ID):\n".implode("\n",$this->access->listing($actor)),['remove_keyboard'=>true]);return;}
            try{$id=trim($m[2]??'');$this->access->change($actor,$id,$m[1]==='allow');$this->message($chat,($m[1]==='allow'?'Доступ разрешён: ':'Доступ отозван: ').$id,['remove_keyboard'=>true]);}
            catch(InvalidArgumentException $e){$this->message($chat,'Укажите числовой Telegram ID: /'.$m[1].' 123456789. Доступ владельца постоянный.',['remove_keyboard'=>true]);}return;
        }
        if($this->access&&!$this->access->allowed($actor)){
            // Payment support remains available for previous purchasers.
            if(!preg_match('/^\/paysupport(?:\s|$)/u',$commandText)){
                if($callback){try{$this->bot->call('answerCallbackQuery',['callback_query_id'=>(string)$callback['id'],'text'=>'Доступ к тесту закрыт.']);}catch(Throwable $e){}}
                $this->message($chat,'Закрытое тестирование. Запросите доступ у разработчика. Ваш Telegram ID: '.$actor,['remove_keyboard'=>true]);return;
            }
        }
        if($callback){try{$this->bot->call('answerCallbackQuery',['callback_query_id'=>(string)$callback['id']]);}catch(RuntimeException $e){/* Old callback acknowledgement may expire; actions remain idempotent. */}}
        $uid=$this->friends->playerId((string)$sender['id']);
        $text=trim((string)($message['text']??''));$data=$callback?(string)($callback['data']??''):'';
        if(!$callback&&preg_match('/^\/paysupport(?:\s+(.{1,1500}))?$/us',$text,$support)){
            if(empty($support[1])){$this->message($chat,'Опишите проблему командой /paysupport ваш вопрос. Если есть квитанция, укажите её номер. Не присылайте пароли и платёжные данные.');return;}
            $ticket=bin2hex(random_bytes(8));$path='/var/lib/pripyat-tg-test/bot-updates/support-'.$ticket.'.json';
            file_put_contents($path,json_encode(['id'=>$ticket,'telegram_id'=>(string)$sender['id'],'text'=>$support[1],'created_at'=>time()],JSON_UNESCAPED_UNICODE),LOCK_EX);chmod($path,0600);
            $this->message($chat,'Обращение '.$ticket.' сохранено для разработчика. Сохраните номер обращения.');return;
        }
        if(!$callback && preg_match('/^\/(start|play)(?:@[A-Za-z0-9_]+)?(?:\s+(f_[a-f0-9]{48}|g_r1_test_telegram_[a-f0-9]{32}))?$/D',$text,$m)){
            $invite=$m[2]??'';
            if(str_starts_with($invite,'f_'))$invite='';
            $this->bot->call('sendPhoto',['chat_id'=>$chat,'photo'=>'https://tg-test-pripyat-game.ru/images/telegram-welcome.jpg','caption'=>$this->welcome,'reply_markup'=>$this->buttons($invite)]);return;
        }
        if(!$uid){$this->message($chat,'Сначала войдите в игру через кнопку «Играть». После создания персонажа здесь появится список друзей.');return;}
        if($data==='invite'||$text==='/invite'){$this->message($chat,'Ваш игровой ID: '.$uid.'. Откройте «Друзья» в игре и отправьте заявку по ID друга. Получатель должен принять заявку.');return;}
        if(preg_match('/^list:(friends|others):([0-9]{1,6})$/D',$data,$m)){$this->listing($chat,$uid,$m[1],(int)$m[2]);return;}
        if(preg_match('/^confirm:([1-9][0-9]{0,9})$/D',$data,$m)){
            $this->message($chat,'Удалить эту дружбу у обоих игроков? Награды и таймеры качалки сохранятся.',['inline_keyboard'=>[[['text'=>'Удалить','callback_data'=>'remove:'.$m[1]],['text'=>'Отмена','callback_data'=>'list:friends:0']]]]);return;
        }
        if(preg_match('/^remove:([1-9][0-9]{0,9})$/D',$data,$m)){$this->friends->remove($uid,(int)$m[1]);$this->listing($chat,$uid,'friends',0);return;}
        if($text==='/others'){$this->listing($chat,$uid,'others',0);return;}
        if($text==='/friends'){$this->listing($chat,$uid,'friends',0);return;}
        if(!$callback)$this->message($chat,'Команды: /play — играть, /friends — друзья, /others — другие игроки, /invite — ссылка приглашения.');
    }
}
