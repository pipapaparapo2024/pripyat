<?php
require __DIR__.'/../../website/app/sitefriends.php';
class NoFriendsPDO extends PDO {public function __construct(){}public function prepare(string $query,array $options=[]):PDOStatement|false {throw new LogicException('Unexpected database access');}}
$f=new SiteFriends(new NoFriendsPDO,str_repeat('a',64));
$url=$f->invite(42);parse_str(parse_url($url,PHP_URL_QUERY),$params);
if(!preg_match('/^42\.[a-f0-9]{64}$/D',$params['friend']))throw new RuntimeException('Invalid invite');
foreach(['43.'.explode('.',$params['friend'])[1],$params['friend'].'x','42.invalid'] as $bad){try{$f->accept(7,$bad);throw new LogicException('Forged invite accepted');}catch(DomainException $e){}}
if((new SiteFriends(new NoFriendsPDO,str_repeat('b',64)))->invite(42)===$url)throw new RuntimeException('Secret ignored');
echo "Site friends: signed invitations reject tampering before database access\n";
