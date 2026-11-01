<?php
require __DIR__.'/../../server/core/models/devlogreader.php';
class Gameops { function __construct($r) {} }
class TestTools {
    public $result = null;
    function error($code) { $this->result = ['error'=>$code]; }
    function output($data) { $this->result = $data; }
}
require __DIR__.'/../../server/core/controllers/users.php';
function check($condition) { if (!$condition) throw new Exception('Dev logs regression'); }
$secret = 'SENSITIVE_SECRET_123456789';
$lines = '[31-Oct-2026 20:00:00 UTC] [ok_pay_callback] raw_get={"sig":"'.$secret.'","token":"'.$secret.'"}' . "\n" . 'PHP Warning: https://example.org/?access_token='.$secret . "\n" . $secret;
$safe = DevLogReader::project($lines);
check(strpos(json_encode($safe),$secret) === false);
check($safe[0] === ['event'=>'ok-payment','time'=>'31-Oct-2026 20:00:00']);
check($safe[1] === ['event'=>'warning']);
check(DevLogReader::project('[universal.checkToken] код 4 | token='.$secret) === [['event'=>'authorization','code'=>4]]);
check(count(DevLogReader::project(str_repeat("PHP Warning: token=$secret\n",500))) === 150);
check(DevLogReader::project('PHP Fatal error: Uncaught TypeError: '.$secret.' in /var/www/stalker/server/universal.php:120') === [['event'=>'fatal','reason'=>'type_error','file'=>'universal.php','line'=>120]]);
$fp = fopen('php://temp','w+b');
fwrite($fp, str_repeat($secret,4000)."\n[universal.checkToken] код 3\n");
$tail = DevLogReader::tail($fp); fclose($fp);
check($tail === ['entries'=>[['event'=>'authorization','code'=>3]],'available'=>true,'truncated'=>true]);
foreach (['1113977365','382448269','438953352','184138040','123','382448269x',''] as $uid) {
    $tools = new TestTools();
    $controller = new Users(['uid'=>$uid,'tools'=>$tools,'user_params'=>['path'=>'/etc/passwd','uid'=>'382448269']]);
    check(in_array('devGetLogs',$controller->permits,true));
    $controller->devGetLogs();
    if (in_array($uid,['1113977365','382448269','438953352','184138040'],true)) check(isset($tools->result['entries']));
    else check($tools->result === ['error'=>403]);
}
echo "Dev logs: projection, bounds, all Dev accounts and denial passed\n";
