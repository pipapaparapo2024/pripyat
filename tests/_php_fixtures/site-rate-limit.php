<?php
require __DIR__.'/../../website/app/siteratelimit.php';
$dir=sys_get_temp_dir().'/pripyat-rate-test-'.bin2hex(random_bytes(8));mkdir($dir,0700);
try{
 $r=new SiteRateLimit($dir,str_repeat('s',32));$r->consume('login','fixture',2,60,100);$r->consume('login','fixture',2,60,101);
 try{$r->consume('login','fixture',2,60,102);throw new LogicException('Limit bypass');}catch(DomainException $expected){}
 $r->consume('login','fixture',2,60,160);$r->consume('mail','fixture',1,60,102);
 foreach(glob($dir.'/*') as $file)if(str_contains(basename($file),'fixture'))throw new RuntimeException('Identity leaked');
 echo "Site rate limits: limit, expiry, scopes, private keys passed\n";
}finally{foreach(glob($dir.'/*') as $file)unlink($file);rmdir($dir);}
