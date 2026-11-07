<?php
require __DIR__.'/../../website/app/sociallinkstore.php';
require __DIR__.'/../../server/core/models/nativeprodboundary.php';
$dir=sys_get_temp_dir().'/pripyat-links-'.bin2hex(random_bytes(8));mkdir($dir,0700);$s=new SocialLinkStore($dir);$n=1000;
function deny(callable $fn): void {try{$fn();}catch(DomainException|InvalidArgumentException $e){return;}throw new RuntimeException('Unexpected authorization');}
try{
 foreach(['vk','ok'] as $world){
  $identity=['platform'=>$world,'provider_id'=>'123','native_vk_id'=>$world==='vk'?'456':null,'profile'=>['first_name'=>'Tester'],'expires_at'=>2000];
  $code=$s->start($identity,$n);deny(fn()=>$s->finish($code,$identity,$n));
  deny(fn()=>$s->preview($code,$world==='vk'?'ok':'vk',$n));deny(fn()=>$s->preview($code,$world,1600));
  $external=$world==='vk'?'456':'987654321012';
  if($world==='vk')deny(fn()=>$s->approve($code,$world,99,'99',$n));
  $s->approve($code,$world,456,$external,$n);deny(fn()=>$s->finish($code,array_replace($identity,['provider_id'=>'999']),$n));
  $binding=$s->finish($code,$identity,$n);if($binding['uid']!==456||$binding['external']!==$external)throw new RuntimeException('Wrong character');
  deny(fn()=>$s->finish($code,$identity,$n));if($s->binding($world,'123')!==$binding)throw new RuntimeException('Binding not persistent');
  $other=array_replace($identity,['provider_id'=>'999']);$c2=$s->start($other,$n);$s->approve($c2,$world,456,$external,$n);deny(fn()=>$s->finish($c2,$other,$n));
  $c3=$s->start($identity,$n);$s->approve($c3,$world,777,$external,$n);deny(fn()=>$s->finish($c3,$identity,$n));
 }
 $cfg=['enabled'=>true,'environment'=>'prod','public_access'=>true,'api_secret'=>'fixture-only-secret','app_ids'=>['vk'=>54574178,'ok'=>512005669202]];
 foreach(['vk','ok'] as $world){$launch=['vk_app_id'=>(string)$cfg['app_ids'][$world],'vk_user_id'=>'456','vk_ts'=>'1000'];if($world==='ok'){$launch['vk_client']='ok';$launch['vk_ok_user_id']='987654321012';}ksort($launch);$launch['sign']=rtrim(strtr(base64_encode(hash_hmac('sha256',http_build_query($launch),$cfg['api_secret'],true)),'+/','-_'),'=');NativeProdBoundary::resolve($launch,$world,'456',$cfg,1000);$launch['vk_user_id']='999';deny(fn()=>NativeProdBoundary::resolve($launch,$world,'999',$cfg,1000));}
 echo "Social character links: dual consent, expiry, replay, world isolation, uniqueness, immutable binding, signed identity passed\n";
}finally{foreach(glob($dir.'/*') as $p)unlink($p);if(is_file($dir.'/.lock'))unlink($dir.'/.lock');rmdir($dir);}
