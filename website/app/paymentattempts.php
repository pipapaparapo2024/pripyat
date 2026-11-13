<?php
final class PaymentAttempts {
    public static function read(string $directory, string $world, string $paymentId): array {
        if (!in_array($world, ['site','vk','ok','telegram'], true)) return [];
        $path = $directory.'/'.$world.'.jsonl';
        if (!is_readable($path)) return [];
        $stream = fopen($path, 'rb');
        if (!$stream) return [];
        $rows = [];
        try {
            // Bound IO even after long operation; rotation is managed by logrotate.
            $size = fstat($stream)['size'];
            if ($size > 2097152) { fseek($stream, -2097152, SEEK_END); fgets($stream); }
            while (($line = fgets($stream, 4096)) !== false) {
                $row = json_decode($line, true);
                if (is_array($row) && ($row['payment_id'] ?? null) === $paymentId) {
                    $rows[] = ['time'=>(int)($row['time'] ?? 0), 'source'=>(string)($row['source'] ?? ''), 'outcome'=>(string)($row['outcome'] ?? '')];
                    if (count($rows) > 100) array_shift($rows);
                }
            }
        } finally { fclose($stream); }
        return $rows;
    }
}
