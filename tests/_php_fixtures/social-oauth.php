<?php
require __DIR__.'/../../website/app/socialoauth.php';
$config=['client_id'=>54875983,'redirect_uri'=>'https://pripyat-game-site.ru/auth/vk/callback'];
foreach(['vk','ok'] as $platform){
 $b=SocialOAuth::begin($config,$platform,1000);parse_str(parse_url($b['url'],PHP_URL_QUERY),$q);
 if($q['code_challenge']!==rtrim(strtr(base64_encode(hash('sha256',$b['pending']['verifier'],true)),'+/','-_'),'='))throw new RuntimeException('Invalid PKCE');
 if($q['provider']!==($platform==='vk'?'vkid':'ok_ru'))throw new RuntimeException('Wrong provider');
 $s=['social_oauth'=>$b['pending']];$p=SocialOAuth::consume($s,$b['pending']['state'],1001);if(isset($s['social_oauth'])||$p['platform']!==$platform)throw new RuntimeException('State not consumed');
 foreach([['social_oauth'=>$b['pending']],[]] as $s){try{SocialOAuth::consume($s,str_repeat('0',64),2000);throw new LogicException('Invalid state accepted');}catch(DomainException $e){}}
}
echo "Social OAuth: PKCE, providers, one-time state and expiry passed\n";

$state=str_repeat('a',64);
$trace=SocialOAuth::traceId($state,'test-secret');
if(!preg_match('/^[a-f0-9]{24}$/D',$trace)||str_contains($state,$trace))throw new RuntimeException('Unsafe trace ID');
if($trace!==SocialOAuth::traceId($state,'test-secret'))throw new RuntimeException('Start and callback traces differ');
if($trace===SocialOAuth::traceId(str_repeat('b',64),'test-secret')||$trace===SocialOAuth::traceId($state,'other-secret'))throw new RuntimeException('Trace is not scoped to the attempt and secret');
if(SocialOAuth::traceId([$state],'test-secret')!=='-'||SocialOAuth::traceId($state,'')!=='-')throw new RuntimeException('Invalid trace accepted');
if(SocialOAuth::failureReason(new DomainException('invalid_social_state'))!=='invalid_social_state')throw new RuntimeException('Known reason lost');
if(SocialOAuth::failureReason(new RuntimeException('unexpected error containing a private URL'))!=='other')throw new RuntimeException('Private error leaked');
echo "Social OAuth: trace correlation and log redaction passed\n";
