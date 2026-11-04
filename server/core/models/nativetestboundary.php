<?php
/** New VPS native TEST only. Verify launch before selecting a world or opening SQL. */
final class NativeTestBoundary {
    public static function resolve(array $launch,string $postedPlatform,string $postedUid,string $secret,array $access,int $now,?string $expectedAppId=null): array {
        if($expectedAppId!==null&&(!ctype_digit($expectedAppId)||(string)($launch['vk_app_id']??'')!==$expectedAppId))throw new InvalidArgumentException('app_id_mismatch');
        $sign=$launch['sign']??null;unset($launch['sign']);
        if(!is_string($sign)||!$secret)throw new InvalidArgumentException('invalid_launch');
        foreach($launch as $key=>$value)if(!is_string($key)||!str_starts_with($key,'vk_')||!is_scalar($value))throw new InvalidArgumentException('invalid_launch');
        ksort($launch);$expected=rtrim(strtr(base64_encode(hash_hmac('sha256',http_build_query($launch),$secret,true)),'+/','-_'),'=');
        if(!hash_equals($expected,$sign))throw new InvalidArgumentException('invalid_launch');
        $platform=($launch['vk_client']??'')==='ok'?'ok':'vk';
        if($platform!==$postedPlatform)throw new InvalidArgumentException('platform_mismatch');
        $uid=(string)($launch['vk_user_id']??'');
        if(!preg_match('/^[1-9][0-9]{0,9}$/D',$uid)||(int)$uid>2147483647||$uid!==$postedUid)throw new InvalidArgumentException('uid_mismatch');
        $stamp=(string)($launch['vk_ts']??'');if(!ctype_digit($stamp))throw new InvalidArgumentException('invalid_launch_time');
        $ts=(int)$stamp;if($platform==='ok'&&strlen($stamp)===13)$ts=intdiv($ts,1000);
        if($ts<$now-86400||$ts>$now+300)throw new InvalidArgumentException('expired_launch');
        if($platform==='vk'&&!in_array($uid,$access['vk']['ids']??[],true))throw new InvalidArgumentException('closed_test_access_denied');
        return ['platform'=>$platform,'database'=>$platform==='ok'?'stalker_ok_test':'stalker_test','uid'=>(int)$uid];
    }
}
