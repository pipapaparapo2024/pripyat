<?php
require __DIR__.'/../../website/app/siteaccounts.php';
class NoConnectSitePDO extends PDO {public function __construct(){} public function prepare(string $query,array $options=[]): PDOStatement|false {throw new LogicException('Unexpected DB access');}}
$a=new SiteAccounts(new NoConnectSitePDO,['Tester@example.com']);
function yes($v){if(!$v)throw new RuntimeException('Assertion failed');}
yes($a->allowed(' TESTER@EXAMPLE.COM '));yes(!$a->allowed('other@example.com'));yes(!$a->allowed('tester+alias@example.com'));
foreach([fn()=>$a->register('other@example.com','password-1234',time()),fn()=>$a->verifyPassword('other@example.com','password-1234')] as $fn){try{$fn();throw new LogicException('Unexpected access');}catch(DomainException $expected){}}
foreach(['x',"a@b.com\r\nBcc: evil@example.com"] as $bad){try{SiteAccounts::email($bad);throw new LogicException('Invalid email accepted');}catch(InvalidArgumentException $expected){}}
echo "Site accounts: closed access rejects before database operations\n";
