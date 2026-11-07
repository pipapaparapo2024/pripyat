<?php
require __DIR__.'/../../website/app/siteroles.php';
$c=['access'=>['enabled'=>true,'email'=>['mode'=>'allowlist','ids'=>['current@example.com','future@example.com']]],'developer_emails'=>['current@example.com','removed@example.com']];
if(SiteRoles::forEmail(' CURRENT@example.com ',$c)!==['developer'])throw new RuntimeException('Current developer denied');
foreach(['future@example.com','removed@example.com','other@example.com'] as $email)if(SiteRoles::forEmail($email,$c)!==[])throw new RuntimeException('Unexpected developer grant');
$c['access']['enabled']=false;if(SiteRoles::forEmail('current@example.com',$c)!==[])throw new RuntimeException('Disabled access granted');
echo "Site roles: fixed developer list, future players, removal and disabled access passed\n";

$c['access']['enabled']=true;$c['access']['email']['mode']='open';
if(SiteRoles::forEmail('current@example.com',$c)!==['developer']||SiteRoles::forEmail('future@example.com',$c)!==[])throw new RuntimeException('Public access must not grant developer');
