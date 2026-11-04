<?php
/** Strict Telegram website OIDC boundary; no SQL, bot mutations, or unverified identity fallback. */
final class TelegramOidc {
    public static function base64url(string $value): string { return rtrim(strtr(base64_encode($value), '+/', '-_'), '='); }
    private static function decode(string $value): string {
        if ($value === '' || !preg_match('/^[A-Za-z0-9_-]+$/D', $value)) throw new InvalidArgumentException('invalid_encoding');
        $decoded=base64_decode(strtr($value,'-_','+/'),true);
        if ($decoded===false || self::base64url($decoded)!==$value) throw new InvalidArgumentException('invalid_encoding');
        return $decoded;
    }
    public static function begin(string $clientId,string $redirect,int $now): array {
        if (!preg_match('/^[1-9][0-9]+$/D',$clientId) || $redirect!=='https://pripyat-game-site.ru/auth/telegram/callback') throw new InvalidArgumentException('invalid_oidc_config');
        $pending=['state'=>bin2hex(random_bytes(32)),'nonce'=>bin2hex(random_bytes(32)), 'verifier'=>self::base64url(random_bytes(48)),'created_at'=>$now];
        $url='https://oauth.telegram.org/auth?'.http_build_query(['client_id'=>$clientId,'redirect_uri'=>$redirect,'response_type'=>'code','scope'=>'openid profile','state'=>$pending['state'],'nonce'=>$pending['nonce'],'code_challenge'=>self::base64url(hash('sha256',$pending['verifier'],true)),'code_challenge_method'=>'S256'],'','&',PHP_QUERY_RFC3986);
        return ['pending'=>$pending,'url'=>$url];
    }
    /** Removes pending challenge even on failure, so a callback cannot be replayed. */
    public static function consume(array &$session,string $state,int $now): array {
        $p=$session['telegram_oidc']??null;unset($session['telegram_oidc']);
        if (!is_array($p) || !is_string($p['state']??null) || !is_int($p['created_at']??null) || $p['created_at']>$now || $p['created_at']<$now-600 || !hash_equals($p['state'],$state)) throw new InvalidArgumentException('invalid_oidc_state');
        return $p;
    }
    private static function der(int $tag,string $body): string {
        $length=strlen($body);$encoded='';
        if($length<128)$encoded=chr($length);
        else{while($length>0){$encoded=chr($length&255).$encoded;$length>>=8;}$encoded=chr(128+strlen($encoded)).$encoded;}
        return chr($tag).$encoded.$body;
    }
    private static function pem(array $jwk): string {
        $ints='';
        foreach(['n','e'] as $key){
            $bytes=ltrim(self::decode((string)($jwk[$key]??'')),"\0");
            if($bytes==='')throw new InvalidArgumentException('invalid_jwk');
            if(ord($bytes[0])&128)$bytes="\0".$bytes;
            $ints.=self::der(2,$bytes);
        }
        $rsa=self::der(48,$ints);
        $spki=self::der(48,hex2bin('300d06092a864886f70d0101010500').self::der(3,"\0".$rsa));
        return "-----BEGIN PUBLIC KEY-----\n".chunk_split(base64_encode($spki),64,"\n")."-----END PUBLIC KEY-----\n";
    }
    public static function verify(string $jwt,array $jwks,string $clientId,string $nonce,int $now): array {
        if(strlen($jwt)>16384 || strlen($nonce)<32)throw new InvalidArgumentException('invalid_id_token');
        $parts=explode('.',$jwt);if(count($parts)!==3)throw new InvalidArgumentException('invalid_id_token');
        $head=json_decode(self::decode($parts[0]),true,16,JSON_THROW_ON_ERROR);
        $claims=json_decode(self::decode($parts[1]),true,16,JSON_THROW_ON_ERROR);
        if(!is_array($head)||!is_array($claims)||($head['alg']??'')!=='RS256'||!is_string($head['kid']??null)||isset($head['crit']))throw new InvalidArgumentException('invalid_jwt_header');
        $keys=[];
        foreach($jwks['keys']??[] as $key)if(is_array($key)&&($key['kid']??null)===$head['kid']&&($key['kty']??'')==='RSA'&&($key['alg']??'RS256')==='RS256'&&($key['use']??'sig')==='sig')$keys[]=$key;
        if(count($keys)!==1 || openssl_verify($parts[0].'.'.$parts[1],self::decode($parts[2]),self::pem($keys[0]),OPENSSL_ALGO_SHA256)!==1)throw new InvalidArgumentException('invalid_jwt_signature');
        $id=$claims['id']??null;
        if(($claims['iss']??'')!=='https://oauth.telegram.org'||!is_string($claims['aud']??null)||$claims['aud']!==$clientId
            ||!is_string($claims['sub']??null)||$claims['sub']===''||strlen($claims['sub'])>255
            ||!is_int($claims['exp']??null)||$claims['exp']<=$now||!is_int($claims['iat']??null)||$claims['iat']>$now+30||$claims['iat']>$claims['exp']
            ||(isset($claims['nbf'])&&(!is_int($claims['nbf'])||$claims['nbf']>$now))
            ||!is_string($claims['nonce']??null)||!hash_equals($nonce,$claims['nonce'])
            ||!is_int($id)||$id<1||$id>4503599627370495)throw new InvalidArgumentException('invalid_jwt_claims');
        // sub is an OIDC subject, NOT the Mini App Telegram user ID.
        return ['telegram_id'=>(string)$id,'expires_at'=>$claims['exp'],'profile'=>['first_name'=>is_string($claims['given_name']??null)?$claims['given_name']:(is_string($claims['name']??null)?$claims['name']:'Сталкер'),'last_name'=>is_string($claims['family_name']??null)?$claims['family_name']:'']];
    }
}
