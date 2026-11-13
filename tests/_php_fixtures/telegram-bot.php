<?php
require_once __DIR__.'/../../server/core/models/telegrambothandler.php';
require_once __DIR__.'/../../server/core/models/telegramaccess.php';
function assertBot($v){if(!$v)throw new RuntimeException('Проверка Telegram-бота не пройдена');}
class BotFriendsFake{
    public $removed=[],$accepted=[];
    function playerId($id){return $id==='123'?7:null;}
    function list($uid,$scope,$page){assertBot($uid===7);return ['total'=>1,'players'=>[['id'=>8,'nick'=>'Друг','level'=>3]],'has_next'=>false];}
    function invite($uid,$now){assertBot($uid===7);return 'https://t.me/pripyat_game_test_bot?start=f_'.str_repeat('a',48);}
    function remove($uid,$other){$this->removed[]=[$uid,$other];return true;}
    function accept($uid,$code,$now){$this->accepted[]=[$uid,$code];return 'added';}
}
class BotClientFake {public $calls=[];function call($m,$p){$this->calls[]=[$m,$p];return [];}}
$f=new BotFriendsFake;$b=new BotClientFake;$handler=new TelegramBotHandler($f,$b,'Полное приветствие');
assertBot(!TelegramBotHandler::authorized('', ''));
assertBot(!TelegramBotHandler::authorized(str_repeat('a',64),str_repeat('b',64)));
assertBot(TelegramBotHandler::authorized(str_repeat('a',64),str_repeat('a',64)));
function msg($text){return ['message'=>['chat'=>['id'=>123,'type'=>'private'],'from'=>['id'=>123,'is_bot'=>false],'text'=>$text]];}
$handler->handle(msg('/start f_'.str_repeat('a',48)));
assertBot($b->calls[0][0]==='sendPhoto' && $b->calls[0][1]['caption']==='Полное приветствие');
assertBot(!str_contains($b->calls[0][1]['reply_markup']['inline_keyboard'][0][0]['web_app']['url'],'friend=f_'));
assertBot(count($f->accepted)===0);
$handler->handle(msg('/friends'));assertBot(str_contains(end($b->calls)[1]['text'],'Друг'));
$handler->handle(msg('/others'));assertBot(str_contains(end($b->calls)[1]['text'],'Не друзья'));
$handler->handle(msg('/invite'));assertBot(str_contains(end($b->calls)[1]['text'],'внутри игры'));
$reward='r1_test_telegram_'.str_repeat('a',32);
$handler->handle(msg('/start g_'.$reward));
assertBot(end($b->calls)[1]['reply_markup']['inline_keyboard'][0][0]['web_app']['url']==='https://tg-test-pripyat-game.ru/?reward='.$reward);
foreach($b->calls as [$method,$params]){
    $markup=json_encode($params['reply_markup']??[]);
    assertBot(!str_contains($markup,'"callback_data":"invite"'));
}
$handler->handle(['callback_query'=>['id'=>'cb','from'=>['id'=>123],'message'=>['chat'=>['id'=>123,'type'=>'private']],'data'=>'remove:8']]);
assertBot($f->removed===[[7,8]]);
foreach($b->calls as [$m,$p])if(isset($p['chat_id']))assertBot($p['chat_id']===123);
$count=count($b->calls);$bad=msg('/friends');$bad['message']['chat']['id']=999;$handler->handle($bad);assertBot(count($b->calls)===$count);
$bad=msg('/friends');$bad['message']['chat']['type']='group';$handler->handle($bad);assertBot(count($b->calls)===$count);
$new=msg('/friends');$new['message']['from']['id']=124;$new['message']['chat']['id']=124;$handler->handle($new);assertBot(str_contains(end($b->calls)[1]['text'],'Сначала войдите'));
// TG wrapper must drop stale friendship fields from ANY legacy full-row save.
class Database {public $data;function saveData($table,$data){$this->data=$data;return true;}}
require_once __DIR__.'/../../server/core/models/telegramdatabase.php';
$store=new TelegramDatabase;$store->saveData('users',['id'=>7,'friends'=>'7,8','friends_since'=>'{}','friends_scope_granted'=>1,'coins'=>10]);
assertBot($store->data===['id'=>7,'coins'=>10]);
echo "Telegram bot: /start, фото/текст, списки, приглашение, личное удаление, private-chat и webhook-secret, защита от устаревшего кеша проверены\n";
class FakeStars {
    public $calls=[];
    function precheckout($id,$q,$now){$this->calls[]='checkout';return $q['currency']==='XTR';}
    function credit($id,$p,$now){$this->calls[]='credit';}
    function refunded($id,$p,$now){$this->calls[]='refund';}
}
$pay=new FakeStars;$client=new BotClientFake;$handler=new TelegramBotHandler($f,$client,'Welcome',$pay);
$handler->handle(['pre_checkout_query'=>['id'=>'checkout-non-owner','from'=>['id'=>123],'currency'=>'XTR']]);
assertBot($pay->calls===[]&&end($client->calls)[0]==='answerPreCheckoutQuery'&&end($client->calls)[1]['ok']===false,'Non-owner checkout must be declined');
$handler->handle(['pre_checkout_query'=>['id'=>'checkout-owner','from'=>['id'=>(int)TelegramAccess::OWNER],'currency'=>'XTR']]);
assertBot($pay->calls===['checkout']&&end($client->calls)[0]==='answerPreCheckoutQuery'&&end($client->calls)[1]['ok']===true,'Owner checkout must be accepted');
$update=msg('');$update['message']['successful_payment']=['currency'=>'XTR'];$handler->handle($update);
assertBot($pay->calls===['checkout','credit'],'Previously valid payment receipt remains processed');
$update=msg('');$update['message']['refunded_payment']=['currency'=>'XTR'];$handler->handle($update);
assertBot($pay->calls===['checkout','credit','refund']);
$handler->handle(msg('/paysupport'));assertBot(str_contains(end($client->calls)[1]['text'],'Что случилось'));
$handler->handle(msg('/support'));assertBot(str_contains(end($client->calls)[1]['text'],'Что случилось'));
echo "Stars webhook: pre-checkout не начисляет, successful_payment и refund разделены, /paysupport доступен\n";
