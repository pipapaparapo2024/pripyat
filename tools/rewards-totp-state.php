<?php
// Run as the administrator. Never prints the secret; enrollment is behind HTTPS Basic Auth.
if (PHP_SAPI !== 'cli' || $argc !== 3 || !preg_match('/\A[a-zA-Z0-9_-]{1,64}\z/', $argv[2])) exit(2);
$path=$argv[1];
$file=fopen($path,'x');
if (!$file) exit(2); // Recovery must archive the old state explicitly first.
chmod($path,0600);
$data=['secret'=>bin2hex(random_bytes(20)),'user'=>$argv[2],'enabled'=>false,'step'=>-1,'retry_at'=>0,'failures'=>0];
$json=json_encode($data,JSON_THROW_ON_ERROR);
if(fwrite($file,$json)!==strlen($json)||!fflush($file))exit(1);
fclose($file);
echo "State created; configure the FPM account permissions before enabling the gate.\n";
