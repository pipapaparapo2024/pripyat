<?php
$allowed=['1113977365','382448269','438953352','184138040'];
class DevDenied extends RuntimeException {}
class DenialOutput {function error($code){if($code!==403)throw new Exception('Expected 403');throw new DevDenied;}}
$checked=0;
foreach(['users','bosses','game2048','raznaryadka','zanachki'] as $file){
    require __DIR__ . '/../../server/core/controllers/'.$file.'.php';
    $class=new ReflectionClass($file);
    $controller=$class->newInstanceWithoutConstructor();
    foreach(array_merge($allowed,['999000001','0','','438953352x']) as $uid){
        $class->getProperty('registry')->setValue($controller,['uid'=>$uid]);
        $actual=$class->getMethod('_isDevUser')->invoke($controller);
        if($actual!==in_array($uid,$allowed,true))throw new Exception("Wrong dev access: $file uid=$uid");
    }
    $class->getProperty('registry')->setValue($controller,['uid'=>'999000001','tools'=>new DenialOutput]);
    foreach($class->getMethods(ReflectionMethod::IS_PUBLIC) as $method){
        if(!str_starts_with($method->name,'dev') && !in_array($method->name,['setDevFlag','setDevCombo','toggleDevKeyring','resetAllPlayers'],true))continue;
        try{
            $method->invoke($controller);
            throw new Exception('Dev operation did not deny ordinary user: '.$file.'.'.$method->name);
        }catch(DevDenied $expected){$checked++;}
    }
}
echo "Actual dev methods rejected ordinary account with 403: $checked\n";
echo "Server dev access: both approved players, existing developers and denied ordinary players passed\n";
