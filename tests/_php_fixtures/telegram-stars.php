<?php
require_once __DIR__.'/../../server/core/models/telegramstars.php';
require_once __DIR__.'/../../server/core/models/gameops.php';
function starsCheck($v){if(!$v)throw new RuntimeException('Проверка Stars не пройдена');}
$catalog=json_decode(file_get_contents(__DIR__.'/../../server/json/telegram_stars.json'),true);
$expected=[
    'stew'=>[[4,12,24,80,200,400,2000,4000],[4,11,21,70,175,350,1750,3500],0],
    'coins'=>[[16,36,56,100,600,2000,10000,20000],[4,7,11,18,105,350,1750,3500],8],
    'cigarettes'=>[[1600,3600,6000,8000,11000,22000,125000,300000],[4,7,11,14,18,35,175,350],16],
    'energy'=>[[50,110,180,400,850,1300,2000,3500],[11,25,35,70,140,210,298,420],100],
];
foreach($expected as $field=>[$amounts,$prices,$base])foreach($amounts as $i=>$amount){
    $product=TelegramStars::product($catalog,$base+$i);starsCheck($product['field']===$field&&$product['count']===$amount&&$product['stars']===$prices[$i]);
}
foreach([-1,24,99,108] as $id){$failed=false;try{TelegramStars::product($catalog,$id);}catch(InvalidArgumentException $e){$failed=true;}starsCheck($failed);}
$order=['order_id'=>str_repeat('a',48),'telegram_id'=>'123456','stars'=>4];
$payment=['invoice_payload'=>'tg1_'.$order['order_id'],'currency'=>'XTR','total_amount'=>4];
starsCheck(TelegramStars::matches($order,'123456',$payment));
starsCheck(!TelegramStars::matches($order,'654321',$payment));
foreach([['currency'=>'RUB'],['total_amount'=>3],['total_amount'=>'4'],['invoice_payload'=>'fake']] as $change)starsCheck(!TelegramStars::matches($order,'123456',array_replace($payment,$change)));
$now=time();$game=new Gameops([]);
foreach([[20,$now-601,50],[50,$now-601,50],[100,$now-900,50],[0,0,50],[0,$now+999,50]] as [$energy,$anchor,$max]){
    $user=['energy'=>$energy,'energy_time'=>$anchor,'max_energy'=>$max];$actual=$game->energySnapshot($user);$buy=TelegramStars::energyAfterPurchase($user,50,$now);
    starsCheck($buy[0]===$actual[0]+50&&abs($buy[1]-$actual[1])<=1);
}
echo "Stars: все 32 цены/награды из DOCX, строгая проверка плательщика/суммы/валюты и совместимая регенерация энергии проверены\n";
