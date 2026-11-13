<?php
require_once __DIR__.'/../../server/core/models/telegramaccess.php';
require_once __DIR__.'/../../server/core/models/telegrambothandler.php';
function sdCheck($ok,$message){if(!$ok)throw new RuntimeException($message);}
class SupportDeskFriendsFake {function playerId($id){return $id==='123'?7:null;}function list($u,$s,$p){return ['total'=>0,'players'=>[],'has_next'=>false];}}
class SupportDeskBotFake {public $calls=[];function call($method,$body){$this->calls[]=[$method,$body];return ['message_id'=>99];}}
function sdMessage(int $id,string $text,array $extra=[]): array {return ['message'=>array_replace(['chat'=>['id'=>$id,'type'=>'private'],'from'=>['id'=>$id,'is_bot'=>false],'text'=>$text],$extra)];}
function sdCallback(int $id,string $data): array {return ['callback_query'=>['id'=>'cb'.$id,'from'=>['id'=>$id],'message'=>['chat'=>['id'=>$id,'type'=>'private']],'data'=>$data]];}
$root=sys_get_temp_dir().'/tg-support-desk-'.bin2hex(random_bytes(8));mkdir($root,0700);
$access=new TelegramAccess($root.'/test-access.json');$access->change(TelegramAccess::OWNER,'123',true);$bot=new SupportDeskBotFake;$handler=new TelegramBotHandler(new SupportDeskFriendsFake,$bot,'Welcome',null,$access,$root);
try{
    $handler->handle(sdMessage(123,'/start'));
    $menu=end($bot->calls)[1]['reply_markup']['inline_keyboard'];sdCheck(end($menu)[0]['text']==='Поддержка','Start menu must show support button');
    $handler->handle(sdCallback(123,'support:menu'));sdCheck(str_contains(end($bot->calls)[1]['text'],'Что случилось'),'Support menu must explain next action');
    $handler->handle(sdCallback(123,'support:payment'));
    $prompt=end($bot->calls)[1];sdCheck(($prompt['reply_markup']['force_reply']??false)===true,'Category must request a reply');
    $handler->handle(sdMessage(123,'Не появились звёзды, чек 123', ['reply_to_message'=>['message_id'=>99,'text'=>$prompt['text']]]));
    $promptDeleted=false;foreach($bot->calls as [$method,$body])if($method==='deleteMessage'&&($body['chat_id']??null)===123&&($body['message_id']??null)===99)$promptDeleted=true;
    sdCheck($promptDeleted,'Player force-reply prompt must be deleted after the report arrives');
    $files=glob($root.'/bot-updates/support-*.json');$tickets=[];foreach($files as $file){$row=json_decode(file_get_contents($file),true);if(isset($row['id']))$tickets[]=$row;}
    sdCheck(count($tickets)===1&&$tickets[0]['telegram_id']==='123'&&$tickets[0]['player_id']===7&&$tickets[0]['category']==='Платёж или Stars','Ticket must save identity and category privately');
    $ticket=$tickets[0]['id'];
    $handler->handle(sdMessage(1355806786,'/supportplayers add 456'));
    sdCheck(str_contains(end($bot->calls)[1]['text'],'Помощник добавлен'),'Owner must add support agent');
    $handler->handle(sdMessage(1355806786,'/supportplayers list'));
    sdCheck(str_contains(end($bot->calls)[1]['text'],'456'),'Owner must see support-agent list');
    $handler->handle(sdMessage(456,'/supportlist'));
    $listing=end($bot->calls)[1];sdCheck(str_contains($listing['text'],'Telegram ID 123')&&str_contains($listing['text'],'игровой ID 7'),'Support agent can view ticket identity');
    $deskButtons=$listing['reply_markup']['inline_keyboard'];sdCheck($deskButtons[0][0]['callback_data']==='support:ticket:'.$ticket,'Inbox lists ticket detail action');
    $handler->handle(sdMessage(456,'/supportread '.$ticket));sdCheck(str_contains(end($bot->calls)[1]['text'],'Откройте /supportlist')&&!str_contains(end($bot->calls)[1]['text'],'Не появились звёзды'),'Legacy read command must direct staff to the button inbox without showing ticket content');
    $handler->handle(sdMessage(456,'/supportreply '.$ticket.' Do not send'));sdCheck(str_contains(end($bot->calls)[1]['text'],'Откройте /supportlist'),'Legacy reply command must direct staff to the inline reply flow');
    $handler->handle(sdMessage(789,'/supportlist'));
    sdCheck(!str_contains(end($bot->calls)[1]['text'],'Не появились звёзды'),'Unassigned user must not view inbox contents');
    $beforeGroup=count($bot->calls);$group=sdMessage(456,'/supportlist');$group['message']['chat']=['id'=>-100123,'type'=>'supergroup'];
    $handler->handle($group);sdCheck(count($bot->calls)===$beforeGroup,'Support inbox commands must not post private tickets into groups');
    $handler->handle(sdCallback(456,'support:ticket:'.$ticket));sdCheck(str_contains(end($bot->calls)[1]['text'],'Не появились звёзды'),'Ticket detail must show issue');
    $handler->handle(sdCallback(456,'support:reply:'.$ticket));$replyPrompt=end($bot->calls)[1];
    $handler->handle(sdMessage(456,'Мы проверим квитанцию.', ['reply_to_message'=>['message_id'=>99,'text'=>$replyPrompt['text']]]));
    $staffPromptDeleted=false;foreach($bot->calls as [$method,$body])if($method==='deleteMessage'&&($body['chat_id']??null)===456&&($body['message_id']??null)===99)$staffPromptDeleted=true;
    sdCheck($staffPromptDeleted,'Staff force-reply prompt must be deleted after the answer is sent');
    $delivered=false;foreach($bot->calls as [$method,$body])if($method==='sendMessage'&&($body['chat_id']??null)===123&&str_contains((string)($body['text']??''),'Ответ поддержки'))$delivered=true;
    sdCheck($delivered,'Reply must go to the player private chat');
    $stored=json_decode(file_get_contents($root.'/bot-updates/support-'.$ticket.'.json'),true);
    sdCheck($stored['status']==='answered'&&count($stored['replies'])===1,'Support answer must be added to the ticket history');
    for($i=0;$i<5;$i++){$id=bin2hex(random_bytes(8));$row=['id'=>$id,'telegram_id'=>'123','player_id'=>7,'category'=>'Другое','text'=>'Тестовая заявка '.$i,'status'=>'new','created_at'=>time()+$i,'replies'=>[]];file_put_contents($root.'/bot-updates/support-'.$id.'.json',json_encode($row,JSON_UNESCAPED_UNICODE));}
    $handler->handle(sdMessage(456,'/supportlist 0'));$firstPage=end($bot->calls)[1];sdCheck(count($firstPage['reply_markup']['inline_keyboard'])===6,'First inbox page must contain five tickets and next-page navigation');
    $handler->handle(sdMessage(456,'/supportlist 1'));$secondPage=end($bot->calls)[1];sdCheck(count($secondPage['reply_markup']['inline_keyboard'])===2&&$secondPage['reply_markup']['inline_keyboard'][1][0]['callback_data']==='support:page:0','Second inbox page must contain remaining ticket and previous-page navigation');
    $handler->handle(sdMessage(1355806786,'/supportplayers remove 456'));
    $handler->handle(sdMessage(456,'/supportlist'));
    sdCheck(!str_contains(end($bot->calls)[1]['text'],'Не появились звёзды'),'Revoked helper must immediately lose inbox access');
    echo "Telegram support desk: private reports, separate helper allowlist, five-item inbox navigation, ticket detail, reply and revocation passed\n";
}finally{
    $iterator=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);
    foreach($iterator as $entry){$entry->isDir()?rmdir($entry->getPathname()):unlink($entry->getPathname());}rmdir($root);
}
