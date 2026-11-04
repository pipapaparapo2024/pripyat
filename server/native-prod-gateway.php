<?php
chdir(__DIR__);ini_set('display_errors','0');ini_set('log_errors','1');ini_set('error_log',__DIR__.'/php_errors.log');
require_once __DIR__.'/core/models/nativeprodboundary.php';
header('Cache-Control: private, no-store');
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'){http_response_code(405);exit;}
if(!NativeProdBoundary::allowsMethod($_POST['method']??null)){http_response_code(403);header('Content-Type: application/json');echo json_encode(['status'=>'error','code'=>403,'text'=>'Действие недоступно.']);exit;}
try{require __DIR__.'/universal-internal.php';}
catch(Throwable $e){
    $reason=$e instanceof InvalidArgumentException?$e->getMessage():'maintenance';
    $known=['app_id_mismatch','invalid_launch','platform_mismatch','uid_mismatch','invalid_launch_time','expired_launch','login_required','invalid_platform'];
    if(!in_array($reason,$known,true))$reason='maintenance';
    error_log('[native-prod] request_rejected reason='.$reason);http_response_code(403);header('Content-Type: application/json');
    echo json_encode(['status'=>'error','code'=>47,'reason'=>$reason,'maintenance'=>true,'text'=>'Идут технические работы. Попробуйте зайти позже.'],JSON_UNESCAPED_UNICODE);
}
