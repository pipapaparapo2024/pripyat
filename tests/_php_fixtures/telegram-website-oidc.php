<?php
require __DIR__.'/../../server/core/models/telegramoidc.php';
require __DIR__.'/../../server/core/models/telegramauth.php';
function check($x,$message){if(!$x)throw new RuntimeException($message);}
function reject($fn){try{$fn();}catch(Throwable $e){return;}throw new RuntimeException('Ожидался отказ');}
function rejectWithReason($fn,string $reason): void {
    try{$fn();}catch(InvalidArgumentException $e){
        check($e->getMessage()===$reason,'Неожиданный код отказа');
        return;
    }
    throw new RuntimeException('Ожидался отказ '.$reason);
}
$options=['private_key_bits'=>2048,'private_key_type'=>OPENSSL_KEYTYPE_RSA,'config'=>__DIR__.'/openssl-test.cnf'];
$key=openssl_pkey_new($options);
$rsa=openssl_pkey_get_details($key)['rsa'];
$jwks=['keys'=>[['kid'=>'fixture','kty'=>'RSA','alg'=>'RS256','use'=>'sig','n'=>TelegramOidc::base64url($rsa['n']),'e'=>TelegramOidc::base64url($rsa['e'])]]];
$now=1793710000;$client='123456789';$nonce=str_repeat('n',64);
$claims=['iss'=>'https://oauth.telegram.org','aud'=>$client,'sub'=>'opaque-not-game-id','id'=>4503599627370494,'iat'=>$now,'exp'=>$now+3600,'nonce'=>$nonce,'name'=>'Тестер'];
function token($claims,$key,$head=[]){
 $a=TelegramOidc::base64url(json_encode(array_replace(['alg'=>'RS256','kid'=>'fixture'],$head)));
 $b=TelegramOidc::base64url(json_encode($claims));openssl_sign($a.'.'.$b,$sig,$key,OPENSSL_ALGO_SHA256);
 return $a.'.'.$b.'.'.TelegramOidc::base64url($sig);
}
$jwt=token($claims,$key);
check(TelegramOidc::verify($jwt,$jwks,$client,$nonce,$now)['telegram_id']==='4503599627370494','Используется точный Telegram ID, не OIDC sub');
$codeClaims=$claims;unset($codeClaims['nonce']);
$codeJwt=token($codeClaims,$key);
check(TelegramOidc::verify($codeJwt,$jwks,$client,null,$now)['telegram_id']==='4503599627370494','Токен серверного обмена без запрошенного nonce');
reject(fn()=>TelegramOidc::verify($codeJwt,$jwks,$client,$nonce,$now));
reject(fn()=>TelegramOidc::verify($jwt,$jwks,$client,null,$now));
$withoutId=array_replace($codeClaims,['sub'=>(string)$claims['id']]);unset($withoutId['id']);
rejectWithReason(fn()=>TelegramOidc::verify(token($withoutId,$key),$jwks,$client,null,$now),'missing_jwt_telegram_id');
$stringIdJwt=token(array_replace($codeClaims,['id'=>(string)$claims['id']]),$key);
check(TelegramOidc::verify($stringIdJwt,$jwks,$client,null,$now)['telegram_id']===(string)$claims['id'],'Строковый ID сохраняется без потери точности');
foreach([null,false,0,'0','0123','1e3','1.5','+1',' 123',123.5,[],4503599627370496,'4503599627370496','45035996273704950'] as $invalidId) {
    rejectWithReason(fn()=>TelegramOidc::verify(token(array_replace($codeClaims,['id'=>$invalidId]),$key),$jwks,$client,null,$now),'invalid_jwt_telegram_id');
}
foreach([['iss'=>'https://attacker.invalid'],['aud'=>'other'],['aud'=>[$client]],['exp'=>$now],['iat'=>$now+31],['nbf'=>$now+1],['nonce'=>'wrong']] as $change)reject(fn()=>TelegramOidc::verify(token(array_replace($claims,$change),$key),$jwks,$client,$nonce,$now));
foreach([['alg'=>'none'],['alg'=>'HS256'],['kid'=>'missing'],['crit'=>['b64']]] as $head)reject(fn()=>TelegramOidc::verify(token($claims,$key,$head),$jwks,$client,$nonce,$now));
$other=openssl_pkey_new($options);reject(fn()=>TelegramOidc::verify(token($claims,$other),$jwks,$client,$nonce,$now));
reject(fn()=>TelegramOidc::verify($jwt,['keys'=>array_merge($jwks['keys'],$jwks['keys'])],$client,$nonce,$now));
$begin=TelegramOidc::begin($client,'https://pripyat-game-site.ru/auth/telegram/callback',$now);
parse_str(parse_url($begin['url'],PHP_URL_QUERY),$q);
check($q['code_challenge']===TelegramOidc::base64url(hash('sha256',$begin['pending']['verifier'],true)),'PKCE S256');
check(!array_key_exists('nonce',$q)&&!array_key_exists('nonce',$begin['pending']),'Серверный OAuth запрос следует схеме Telegram');
$prodBegin=TelegramOidc::begin($client,'https://pripyat-game-site.ru/auth/telegram-prod/callback',$now);
parse_str(parse_url($prodBegin['url'],PHP_URL_QUERY),$prodQuery);
check($prodQuery['redirect_uri']==='https://pripyat-game-site.ru/auth/telegram-prod/callback'
    &&$prodQuery['code_challenge_method']==='S256','PROD OIDC использует изолированный callback и PKCE');
reject(fn()=>TelegramOidc::begin($client,'https://attacker.invalid/auth/telegram-prod/callback',$now));
$session=['telegram_oidc'=>$begin['pending']];TelegramOidc::consume($session,$q['state'],$now);
check(!isset($session['telegram_oidc']),'Одноразовый callback');reject(fn()=>TelegramOidc::consume($session,$q['state'],$now));
$session=['telegram_oidc'=>$begin['pending']];reject(function()use(&$session,$now){TelegramOidc::consume($session,'wrong',$now);});check(!$session,'Ошибочный state тоже погашен');
$session=['telegram_oidc'=>$begin['pending']];reject(function()use(&$session,$q,$now){TelegramOidc::consume($session,$q['state'],$now+601);});
class OidcSharedStore {
 public $identities=[],$begins=0,$sessions=[];
 function begin(){$this->begins++;}function commit(){}function rollback(){}
 function resolvePlayer($id,$now){if(!isset($this->identities[$id]))$this->identities[$id]=42;return $this->identities[$id];}
 function saveSession($uid,$hash,$expiry,$key){$this->sessions[$uid]=$hash;}
}
$store=new OidcSharedStore;$botToken=$client.':abcdefghijklmnopqrstuvwxyz_fixture';
$config=['enabled'=>true,'environment'=>'test','database'=>'stalker_telegram_test','bot_token'=>$botToken];
$web=TelegramAuth::loginWebsite($stringIdJwt,$jwks,$client,null,$config,$store,$now);
$verified=TelegramOidc::verify($stringIdJwt,$jwks,$client,null,$now);
reject(fn()=>TelegramOidc::verify($stringIdJwt,$jwks,$client,null,$now+3601));
$later=TelegramAuth::loginVerifiedWebsiteSession($verified,$config,$store,$now+3601);
check($later['player_id']===$web['player_id'],'Проверенная серверная личность сохраняется независимо от срока одноразового JWT');
$data=['auth_date'=>(string)$now,'user'=>json_encode(['id'=>$claims['id'],'first_name'=>'Тестер'])];ksort($data);$lines=[];foreach($data as $k=>$v)$lines[]=$k.'='.$v;
$data['hash']=hash_hmac('sha256',implode("\n",$lines),hash_hmac('sha256',$botToken,'WebAppData',true));
$mini=TelegramAuth::login(http_build_query($data),$config,$store,$now);
check($web['player_id']===$mini['player_id']&&count($store->identities)===1,'Сайт и Mini App находят одну Telegram-идентичность');
$before=$store->begins;reject(fn()=>TelegramAuth::loginWebsite(token($claims,$other),$jwks,$client,$nonce,$config,$store,$now));check($store->begins===$before,'Поддельный веб-вход не открывает транзакцию');
echo "OIDC: подпись RSA, claims, точный ID, PKCE, state, nonce и повтор callback проверены\n";
