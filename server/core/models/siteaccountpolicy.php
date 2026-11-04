<?php
/** Native website identities only. Never shares email identities with social accounts. */
final class SiteAccountPolicy {
    public static function email(string $email): string {
        $email=strtolower(trim($email));
        if(strlen($email)>254||!preg_match('/^[\x21-\x7e]+$/D',$email)||filter_var($email,FILTER_VALIDATE_EMAIL)===false)throw new InvalidArgumentException('invalid_email');
        return $email;
    }
    public static function allowed(string $email,array $config): bool {
        $email=self::email($email);
        foreach($config['allowed_emails']??[] as $candidate)if(is_string($candidate)&&self::email($candidate)===$email)return true;
        return false;
    }
    public static function passwordHash(string $password): string {
        if(strlen($password)<10||strlen($password)>256||str_contains($password,"\0"))throw new InvalidArgumentException('invalid_password');
        return password_hash($password,PASSWORD_ARGON2ID);
    }
    /** Raw token belongs only in a one-time email URL; persist hash exclusively. */
    public static function emailToken(string $purpose,int $now): array {
        if(!in_array($purpose,['verify_email','reset_password'],true))throw new InvalidArgumentException('invalid_email_purpose');
        $raw=bin2hex(random_bytes(32));
        return ['token'=>$raw,'token_hash'=>hash('sha256',$raw),'purpose'=>$purpose,'created_at'=>$now,'expires_at'=>$now+($purpose==='verify_email'?86400:1800)];
    }
    public static function tokenMatches(array $row,string $raw,string $purpose,int $now): bool {
        return preg_match('/^[a-f0-9]{64}$/D',$raw)===1&&($row['purpose']??'')===$purpose
            &&in_array($purpose,['verify_email','reset_password'],true)&&($row['consumed_at']??null)===null
            &&isset($row['expires_at'])&&(int)$row['expires_at']>$now
            &&is_string($row['token_hash']??null)&&hash_equals($row['token_hash'],hash('sha256',$raw));
    }
}
