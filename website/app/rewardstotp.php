<?php

final class RewardsTotp {
    public static function code(string $secret, int $step, int $digits = 6): string {
        $hash = hash_hmac('sha1', pack('J', $step), $secret, true);
        $offset = ord($hash[19]) & 15;
        $number = unpack('N', substr($hash, $offset, 4))[1] & 0x7fffffff;
        return str_pad((string) ($number % (10 ** $digits)), $digits, '0', STR_PAD_LEFT);
    }

    public static function match(string $secret, string $code, int $time, int $lastStep): ?int {
        if (strlen($secret) < 20 || !preg_match('/\A[0-9]{6}\z/', $code)) return null;
        $step = intdiv($time, 30);
        foreach ([$step, $step - 1, $step + 1] as $candidate) {
            if ($candidate > $lastStep && hash_equals(self::code($secret, $candidate), $code)) {
                return $candidate;
            }
        }
        return null;
    }
}
