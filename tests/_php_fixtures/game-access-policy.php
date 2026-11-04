<?php
require __DIR__.'/../../server/core/models/gameaccesspolicy.php';
$config=json_decode(file_get_contents(__DIR__.'/../../docs/closed-test-access.example.json'),true);$p=new GameAccessPolicy($config);
function policyCheck($v){if(!$v)throw new RuntimeException('Access policy test failed');}
foreach(['438953352','184138040','382448269'] as $id)policyCheck($p->allowed('vk',$id));
policyCheck(!$p->allowed('vk','999'));policyCheck($p->allowed('ok','999'));
policyCheck($p->allowed('telegram','1355806786'));policyCheck(!$p->allowed('telegram','438953352'));policyCheck(!$p->allowed('telegram','184138040'));
policyCheck($p->allowed('telegram','7522704539'));policyCheck(!$p->allowed('vk','7522704539'));
policyCheck($p->allowed('telegram','592854868'));policyCheck(!$p->allowed('vk','592854868'));
foreach(['@Khikaev','@FleXiw','0','-1','001','1e3',''] as $id)foreach(['vk','ok','telegram'] as $platform)policyCheck(!$p->allowed($platform,$id));
policyCheck(!$p->allowed('unknown','1355806786'));
$failed=false;try{new GameAccessPolicy([]);}catch(InvalidArgumentException $e){$failed=true;}policyCheck($failed);
$config['telegram']['ids'][]='@username';$failed=false;try{new GameAccessPolicy($config);}catch(InvalidArgumentException $e){$failed=true;}policyCheck($failed);
echo "Access policy: VK three IDs, OK open only after authentication, TG owner only until numeric IDs confirmed, no cross-platform access by ID or username\n";
