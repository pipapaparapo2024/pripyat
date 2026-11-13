<?php
require_once __DIR__.'/telegramenvironment.php';
final class TelegramBotHandler {
    private $friends,$bot,$welcome,$payments,$access,$supportRoot;
    public function __construct($friends,$bot,string $welcome,$payments=null,$access=null,?string $supportRoot=null){$this->friends=$friends;$this->bot=$bot;$this->welcome=$welcome;$this->payments=$payments;$this->access=$access;$this->supportRoot=$supportRoot??TelegramEnvironment::stateDirectory();}
    public static function authorized(string $expected,string $received): bool {
        return strlen($expected)>=32 && hash_equals($expected,$received);
    }
    private function buttons(string $reward=''): array {
        $url=TelegramEnvironment::origin().'/'.($reward!==''?'?reward='.rawurlencode($reward):'');
        return ['inline_keyboard'=>[[['text'=>'Играть','web_app'=>['url'=>$url]]],[['text'=>'Друзья','callback_data'=>'list:friends:0'],['text'=>'Не друзья','callback_data'=>'list:others:0']],[['text'=>'Поддержка','callback_data'=>'support:menu']]]];
    }
    private function message(int $chat,string $text,array $markup=[]): void {
        $this->bot->call('sendMessage',['chat_id'=>$chat,'text'=>$text,'reply_markup'=>$markup?:$this->buttons(),'link_preview_options'=>['is_disabled'=>true]]);
    }
    private function supportPath(string $ticket): string {
        if(!preg_match('/^[a-f0-9]{16}$/D',$ticket))throw new InvalidArgumentException('invalid_support_ticket');
        return $this->supportRoot.'/bot-updates/support-'.$ticket.'.json';
    }
    private function supportDirectory(): string {
        $dir=$this->supportRoot.'/bot-updates';
        if(!is_dir($dir)&&!mkdir($dir,0700,true)&&!is_dir($dir))throw new RuntimeException('support_storage_unavailable');
        if(!chmod($dir,0700))throw new RuntimeException('support_storage_unavailable');
        return $dir;
    }
    private function textSlice(string $text,int $length): string {
        if(function_exists('mb_substr'))return mb_substr($text,0,$length);
        if(preg_match_all('/./us',$text,$chars)===false)return substr($text,0,$length);
        return implode('',array_slice($chars[0],0,$length));
    }
    private function saveSupport(int $chat,string $telegramId,string $category,string $body,int $playerId=0): string {
        $dir=$this->supportDirectory();$ticket=bin2hex(random_bytes(8));$path=$dir.'/support-'.$ticket.'.json';
        $json=json_encode(['id'=>$ticket,'telegram_id'=>$telegramId,'player_id'=>$playerId>0?$playerId:null,'category'=>$category,'text'=>$body,'status'=>'new','created_at'=>time(),'replies'=>[]],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
        if(file_put_contents($path,$json,LOCK_EX)!==strlen($json)||!chmod($path,0600))throw new RuntimeException('support_write_failed');
        return $ticket;
    }
    private function supportMenu(int $chat): void {
        $this->message($chat,'Что случилось? Выберите подходящий пункт. Если не найдёте свой вариант — нажмите «Другое».',['inline_keyboard'=>[
            [['text'=>'Платёж или Stars','callback_data'=>'support:payment']],
            [['text'=>'Покупка не появилась','callback_data'=>'support:credit']],
            [['text'=>'Вход или игра','callback_data'=>'support:game']],
            [['text'=>'Другое','callback_data'=>'support:other']]
        ]]);
    }
    private function supportPrompt(int $chat,string $actor,string $category): void {
        $path=$this->supportDirectory().'/support-pending-'.$actor.'.json';
        $json=json_encode(['telegram_id'=>$actor,'player_id'=>$this->friends->playerId($actor)?:null,'category'=>$category,'created_at'=>time()],JSON_THROW_ON_ERROR);
        if(file_put_contents($path,$json,LOCK_EX)!==strlen($json)||!chmod($path,0600))throw new RuntimeException('support_write_failed');
        $this->bot->call('sendMessage',['chat_id'=>$chat,'text'=>'Опишите проблему одним сообщением. Если есть номер квитанции — добавьте его. Не отправляйте пароль, коды входа или данные карты.','reply_markup'=>['force_reply'=>true,'input_field_placeholder'=>'Напишите, что произошло…'],'link_preview_options'=>['is_disabled'=>true]]);
    }
    private function removeSupportPrompt(int $chat,array $reply): void {
        $messageId=$reply['message_id']??null;
        if(!is_int($messageId)||$messageId<1)return;
        try{$this->bot->call('deleteMessage',['chat_id'=>$chat,'message_id'=>$messageId]);}
        catch(Throwable $error){error_log('[telegram-bot] support_prompt_delete_failed');}
    }
    private function supportReply(int $chat,string $actor,array $message): bool {
        $reply=$message['reply_to_message']??null;$text=trim((string)($message['text']??''));
        $staffPath=$this->supportRoot.'/bot-updates/support-reply-pending-'.$actor.'.json';
        if(is_array($reply)&&($reply['text']??'')==='Напишите ответ игроку одним сообщением.'&&$text!==''&&$this->isSupportAgent($actor)&&is_file($staffPath)){
            $pending=json_decode((string)file_get_contents($staffPath),true);
            if(!is_array($pending)||($pending['telegram_id']??'')!==$actor||time()-(int)($pending['created_at']??0)>1800){@unlink($staffPath);return false;}
            $ticket=(string)($pending['ticket']??'');$path=$this->supportPath($ticket);
            $lock=fopen($path.'.lock','c+');if(!$lock||!flock($lock,LOCK_EX))throw new RuntimeException('support_lock_failed');chmod($path.'.lock',0600);
            try{$row=is_file($path)?json_decode((string)file_get_contents($path),true):null;if(!is_array($row)||!TelegramAccess::validId((string)($row['telegram_id']??'')))return false;
                $answer=$this->textSlice($text,3000);
                $this->bot->call('sendMessage',['chat_id'=>(int)$row['telegram_id'],'text'=>'Ответ поддержки по обращению '.$ticket.":\n".$answer,'link_preview_options'=>['is_disabled'=>true]]);
                $row['status']='answered';$row['replies']=is_array($row['replies']??null)?$row['replies']:[];$row['replies'][]=['text'=>$answer,'agent_id'=>$actor,'created_at'=>time()];
                $tmp=$path.'.'.bin2hex(random_bytes(8)).'.tmp';$json=json_encode($row,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
                if(file_put_contents($tmp,$json,LOCK_EX)!==strlen($json)||!chmod($tmp,0600)||!rename($tmp,$path))throw new RuntimeException('support_write_failed');
                @unlink($staffPath);$this->removeSupportPrompt($chat,$reply);$this->message($chat,'Ответ отправлен игроку по обращению '.$ticket.'.',['remove_keyboard'=>true]);return true;
            }finally{if(isset($tmp)&&is_file($tmp))unlink($tmp);flock($lock,LOCK_UN);fclose($lock);}
        }
        if(!is_array($reply)||($reply['text']??'')!=='Опишите проблему одним сообщением. Если есть номер квитанции — добавьте его. Не отправляйте пароль, коды входа или данные карты.'||$text==='')return false;
        $path=$this->supportRoot.'/bot-updates/support-pending-'.$actor.'.json';
        if(!is_file($path))return false;
        $pending=json_decode((string)file_get_contents($path),true);
        if(!is_array($pending)||($pending['telegram_id']??'')!==$actor||time()-(int)($pending['created_at']??0)>1800){@unlink($path);return false;}
        $ticket=$this->saveSupport($chat,$actor,(string)($pending['category']??'Другое'),$this->textSlice($text,1500),(int)($pending['player_id']??0));
        @unlink($path);
        $this->removeSupportPrompt($chat,$reply);
        $this->message($chat,'Готово, обращение отправлено в поддержку. Номер: '.$ticket.'. Ответ придёт сюда, в этот чат. Если понадобится, этот номер поможет нам быстрее найти ваше сообщение.');
        return true;
    }
    private function supportAgents(): array {
        $this->supportDirectory();$path=$this->supportRoot.'/support-agents.json';if(!is_file($path))return [];
        $data=json_decode((string)file_get_contents($path),true,16,JSON_THROW_ON_ERROR);if(!is_array($data))throw new RuntimeException('support_agents_invalid');
        return array_values(array_unique(array_filter($data,fn($id)=>is_string($id)&&TelegramAccess::validId($id)&&$id!==TelegramAccess::OWNER)));
    }
    private function isSupportAgent(string $id): bool {return $id===TelegramAccess::OWNER||in_array($id,$this->supportAgents(),true);}
    private function changeSupportAgents(string $action,string $id): array {
        if(!in_array($action,['add','remove'],true)||!TelegramAccess::validId($id)||$id===TelegramAccess::OWNER)throw new InvalidArgumentException('invalid_support_agent');
        $this->supportDirectory();$path=$this->supportRoot.'/support-agents.json';$lock=fopen($path.'.lock','c+');if(!$lock||!flock($lock,LOCK_EX))throw new RuntimeException('support_agents_lock_failed');chmod($path.'.lock',0600);
        try{$ids=$this->supportAgents();$ids=array_values(array_filter($ids,fn($value)=>$value!==$id));if($action==='add')$ids[]=$id;
            $tmp=$path.'.'.bin2hex(random_bytes(8)).'.tmp';$json=json_encode(array_values($ids),JSON_THROW_ON_ERROR);
            if(file_put_contents($tmp,$json,LOCK_EX)!==strlen($json)||!chmod($tmp,0600)||!rename($tmp,$path))throw new RuntimeException('support_agents_write_failed');
            return $ids;
        }finally{if(isset($tmp)&&is_file($tmp))unlink($tmp);flock($lock,LOCK_UN);fclose($lock);}
    }
    private function supportTickets(): array {
        $files=glob($this->supportRoot.'/bot-updates/support-*.json')?:[];$out=[];
        foreach($files as $path){$row=json_decode((string)file_get_contents($path),true);if(is_array($row)&&preg_match('/^[a-f0-9]{16}$/D',(string)($row['id']??'')))$out[]=$row;}
        usort($out,fn($a,$b)=>(int)($b['created_at']??0)<=>(int)($a['created_at']??0));return $out;
    }
    private function showSupportPage(int $chat,int $page): void {
        $rows=$this->supportTickets();$page=max(0,min($page,(int)max(0,ceil(count($rows)/5)-1)));$slice=array_slice($rows,$page*5,5);$keyboard=[];$lines=['Обращения поддержки · страница '.($page+1)];
        foreach($slice as $r){$id=(string)$r['id'];$category=(string)($r['category']??'Другое');$player=isset($r['player_id'])?'игровой ID '.$r['player_id']:'игра не связана';$stamp=date('d.m H:i',(int)($r['created_at']??0));$preview=$this->textSlice(str_replace(["\r","\n"],' ',(string)($r['text']??'')),90);
            $lines[]="\n{$stamp} · {$category}\n{$player} · Telegram ID ".(string)($r['telegram_id']??'?')."\n{$preview}";$keyboard[]=[['text'=>'Открыть '.substr($id,0,6),'callback_data'=>'support:ticket:'.$id]];
        }
        if(!$slice)$lines[]='Обращений пока нет.';$nav=[];if($page>0)$nav[]=['text'=>'← Назад','callback_data'=>'support:page:'.($page-1)];if(($page+1)*5<count($rows))$nav[]=['text'=>'Далее →','callback_data'=>'support:page:'.($page+1)];if($nav)$keyboard[]=$nav;
        $this->message($chat,implode("\n",$lines),['inline_keyboard'=>$keyboard?:[[['text'=>'Обновить','callback_data'=>'support:page:'.$page]]]]);
    }
    private function showSupportTicket(int $chat,string $id): void {
        $path=$this->supportPath($id);$row=is_file($path)?json_decode((string)file_get_contents($path),true):null;
        if(!is_array($row)){$this->message($chat,'Обращение не найдено.',['inline_keyboard'=>[[['text'=>'К списку','callback_data'=>'support:page:0']]]]);return;}
        $text='Обращение '.$id.' · '.(string)($row['status']??'new')."\nДата: ".date('d.m.Y H:i',(int)($row['created_at']??0))."\nКатегория: ".(string)($row['category']??'Другое')."\nИгровой ID: ".(isset($row['player_id'])?(string)$row['player_id']:'не привязан')."\nTelegram ID: ".(string)($row['telegram_id']??'?')."\n\n".$this->textSlice((string)($row['text']??''),1500);
        foreach(array_slice(is_array($row['replies']??null)?$row['replies']:[], -2) as $reply)$text.="\n\nОтвет поддержки: ".$this->textSlice((string)($reply['text']??''),850);
        $this->message($chat,$text,['inline_keyboard'=>[[['text'=>'Ответить','callback_data'=>'support:reply:'.$id]],[['text'=>'← К списку','callback_data'=>'support:page:0']]]]);
    }
    private function promptSupportAgentReply(int $chat,string $actor,string $ticket): void {
        $path=$this->supportPath($ticket);if(!is_file($path)){$this->message($chat,'Обращение не найдено.',['remove_keyboard'=>true]);return;}
        $pendingPath=$this->supportDirectory().'/support-reply-pending-'.$actor.'.json';$json=json_encode(['ticket'=>$ticket,'telegram_id'=>$actor,'created_at'=>time()],JSON_THROW_ON_ERROR);
        if(file_put_contents($pendingPath,$json,LOCK_EX)!==strlen($json)||!chmod($pendingPath,0600))throw new RuntimeException('support_write_failed');
        $this->bot->call('sendMessage',['chat_id'=>$chat,'text'=>'Напишите ответ игроку одним сообщением.','reply_markup'=>['force_reply'=>true,'input_field_placeholder'=>'Ответ игроку…']]);
    }
    private function ownerCommand(int $chat,string $actor,string $text): bool {
        if(!preg_match('/^\/(supportplayers|supportlist|paymentlist|refund)(?:@[A-Za-z0-9_]+)?(?:\s+(.*))?$/usD',$text,$m))return false;
        $command=$m[1];$arg=trim($m[2]??'');
        if($command==='supportplayers'){
            if($actor!==TelegramAccess::OWNER){$this->message($chat,'Управлять доступом к обращениям может только владелец.',['remove_keyboard'=>true]);return true;}
            if($arg===''||$arg==='list'){$ids=$this->supportAgents();$this->message($chat,$ids?"Помощники поддержки (Telegram ID):\n".implode("\n",$ids):'Помощники ещё не назначены. Добавить: /supportplayers add Telegram_ID',['remove_keyboard'=>true]);return true;}
            if(!preg_match('/^(add|remove)\s+([1-9][0-9]{0,15})$/D',$arg,$manage)){$this->message($chat,'Формат: /supportplayers add Telegram_ID или /supportplayers remove Telegram_ID',['remove_keyboard'=>true]);return true;}
            try{$ids=$this->changeSupportAgents($manage[1],$manage[2]);$this->message($chat,($manage[1]==='add'?'Помощник добавлен.':'Доступ помощника отозван.')."\nВсего помощников: ".count($ids),['remove_keyboard'=>true]);}
            catch(InvalidArgumentException $e){$this->message($chat,'Укажите корректный Telegram ID, отличный от ID владельца.',['remove_keyboard'=>true]);}return true;
        }
        $staffCommand=$command==='supportlist';
        if($staffCommand&&!$this->isSupportAgent($actor)){$this->message($chat,'Просматривать обращения могут только назначенные помощники поддержки.',['remove_keyboard'=>true]);return true;}
        if(!$staffCommand&&$actor!==TelegramAccess::OWNER){$this->message($chat,'Команда доступна только владельцу бота.',['remove_keyboard'=>true]);return true;}
        if($command==='supportlist'){
            $page=preg_match('/^[0-9]{1,5}$/D',$arg)?(int)$arg:0;$this->showSupportPage($chat,$page);return true;
        }
        if(!$this->payments){$this->message($chat,'Stars-платежи выключены в этом окружении.',['remove_keyboard'=>true]);return true;}
        if($command==='paymentlist'){
            $rows=$this->payments->recentPayments(10);if(!$rows){$this->message($chat,'Платежей пока нет.',['remove_keyboard'=>true]);return true;}
            $lines=['Последние квитанции (для возврата скопируйте charge ID):'];foreach($rows as $r)$lines[]='TG '.(string)$r['telegram_id'].' · '.$r['stars'].' ⭐ · '.($r['refunded_at']!==null?'ВОЗВРАЩЁН':'оплачен')."\n".(string)$r['charge_id'];
            $this->message($chat,implode("\n\n",$lines),['remove_keyboard'=>true]);return true;
        }
        if(!preg_match('/^CONFIRM\s+([\x21-\x7e]{1,255})$/D',$arg,$confirmed)){$this->message($chat,'Чтобы запросить возврат, скопируйте квитанцию из /paymentlist и отправьте /refund CONFIRM Telegram_charge_ID. Команда отправит Stars назад исходному плательщику; игровой баланс сама не меняет.',['remove_keyboard'=>true]);return true;}
        try{$result=$this->payments->refund($confirmed[1],time());$this->message($chat,'Telegram подтвердил запрос возврата для пользователя '.$result['telegram_id'].'. Зачисленные игровые ресурсы автоматически не изымаются; проверьте историю и решите вопрос об игровой корректировке отдельно.',['remove_keyboard'=>true]);}
        catch(InvalidArgumentException $e){$this->message($chat,match($e->getMessage()){'already_refunded'=>'Этот платёж уже отмечен как возвращённый.','unknown_charge'=>'Квитанция не найдена в журнале платежей.',default=>'Не удалось проверить квитанцию.'},['remove_keyboard'=>true]);}
        return true;
    }
    private function listing(int $chat,int $uid,string $scope,int $page): void {
        $result=$this->friends->list($uid,$scope,$page);
        $text=($scope==='friends'?'Друзья':'Не друзья').' · '.$result['total']."\n";
        $rows=[];
        foreach($result['players'] as $p){
            $text.=$p['nick'].' · уровень '.$p['level']."\n";
            if($scope==='friends')$rows[]=[['text'=>'Удалить: '.$p['nick'],'callback_data'=>'confirm:'.$p['id']]];
        }
        if(!$result['players'])$text.=$scope==='friends'?'Пока никого. Заявки по игровому ID отправляются в разделе «Друзья» внутри игры.':'Других игроков пока нет.';
        if($scope==='others'){$world=TelegramEnvironment::name()==='prod'?'Telegram':'Telegram TEST';$text.="\nЭто другие игроки ".$world.". Заявки отправляются в разделе «Друзья» внутри игры.";}
        $nav=[];
        if($page>0)$nav[]=['text'=>'←','callback_data'=>'list:'.$scope.':'.($page-1)];
        if($result['has_next'])$nav[]=['text'=>'→','callback_data'=>'list:'.$scope.':'.($page+1)];
        if($nav)$rows[]=$nav;
        $rows[]=[['text'=>'Друзья','callback_data'=>'list:friends:0'],['text'=>'Не друзья','callback_data'=>'list:others:0']];
        $this->message($chat,$text,['inline_keyboard'=>$rows]);
    }
    public function handle(array $update): void {
        if(isset($update['pre_checkout_query'])){
            $q=$update['pre_checkout_query'];$external=$q['from']['id']??null;
            if(!is_int($external)||$external<1)return;
            $ok=false;
            if($this->payments&&TelegramAccess::canUseStars((string)$external)&&(!$this->access||$this->access->allowed((string)$external))){try{$ok=$this->payments->precheckout((string)$external,$q,time());}catch(Throwable $e){$ok=false;}}
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
            $supportAction=$callback&&preg_match('/^support:(?:menu|payment|credit|game|other)$/D',(string)($callback['data']??''));
            $supportDeskAction=$callback&&preg_match('/^support:(?:page:[0-9]{1,5}|ticket:[a-f0-9]{16}|reply:[a-f0-9]{16})$/D',(string)($callback['data']??''))&&$this->isSupportAgent($actor);
            $pendingPath=$this->supportRoot.'/bot-updates/support-pending-'.$actor.'.json';
            $staffPendingPath=$this->supportRoot.'/bot-updates/support-reply-pending-'.$actor.'.json';
            $supportReply=(is_file($pendingPath)||is_file($staffPendingPath))&&isset($message['reply_to_message']);
            $supportCommand=preg_match('/^\/(supportlist|supportread|supportreply)(?:\s|$)/D',$commandText)&&$this->isSupportAgent($actor);
            if(!$supportAction&&!$supportDeskAction&&!$supportReply&&!$supportCommand&&!preg_match('/^\/(paysupport|terms)(?:\s|$)/u',$commandText)){
                if($callback){try{$this->bot->call('answerCallbackQuery',['callback_query_id'=>(string)$callback['id'],'text'=>'Доступ к тесту закрыт.']);}catch(Throwable $e){}}
                $this->message($chat,'Закрытое тестирование. Запросите доступ у разработчика. Ваш Telegram ID: '.$actor,['remove_keyboard'=>true]);return;
            }
        }
        if(!$callback&&preg_match('/^\/(supportread|supportreply)(?:@[A-Za-z0-9_]+)?(?:\s|$)/D',$commandText)){$this->message($chat,'Откройте /supportlist, выберите обращение и нажмите «Ответить».',['remove_keyboard'=>true]);return;}
        if(!$callback&&$this->ownerCommand($chat,$actor,$commandText))return;
        if(!$callback&&preg_match('/^\/terms(?:@[A-Za-z0-9_]+)?$/D',$commandText)){$this->message($chat,'Условия цифровых покупок в Telegram: https://pripyat-game-site.ru/telegram-terms/',['remove_keyboard'=>true]);return;}
        if($callback){try{$this->bot->call('answerCallbackQuery',['callback_query_id'=>(string)$callback['id']]);}catch(RuntimeException $e){/* Old callback acknowledgement may expire; actions remain idempotent. */}}
        if($callback&&($callback['data']??'')==='support:menu'){$this->supportMenu($chat);return;}
        if($callback&&preg_match('/^support:(payment|credit|game|other)$/D',(string)($callback['data']??''),$supportChoice)){
            $labels=['payment'=>'Платёж или Stars','credit'=>'Покупка не появилась','game'=>'Вход или игра','other'=>'Другое'];
            $this->supportPrompt($chat,$actor,$labels[$supportChoice[1]]);return;
        }
        if($callback&&preg_match('/^support:page:([0-9]{1,5})$/D',(string)($callback['data']??''),$page)){
            if(!$this->isSupportAgent($actor)){$this->message($chat,'Просматривать обращения могут только назначенные помощники поддержки.',['remove_keyboard'=>true]);return;}
            $this->showSupportPage($chat,(int)$page[1]);return;
        }
        if($callback&&preg_match('/^support:ticket:([a-f0-9]{16})$/D',(string)($callback['data']??''),$ticket)){
            if(!$this->isSupportAgent($actor)){$this->message($chat,'Просматривать обращения могут только назначенные помощники поддержки.',['remove_keyboard'=>true]);return;}
            $this->showSupportTicket($chat,$ticket[1]);return;
        }
        if($callback&&preg_match('/^support:reply:([a-f0-9]{16})$/D',(string)($callback['data']??''),$ticket)){
            if(!$this->isSupportAgent($actor)){$this->message($chat,'Отвечать могут только назначенные помощники поддержки.',['remove_keyboard'=>true]);return;}
            $this->promptSupportAgentReply($chat,$actor,$ticket[1]);return;
        }
        if(!$callback&&isset($message['reply_to_message'])&&$this->supportReply($chat,$actor,$message))return;
        $uid=$this->friends->playerId((string)$sender['id']);
        $text=trim((string)($message['text']??''));$data=$callback?(string)($callback['data']??''):'';
        if(!$callback&&preg_match('/^\/(?:support|paysupport)(?:@[A-Za-z0-9_]+)?(?:\s+(.{1,1500}))?$/usD',$text,$support)){
            if(empty($support[1])){$this->supportMenu($chat);return;}
            $ticket=$this->saveSupport($chat,(string)$sender['id'],'Платёж или Stars',$support[1],(int)($this->friends->playerId((string)$sender['id'])?:0));
            $this->message($chat,'Обращение отправлено в поддержку. Номер: '.$ticket.'. Ответ придёт сюда, в этот чат.');return;
        }
        if(!$callback && preg_match('/^\/(start|play)(?:@[A-Za-z0-9_]+)?(?:\s+(f_[a-f0-9]{48}|g_r1_(?:test|prod)_telegram_[a-f0-9]{32}))?$/D',$text,$m)){
            $startParam=$m[2]??'';
            $reward=str_starts_with($startParam,'g_')?substr($startParam,2):'';
            try{$this->bot->call('sendPhoto',['chat_id'=>$chat,'photo'=>TelegramEnvironment::mediaOrigin().'/images/telegram-welcome.jpg','caption'=>$this->welcome,'reply_markup'=>$this->buttons($reward)]);}
            catch(RuntimeException $e){
                if(!preg_match('/^bot_api_rejected_sendphoto_http_400_api_400$/D',$e->getMessage()))throw $e;
                error_log('[telegram-bot] sendPhoto_fallback reason=api_rejected_400');
                $this->message($chat,$this->welcome,$this->buttons($reward));
            }
            return;
        }
        if(!$uid){$this->message($chat,'Сначала войдите в игру через кнопку «Играть». После создания персонажа здесь появится список друзей.');return;}
        if($data==='invite'||$text==='/invite'){$this->message($chat,'Добавляйте друзей по игровому ID в разделе «Друзья» внутри игры.');return;}
        if(preg_match('/^list:(friends|others):([0-9]{1,6})$/D',$data,$m)){$this->listing($chat,$uid,$m[1],(int)$m[2]);return;}
        if(preg_match('/^confirm:([1-9][0-9]{0,9})$/D',$data,$m)){
            $this->message($chat,'Удалить эту дружбу у обоих игроков? Награды и таймеры качалки сохранятся.',['inline_keyboard'=>[[['text'=>'Удалить','callback_data'=>'remove:'.$m[1]],['text'=>'Отмена','callback_data'=>'list:friends:0']]]]);return;
        }
        if(preg_match('/^remove:([1-9][0-9]{0,9})$/D',$data,$m)){$this->friends->remove($uid,(int)$m[1]);$this->listing($chat,$uid,'friends',0);return;}
        if($text==='/others'){$this->listing($chat,$uid,'others',0);return;}
        if($text==='/friends'){$this->listing($chat,$uid,'friends',0);return;}
        if(!$callback)$this->message($chat,'Команды: /play — играть, /friends — друзья, /others — другие игроки.');
    }
}
