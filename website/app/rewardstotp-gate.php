<?php
require_once __DIR__.'/rewardstotp.php';

function requireRewardsTotp(): void {
    $path = getenv('PRIPYAT_REWARDS_TOTP_STATE');
    if (!$path) return;
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_name('pripyat_rewards_test');
        session_start(['cookie_httponly'=>true,'cookie_secure'=>true,'cookie_samesite'=>'Strict',
            'cookie_path'=>'/rewards-admin/','use_strict_mode'=>true]);
    }
    $user = $_SERVER['REMOTE_USER'] ?? '';
    if ($user === '') { http_response_code(403); exit; }
    if (($_SESSION['totp_user'] ?? '') === $user && ($_SESSION['totp_until'] ?? 0) > time()) return;
    $state = is_file($path) ? fopen($path, 'r+') : false;
    if (!$state || !flock($state, LOCK_EX)) { http_response_code(503); exit; }
    try {
        $data = json_decode(stream_get_contents($state), true, 16, JSON_THROW_ON_ERROR);
        $secret = hex2bin($data['secret'] ?? '');
        if ($secret === false || strlen($secret) < 20 || ($data['user'] ?? '') !== $user) {
            http_response_code(503); exit;
        }
        $now = time();
        $_SESSION['totp_csrf'] ??= bin2hex(random_bytes(32));
        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && isset($_POST['totp_code'])) {
            if (!hash_equals($_SESSION['totp_csrf'], (string)($_POST['totp_csrf'] ?? ''))) {
                http_response_code(403); exit;
            }
            if (($data['retry_at'] ?? 0) > $now) { http_response_code(429); exit; }
            $step = RewardsTotp::match($secret, (string)$_POST['totp_code'], $now, $data['step'] ?? -1);
            $data['retry_at'] = $now + 3;
            if ($step !== null) $data['step'] = $step;
            $json = json_encode($data, JSON_THROW_ON_ERROR);
            rewind($state);
            if (fwrite($state, $json) !== strlen($json) || !ftruncate($state, strlen($json)) || !fflush($state)) {
                http_response_code(503); exit;
            }
            if ($step !== null) {
                session_regenerate_id(true);
                $_SESSION['totp_user'] = $user;
                $_SESSION['totp_until'] = $now + 3600;
                header('Location: '. strtok($_SERVER['REQUEST_URI'], '?'), true, 303);
                exit;
            }
            $invalid = true;
        }
    } finally {
        fclose($state);
    }
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    http_response_code(403);
    echo '<meta charset="utf-8"><title>Припять — проверка входа</title>';
    if (!empty($invalid)) echo '<p>Код не принят. Дождитесь нового кода и попробуйте снова.</p>';
    echo '<form method="post"><label>Код Google Authenticator <input name="totp_code" inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code" required></label>';
    echo '<input type="hidden" name="totp_csrf" value="'.$_SESSION['totp_csrf'].'"><button>Войти</button></form>';
    exit;
}
