<?php
require_once __DIR__.'/nativeprodconfig.php';require_once __DIR__.'/nativeprodboundary.php';
require_once __DIR__.'/nativeplayersessionlock.php';
final class NativeProdRegistryBootstrap {
    public static function apply(array &$vars): void {
        $c=NativeProdConfig::load();if(($c['enabled']??false)!==true)throw new RuntimeException('maintenance');
        $platform=$_POST['platform']??'';$uid=$_POST['uid']??'';
        if(!is_string($platform)||!isset(NativeProdBoundary::WORLDS[$platform])||!is_string($uid)||!ctype_digit($uid))throw new InvalidArgumentException('invalid_platform');
        // OK native identity is checked against the signed launch below, never the POST UID alone.
        if(($c['public_access']??false)!==true&&$platform==='vk'&&!in_array($uid,$c['access'][$platform]['ids']??[],true))throw new RuntimeException('maintenance');
        if($platform!=='ok'&&!NativeProdBoundary::allowsAccountMethod((string)($_POST['method']??''),$uid,$platform))throw new RuntimeException('maintenance');
        $db=NativeProdBoundary::database($c,$platform);
        $playerPDO=new PDO('mysql:host=127.0.0.1;dbname='.$db['database'].';charset=utf8mb4',$db['user'],$db['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
        $playerLock=NativePlayerSessionLock::acquire($playerPDO,$db['database'],(int)$uid);
        register_shutdown_function(static function()use($playerPDO,$playerLock){NativePlayerSessionLock::release($playerPDO,$playerLock);});
        if(($_POST['method']??'')==='security.getToken'){
            $raw=$_POST['params']??'';if(!is_string($raw)||strlen($raw)>32768)throw new InvalidArgumentException('invalid_launch');
            $launch=json_decode(base64_decode(base64_decode(spec_decode($raw))),true,32,JSON_THROW_ON_ERROR);
            if(!is_array($launch))throw new InvalidArgumentException('invalid_launch');
            NativeProdBoundary::resolve($launch,$platform,$uid,$c,time());
        }else{
            $pdo=new PDO('mysql:host=127.0.0.1;dbname='.$db['database'].';charset=utf8mb4',$db['user'],$db['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
            $q=$pdo->prepare('SELECT vk_params FROM secure WHERE id=?');$q->execute([$uid]);$saved=$q->fetchColumn();
            if($saved===false)throw new InvalidArgumentException('login_required');
            $launch=json_decode($saved,true,32,JSON_THROW_ON_ERROR);if(!is_array($launch))throw new InvalidArgumentException('invalid_launch');
            NativeProdBoundary::resolve($launch,$platform,$uid,$c,time(),false);
        }
        if(!NativeProdBoundary::allowsAccountMethod((string)($_POST['method']??''),$uid,$platform,$launch))throw new RuntimeException('maintenance');
        $vars['api_id']=NativeProdBoundary::launchAppId($c,$platform);$vars['api_secret']=$c['api_secret'];$vars['api_service']=$c['api_service']??'';
        $vars['server']='127.0.0.1';$vars['db']=$db['database'];$vars['user']=$db['user'];$vars['pass']=$db['password'];$vars['platform']=$platform;
    }
}
