<?php
require_once __DIR__.'/erasedaccounts.php';
/** Closed native VK/OK PROD. Never selects TEST/TG databases or trusts client roles. */
final class NativeProdBoundary {
    const WORLDS=['vk'=>'stalker','ok'=>'stalker_ok'];
    public static function resolve(array $launch,string $platform,string $uid,array $config,int $now,bool $fresh=true): array {
        if(($config['environment']??'')!=='prod'||($config['enabled']??false)!==true)throw new RuntimeException('maintenance');
        if(!isset(self::WORLDS[$platform]))throw new InvalidArgumentException('invalid_platform');
        $expectedApp=self::launchAppId($config,$platform);
        if(!ctype_digit($expectedApp)||(string)($launch['vk_app_id']??'')!==$expectedApp)throw new InvalidArgumentException('app_id_mismatch');
        $secret=$config['api_secret']??'';$sig=$launch['sign']??null;unset($launch['sign']);
        if(!is_string($secret)||$secret===''||!is_string($sig))throw new InvalidArgumentException('invalid_launch');
        foreach($launch as $k=>$v)if(!is_string($k)||!str_starts_with($k,'vk_')||!is_scalar($v))throw new InvalidArgumentException('invalid_launch');
        ksort($launch);$expected=rtrim(strtr(base64_encode(hash_hmac('sha256',http_build_query($launch),$secret,true)),'+/','-_'),'=');
        if(!hash_equals($expected,$sig))throw new InvalidArgumentException('invalid_launch');
        if((($launch['vk_client']??'')==='ok'?'ok':'vk')!==$platform)throw new InvalidArgumentException('platform_mismatch');
        if($platform==='ok'&&isset($launch['vk_ok_app_id'])&&(string)$launch['vk_ok_app_id']!==(string)$config['app_ids']['ok'])throw new InvalidArgumentException('app_id_mismatch');
        if(!preg_match('/^[1-9][0-9]{0,9}$/D',$uid)||(int)$uid>2147483647||(string)($launch['vk_user_id']??'')!==$uid)throw new InvalidArgumentException('uid_mismatch');
        $stamp=(string)($launch['vk_ts']??'');if(!ctype_digit($stamp))throw new InvalidArgumentException('invalid_launch_time');
        $ts=(int)$stamp;if($platform==='ok'&&strlen($stamp)===13)$ts=intdiv($ts,1000);
        if($ts>$now+300||($fresh&&$ts<$now-86400))throw new InvalidArgumentException('expired_launch');
        $nativeAllowed=$platform==='ok'&&in_array((string)($launch['vk_ok_user_id']??''),$config['access']['ok']['native_ids']??[],true);
        if(($config['public_access']??false)!==true&&!$nativeAllowed&&!in_array($uid,$config['access'][$platform]['ids']??[],true))throw new RuntimeException('maintenance');
        ErasedAccounts::assertAllowed($platform,(int)$uid);
        return ['platform'=>$platform,'uid'=>(int)$uid,'database'=>self::WORLDS[$platform],'app_id'=>$expectedApp];
    }
    public static function launchAppId(array $config,string $platform): string {
        return (string)($config['launch_app_ids'][$platform]??$config['app_ids'][$platform]??'');
    }
    public static function database(array $config,string $platform): array {
        $name=self::WORLDS[$platform]??null;$db=$name?($config['databases'][$name]??null):null;
        if(!is_array($db)||($db['database']??'')!==$name||($db['host']??'')!=='127.0.0.1'||(int)($db['port']??0)!==3306)throw new RuntimeException('database_mismatch');
        return $db;
    }
    public static function allowsMethod($method): bool {
        if(!is_string($method)||!preg_match('/^[a-z0-9]+\.[A-Za-z][A-Za-z0-9]*$/D',$method))return false;
        if(in_array($method,['users.resetSession','users.devGetLogs','users.devGrantShmot','users.devGrantWeapons','users.devGrantCurrency','users.devSetRyukzakLevel','users.setDevFlag','users.setDevCombo','users.toggleDevKeyring','users.devPeekRouletteCups'],true))return true;
        return !preg_match('/\.(?:dev|reset|setDev|toggleDev)/i',$method);
    }
    public static function allowsAccountMethod(string $method,string $uid,string $platform,array $launch=[]): bool {
        return $method!=='users.devGetLogs'||(($platform==='vk'&&$uid==='382448269')||($platform==='ok'&&$uid==='382448269'&&($launch['vk_ok_user_id']??'')==='587256562321'));
    }
}
