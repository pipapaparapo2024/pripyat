<?php
require __DIR__.'/../../server/core/models/siteaccountpolicy.php';
function siteCheck($v,$label){if(!$v)throw new RuntimeException($label);}
function siteReject($f){try{$f();}catch(InvalidArgumentException $e){return;}throw new RuntimeException('Ожидался отказ');}
$config=['allowed_emails'=>['Tester@example.com']];
siteCheck(SiteAccountPolicy::allowed(' tester@EXAMPLE.com ',$config),'Регистр email не создаёт вторую идентичность');
siteCheck(!SiteAccountPolicy::allowed('other@example.com',$config),'Другой email закрыт');
siteCheck(!SiteAccountPolicy::allowed('tester+other@example.com',$config),'Alias не обходит допуск');
foreach(['not-email',"a@b.com\r\nBcc:evil@example.com",'юзер@example.com'] as $email)siteReject(fn()=>SiteAccountPolicy::email($email));
$hash=SiteAccountPolicy::passwordHash('fixture-password-123');siteCheck(password_verify('fixture-password-123',$hash)&&!password_verify('wrong',$hash),'Argon2id проверяет пароль');
foreach(['short',str_repeat('x',257),"fixture\0password"] as $password)siteReject(fn()=>SiteAccountPolicy::passwordHash($password));
$now=1793720000;$token=SiteAccountPolicy::emailToken('verify_email',$now);$row=$token;unset($row['token']);
siteCheck(SiteAccountPolicy::tokenMatches($row,$token['token'],'verify_email',$now),'Хеш одноразового токена');
siteCheck(!SiteAccountPolicy::tokenMatches($row,$token['token'],'reset_password',$now),'Подтверждение не сбрасывает пароль');
siteCheck(!SiteAccountPolicy::tokenMatches($row,str_repeat('0',64),'verify_email',$now),'Подмена токена');
siteCheck(!SiteAccountPolicy::tokenMatches($row,$token['token'],'verify_email',$now+86400),'Истечение на границе');
$row['consumed_at']=$now;siteCheck(!SiteAccountPolicy::tokenMatches($row,$token['token'],'verify_email',$now),'Повтор погашенного токена запрещён');
siteCheck(SiteAccountPolicy::emailToken('reset_password',$now)['expires_at']===$now+1800,'Сброс ограничен 30 минутами');
echo "Аккаунты сайта: допуск email, пароль, хеш токена, назначение, срок и повтор проверены\n";
