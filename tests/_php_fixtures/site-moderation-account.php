<?php
require __DIR__.'/../../website/app/sitesessions.php';require __DIR__.'/../../website/app/siteroles.php';
if(SiteSessions::requiresPhone(' KILLER_IK@MAIL.RU '))throw new RuntimeException('Moderation account blocked');
foreach(['other@mail.ru','killer_ik+other@mail.ru','fleeexim@gmail.com','bedzanansergej5110@gmail.com'] as $email)if(!SiteSessions::requiresPhone($email))throw new RuntimeException('Unexpected phone exemption');
$c=['access'=>['enabled'=>true,'email'=>['mode'=>'allowlist','ids'=>['killer_ik@mail.ru']]],'developer_emails'=>['killer_ik@mail.ru']];
if(SiteRoles::forEmail('killer_ik@mail.ru',$c)!==[])throw new RuntimeException('Moderation account received developer access');
echo "Moderation account: exact email phone exemption, no developer role, all other phones mandatory\n";
