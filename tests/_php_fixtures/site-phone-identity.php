<?php
require __DIR__.'/../../website/app/sitephoneidentity.php';
function check($ok){if(!$ok)throw new RuntimeException('Phone identity assertion failed');}
$key=random_bytes(32);$a='+7 (999) 123-45-67';$b='89991234567';
check(SitePhoneIdentity::normalize($a)==='+79991234567');
check(SitePhoneIdentity::fingerprint($a,$key)===SitePhoneIdentity::fingerprint($b,$key));
$x=SitePhoneIdentity::encrypt($a,$key);$y=SitePhoneIdentity::encrypt($a,$key);check($x!==$y);check(SitePhoneIdentity::decrypt($x,$key)==='+79991234567');
foreach(['+7 (700) 123-45-67'=>'+77001234567','+33 1 23 45 67 89'=>'+33123456789','+375 (29) 123-45-67'=>'+375291234567','+44 7700 900123'=>'+447700900123','+8 999 1234567'=>'+89991234567','+123456789012345'=>'+123456789012345'] as $input=>$canonical){
 check(SitePhoneIdentity::normalize($input)===$canonical);
 check(SitePhoneIdentity::decrypt(SitePhoneIdentity::encrypt($input,$key),$key)===$canonical);
 check(SitePhoneIdentity::fingerprint($input,$key)===SitePhoneIdentity::fingerprint($canonical,$key));
}
foreach(['79991234567x','+7999123456','+0123456789','++33123456789','33+123456789','33123456789','+1234567890123456','+123','+',''] as $bad){try{SitePhoneIdentity::normalize($bad);throw new LogicException('accepted invalid phone');}catch(InvalidArgumentException $expected){}}
$x[strlen($x)-1]=chr(ord($x[strlen($x)-1])^1);
try{SitePhoneIdentity::decrypt($x,$key);throw new LogicException('accepted tampering');}catch(RuntimeException $expected){check(!($expected instanceof LogicException));}
echo "Phone identity: normalization, uniqueness and authenticated encryption passed\n";
