<?php
require __DIR__.'/../../server/core/models/telegramauth.php';
require __DIR__.'/../../server/core/models/telegramaccess.php';
function ensure($value){if(!$value)throw new RuntimeException('production_boundary_failed');}
$config=['enabled'=>true,'environment'=>'prod','database'=>'stalker_telegram','bot_token'=>'123:abcdefghijklmnopqrstuvwxyz'];
TelegramAuth::validateConfig($config);
ensure(TelegramEnvironment::database()==='stalker_telegram');
ensure(TelegramEnvironment::stateDirectory()==='/var/lib/pripyat-tg-prod');
ensure(TelegramEnvironment::origin()==='https://pripyat-game-site.ru/telegram');
ensure(TelegramEnvironment::mediaOrigin()==='https://tg-test-pripyat-game.ru');
ensure((new TelegramAccess)->allowed('123456789'));
ensure(TelegramAccess::canUseStars('123456789'));
foreach([['environment'=>'prod','database'=>'stalker_telegram_test'],['environment'=>'test','database'=>'stalker_telegram']] as $bad){
 try{TelegramAuth::validateConfig(array_replace($config,$bad));throw new LogicException('cross_world_accepted');}
 catch(RuntimeException $e){ensure($e->getMessage()==='telegram_disabled');}
}
TelegramAuth::validateConfig(array_replace($config,['environment'=>'test','database'=>'stalker_telegram_test']));
ensure(!TelegramAccess::canUseStars('123456789'));
ensure(!(new TelegramAccess(__DIR__.'/missing-allowlist.json'))->allowed('123456789'));
echo "Telegram PROD: отдельная база, пути, публичные Stars и отказ смешанным окружениям проверены\n";
