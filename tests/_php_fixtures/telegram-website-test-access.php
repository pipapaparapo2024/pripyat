<?php
require_once __DIR__.'/../../server/core/models/telegramwebsitetestaccess.php';
function checkPreview(bool $ok,string $message): void { if(!$ok)throw new RuntimeException($message); }
$now=1794225000;$ticket='test-ticket-'.str_repeat('a',32);$ticket=substr(str_replace(['+','/','='],['-','_',''],$ticket),0,43);
$hash=hash('sha256',$ticket);$session=[];
checkPreview(!TelegramWebsiteTestAccess::active($session,$now),'Empty session authorized');
checkPreview(TelegramWebsiteTestAccess::redeem($session,$ticket,$hash,$now+86400,$now),'Valid ticket rejected');
checkPreview(TelegramWebsiteTestAccess::active($session,$now),'Redeemed session not active');
checkPreview(!TelegramWebsiteTestAccess::active($session,$now+3600),'Session grant did not expire');
$wrong=[];checkPreview(!TelegramWebsiteTestAccess::redeem($wrong,$ticket.'x',$hash,$now+86400,$now),'Wrong ticket accepted');
checkPreview(!isset($wrong['telegram_test_preview']),'Rejected ticket changed session');
checkPreview(!TelegramWebsiteTestAccess::redeem($wrong,$ticket,$hash,$now,$now),'Expired access accepted');
checkPreview(!TelegramWebsiteTestAccess::redeem($wrong,$ticket,$hash,$now+86401,$now),'Overlong access accepted');
checkPreview(!TelegramWebsiteTestAccess::redeem($wrong,$ticket,'not-a-hash',$now+86400,$now),'Malformed hash accepted');
echo "Telegram website preview: signed-length ticket, expiry and session grant checked\n";
