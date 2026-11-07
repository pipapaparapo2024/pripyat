<?php
require __DIR__.'/../../server/core/models/nativeplayersessionlock.php';
if(NativePlayerSessionLock::name('stalker',42)===NativePlayerSessionLock::name('stalker_ok',42))throw new RuntimeException('Worlds share player lock');
foreach([['stalker_site_test',42],['stalker',0],['stalker',2147483648]] as [$world,$uid]){try{NativePlayerSessionLock::name($world,$uid);throw new LogicException('Invalid player accepted');}catch(InvalidArgumentException $e){}}
echo "Native session lock: platform separation and strict identity bounds passed\n";
