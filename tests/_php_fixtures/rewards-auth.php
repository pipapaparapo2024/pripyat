<?php
require __DIR__.'/../../website/app/rewardsauth.php';
$c=['user'=>'admin','password_hash'=>password_hash('fixture-password',PASSWORD_BCRYPT),'signing_key'=>str_repeat('a',64)];
$t=RewardsAuth::authenticate('admin','fixture-password',$c,1000);if(!$t)throw new RuntimeException('Valid password rejected');
if(RewardsAuth::authenticate('admin','wrong',$c,1000)!==null||RewardsAuth::authenticate('other','fixture-password',$c,1000)!==null)throw new RuntimeException('Wrong credentials accepted');
$cookie=RewardsAuth::sign($t,$c);
foreach([1000,4599] as $now)if(RewardsAuth::verify($cookie,$c,$now)!==$t)throw new RuntimeException('Valid session rejected');
foreach([999,4600,9000] as $now)if(RewardsAuth::verify($cookie,$c,$now)!==null)throw new RuntimeException('Lifetime bypass');
if(RewardsAuth::verify($cookie.'x',$c,1000)!==null)throw new RuntimeException('Forged session accepted');
$rotated=$c;$rotated['password_hash']=password_hash('new-password',PASSWORD_BCRYPT);
if(RewardsAuth::verify($cookie,$rotated,1000)!==null)throw new RuntimeException('Password rotation failed');
$t['totp_generation']='fixture';$upgraded=RewardsAuth::sign($t,$c);
if(RewardsAuth::verify($upgraded,$c,4600)!==null)throw new RuntimeException('TOTP extended password lifetime');
$other=RewardsAuth::authenticate('admin','fixture-password',$c,1001);
if($other['nonce']===$t['nonce'])throw new RuntimeException('Browsers share session');
echo "Admin auth: credentials, tampering, exact one-hour expiry, key rotation and independent browsers passed\n";
