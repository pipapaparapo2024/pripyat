<?php
require __DIR__.'/../../website/app/sitedonations.php';
foreach([[[],[]],[[],['access'=>['enabled'=>true]]],[['site_authenticated'=>['expires_at'=>0]],['access'=>['enabled'=>true]]]] as [$session,$config]){
 try{SiteDonations::read($session,$config);throw new RuntimeException('unauthorized_history');}catch(DomainException $e){if($e->getMessage()!=='login_required')throw $e;}
}
echo "PASS: anonymous, disabled and expired sessions cannot read donation history\n";
