<?php
require __DIR__.'/../../server/core/models/telegramaccess.php';
require __DIR__.'/../../server/core/models/telegramavatars.php';
require __DIR__.'/../../server/core/models/telegrambothandler.php';
function aaCheck($ok,$label){if(!$ok)throw new RuntimeException($label);}
$dir=sys_get_temp_dir().'/tg-access-'.bin2hex(random_bytes(8));mkdir($dir);
$access=new TelegramAccess($dir.'/access.json');$owner=TelegramAccess::OWNER;
try{
    aaCheck($access->allowed($owner)&&!$access->allowed('123'),'Default must be owner-only');
    foreach(['0','-1','001','@ne_mafiya','4503599627370496','1.5','1e3'] as $id)aaCheck(!TelegramAccess::validId($id),'Invalid ID accepted');
    foreach([['123','456',true],[$owner,$owner,false],[$owner,'invalid',true]] as [$actor,$target,$allow]){
        $failed=false;try{$access->change($actor,$target,$allow);}catch(InvalidArgumentException $e){$failed=true;}aaCheck($failed,'Unauthorized mutation');
    }
    $access->change($owner,'123',true);$access->change($owner,'123',true);aaCheck(count($access->listing($owner))===2,'Repeated allow duplicated');
    $access->change($owner,'456',true);$access->change($owner,'123',false);aaCheck(!$access->allowed('123')&&$access->allowed('456'),'Revocation/cache failed');
    $bot=new class {public $calls=[];function call($m,$p){$this->calls[]=[$m,$p];return [];}};
    $friends=new class {function playerId($id){return 1;}};
    $payments=new class {public $credited=0,$checked=0;function credit(...$args){$this->credited++;}function precheckout(...$args){$this->checked++;return true;}};
    $handler=new TelegramBotHandler($friends,$bot,'Welcome',$payments,$access);
    $msg=fn($id,$text)=>['message'=>['chat'=>['id'=>(int)$id,'type'=>'private'],'from'=>['id'=>(int)$id],'text'=>$text]];
    $handler->handle($msg('123','/allow 789'));aaCheck(!$access->allowed('789'),'Non-owner command allowed');
    $handler->handle($msg($owner,'/allow 789'));aaCheck($access->allowed('789'),'Owner allow failed');
    $handler->handle($msg($owner,'/access_list'));aaCheck(str_contains(end($bot->calls)[1]['text'],'789'),'List failed');
    $handler->handle($msg($owner,'/deny 789'));aaCheck(!$access->allowed('789'),'Owner deny failed');
    $handler->handle($msg('123','/start'));aaCheck(str_contains(end($bot->calls)[1]['text'],'Telegram ID: 123'),'Blocked start does not explain ID');
    aaCheck(!isset(end($bot->calls)[1]['reply_markup']['inline_keyboard']),'Blocked player received play button');
    $handler->handle(['pre_checkout_query'=>['id'=>'q','from'=>['id'=>123]]]);aaCheck($payments->checked===0&&end($bot->calls)[1]['ok']===false,'Revoked checkout accepted');
    $receipt=$msg('123','');$receipt['message']['successful_payment']=[];$handler->handle($receipt);aaCheck($payments->credited===1,'Previously paid receipt dropped after revoke');
    $group=$msg($owner,'/allow 987');$group['message']['chat']['type']='group';$handler->handle($group);aaCheck(!$access->allowed('987'),'Group owner command executed');
    $calls=0;$downloaded=0;$fake=new class {public $calls=0,$none=false,$bad=false;function call($m,$p){$this->calls++;if($m==='getUserProfilePhotos')return ['photos'=>$this->none?[]:[[['file_id'=>'safe','width'=>160]]]];return ['file_path'=>$this->bad?'../../private.php':'photos/file_1.jpg'];}};
    $jpeg=file_get_contents(__DIR__.'/../../assets/images/telegram-icon.jpg');
    $avatars=new TelegramAvatars($fake,'private-test-token',$dir,function($path)use($jpeg,&$downloaded){$downloaded++;return $jpeg;});
    $url=$avatars->get('123',time());aaCheck(is_string($url)&&str_contains($url,'/telegram-avatars/')&&!str_contains($url,'private-test-token'),'Unsafe avatar URL');
    aaCheck($avatars->get('123',time())===$url&&$fake->calls===2&&$downloaded===1,'Avatar cache missed');
    $fake->none=true;aaCheck($avatars->get('456',time())===null,'Missing photo must fall back');$before=$fake->calls;$avatars->get('456',time());aaCheck($fake->calls===$before,'Negative cache missed');
    $fake->none=false;$fake->bad=true;aaCheck($avatars->get('789',time())===null&&$downloaded===1,'Unsafe file path downloaded');
    $key=hash_hmac('sha256','123','private-test-token');touch($dir.'/'.$key.'.stamp',time()-7200);$fake->bad=false;$fake->none=true;
    aaCheck($avatars->get('123',time())===null&&!is_file($dir.'/'.$key.'.jpg'),'Removed profile photo remained cached');
    echo "Telegram access/avatars: owner-only commands, permanent owner, revocation, blocked checkout/retained receipt, cached photos, privacy fallback and unsafe path rejection passed\n";
}finally{foreach(glob($dir.'/*') as $file)unlink($file);rmdir($dir);}
