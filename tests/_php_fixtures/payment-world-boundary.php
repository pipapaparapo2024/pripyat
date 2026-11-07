<?php
require __DIR__.'/../../website/app/sitepayments.php';require __DIR__.'/../../server/core/models/nativeavatarcache.php';
class NoPaymentWorldPDO extends PDO {public function __construct(){}public function prepare(string $query,array $options=[]):PDOStatement|false {throw new LogicException('Unexpected database access');}}
$provider=new SiteYooKassa(['enabled'=>true,'require_test_payment'=>true,'shop_id'=>'123','secret_key'=>'test_fixture'],fn()=>['metadata'=>['game_world'=>'vk']]);
try{(new SitePayments(new NoPaymentWorldPDO,$provider,'ok'))->settle('test-payment',time());throw new LogicException('Cross-world payment accepted');}catch(DomainException $e){}
if(!NativeAvatarCache::valid('https://sun9.userapi.com/photo.jpg')||!NativeAvatarCache::valid('https://i.mycdn.me/image.jpg')||NativeAvatarCache::valid('http://i.mycdn.me/image.jpg')||NativeAvatarCache::valid('https://userapi.com.evil.example/image.jpg')||NativeAvatarCache::valid('https://127.0.0.1/admin'))throw new RuntimeException('Avatar URL boundary failed');
echo "Payment world mismatch rejected before database access; native avatar host/TLS boundaries passed\n";
