<?php
ini_set('display_errors','0');ini_set('log_errors','1');ini_set('error_log',__DIR__.'/php_errors.log');
header('Cache-Control: private, no-store');header('Content-Type: text/html; charset=utf-8');
require_once __DIR__.'/core/models/nativeprodconfig.php';require_once __DIR__.'/core/models/nativeprodboundary.php';
try{
    if(($_SERVER['REQUEST_METHOD']??'')!=='GET')throw new RuntimeException('maintenance');
    $c=NativeProdConfig::load();$launch=[];
    foreach($_GET as $key=>$value)if($key==='sign'||str_starts_with((string)$key,'vk_'))$launch[$key]=$value;
    $platform=($launch['vk_client']??'')==='ok'?'ok':'vk';
    NativeProdBoundary::resolve($launch,$platform,(string)($launch['vk_user_id']??''),$c,time());
    $html=file_get_contents(__DIR__.'/client-shell.html');
    $devDiagnostics=NativeProdBoundary::allowsAccountMethod('users.devGetLogs',(string)$launch['vk_user_id'],$platform,$launch);
    $flags=['vk'=>($c['payments']['vk_enabled']??false)===true,'ok'=>($c['payments']['ok_enabled']??false)===true];
    echo str_replace('</head>','<script>window.__closedNativeProd=true;window.__nativeProdDevDiagnostics='.json_encode($devDiagnostics).';window.__nativeProdPayments='.json_encode($flags).';</script></head>',$html);
}catch(Throwable $e){
    $reason=in_array($e->getMessage(),['maintenance','app_id_mismatch','invalid_launch','platform_mismatch','uid_mismatch','expired_launch','invalid_launch_time'],true)?$e->getMessage():'maintenance';
    error_log('[native-prod-entry] denied reason='.$reason);
    // Return the existing game maintenance page without loading game JS/API.
    http_response_code(200);readfile(__DIR__.'/maintenance.html');
}
