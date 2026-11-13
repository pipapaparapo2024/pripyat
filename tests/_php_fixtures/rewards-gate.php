<?php
require __DIR__.'/../../website/app/rewardstotp.php';
$mode=$argv[1];$dir=$argv[2];$key='12345678901234567890';
$state=['secret'=>bin2hex($key),'user'=>'admin','enabled'=>$mode!=='enroll','step'=>-1];
if($mode==='replay')$state['step']=intdiv(time(),30);
if($mode==='limited')$state['retry_at']=time()+100;
file_put_contents($dir.'/state.json',json_encode($state));
putenv('PRIPYAT_REWARDS_TOTP_STATE='.$dir.'/state.json');
if($mode==='missing')putenv('PRIPYAT_REWARDS_TOTP_STATE='.$dir.'/absent');
session_save_path($dir);session_name('pripyat_rewards_test');session_id('fixture'.bin2hex(random_bytes(8)));session_start();
$_SERVER=['REMOTE_USER'=>$mode==='wrong_user'?'other':'admin','REQUEST_METHOD'=>'GET','REQUEST_URI'=>'/rewards-admin/logs.php'];
$_SESSION['totp_csrf']='fixture';
if(in_array($mode,['valid_session','rotated'],true)){
 $_SESSION['totp_user']='admin';$_SESSION['totp_until']=time()+100;
 $_SESSION['totp_generation']=$mode==='rotated'?'old':hash('sha256',bin2hex($key));
}
if(in_array($mode,['success','replay','limited','csrf'],true)){
 $_SERVER['REQUEST_METHOD']='POST';$_POST=['totp_csrf'=>$mode==='csrf'?'wrong':'fixture','totp_code'=>RewardsTotp::code($key,intdiv(time(),30))];
}
register_shutdown_function(function()use($dir){file_put_contents($dir.'/result.json',json_encode(['status'=>http_response_code(),'session'=>$_SESSION]));});
require __DIR__.'/../../website/app/rewardstotp-gate.php';
requireRewardsTotp();echo 'ALLOWED';
