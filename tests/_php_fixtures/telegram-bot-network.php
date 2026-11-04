<?php
require __DIR__.'/../../server/core/models/telegrambotclient.php';
function networkCheck($value){if(!$value)throw new RuntimeException('Telegram network test failed');}
$calls=[];$transport=function($url,$body)use(&$calls){$calls[]=[$url,$body];return ['ok'=>true,'result'=>'https://t.me/$fixture'];};
foreach(['production'=>'','test'=>'test/'] as $mode=>$prefix){
 $bot=new TelegramBotClient('123:fixture',$mode,$transport);
 networkCheck($bot->call('createInvoiceLink',['currency'=>'XTR'])==='https://t.me/$fixture');
 networkCheck(end($calls)[0]==='https://api.telegram.org/bot123:fixture/'.$prefix.'createInvoiceLink');
 networkCheck(end($calls)[1]['currency']==='XTR');
 foreach(['../sendMessage','https://example.org','sendMessage?x=1'] as $method){$rejected=false;try{$bot->call($method,[]);}catch(InvalidArgumentException $e){$rejected=true;}networkCheck($rejected);}
}
$rejected=false;try{new TelegramBotClient('123:fixture','unknown');}catch(InvalidArgumentException $e){$rejected=true;}networkCheck($rejected);
$bad=new TelegramBotClient('123:fixture','test',fn()=>['ok'=>false]);$rejected=false;try{$bad->call('createInvoiceLink',[]);}catch(RuntimeException $e){$rejected=true;}networkCheck($rejected);
echo "Telegram Bot API: production preserved, separate test endpoint, invoice result, invalid network/method and provider error checked; no network calls\n";
