<?php
/** Short-lived browser grant for the owner-only Telegram website TEST login. */
final class TelegramWebsiteTestAccess {
    public static function active(array $session,int $now): bool {
        $grant=$session['telegram_test_preview']??null;
        return is_array($grant)&&is_int($grant['expires_at']??null)&&$grant['expires_at']>$now;
    }

    public static function redeem(array &$session,string $ticket,string $expectedHash,int $accessExpiresAt,int $now): bool {
        if($accessExpiresAt<=$now||$accessExpiresAt>$now+86400||!preg_match('/^[a-f0-9]{64}$/D',$expectedHash)
            ||!preg_match('/^[A-Za-z0-9_-]{43}$/D',$ticket)||!hash_equals($expectedHash,hash('sha256',$ticket)))return false;
        $session['telegram_test_preview']=['expires_at'=>min($accessExpiresAt,$now+3600)];
        return true;
    }
}
