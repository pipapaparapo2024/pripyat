<?php
require_once __DIR__.'/rewardstotp.php';
require_once __DIR__.'/rewardsauth.php';

function requireRewardsTotp(): void {
    header('Cache-Control: no-store, private');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');
    $authMode = (bool)getenv('PRIPYAT_REWARDS_AUTH_CONFIG');
    $ticket = $authMode ? requireRewardsLogin() : null;
    $path = getenv('PRIPYAT_REWARDS_TOTP_STATE');
    if (!$path || !is_file($path)) { http_response_code(503); exit('Двухфакторная защита не настроена.'); }
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_name('pripyat_rewards_test');
        session_start(['cookie_httponly'=>true,'cookie_secure'=>true,'cookie_samesite'=>'Strict',
            'cookie_path'=>'/rewards-admin/','use_strict_mode'=>true]);
    }
    $user = $_SERVER['REMOTE_USER'] ?? '';
    if ($user === '') { http_response_code(403); exit; }
    $state = is_file($path) ? fopen($path, 'r+') : false;
    if (!$state || !flock($state, LOCK_EX)) { http_response_code(503); exit; }
    try {
        $data = json_decode(stream_get_contents($state), true, 16, JSON_THROW_ON_ERROR);
        $secret = hex2bin($data['secret'] ?? '');
        if ($secret === false || strlen($secret) < 20 || ($data['user'] ?? '') !== $user) {
            http_response_code(503); exit;
        }
        if ($authMode && ($data['enabled'] ?? false) === true && hash_equals(hash('sha256',$data['secret']), (string)($ticket['totp_generation'] ?? ''))) return;
        if (!$authMode && ($data['enabled'] ?? false) === true && ($_SESSION['totp_user'] ?? '') === $user && hash_equals((string)($_SESSION['totp_generation'] ?? ''), hash('sha256', $data['secret'])) && ($_SESSION['totp_until'] ?? 0) > time()) return;
        $now = time();
        $_SESSION['totp_csrf'] ??= bin2hex(random_bytes(32));
        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && isset($_POST['totp_code'])) {
            if (!hash_equals($_SESSION['totp_csrf'], (string)($_POST['totp_csrf'] ?? ''))) {
                http_response_code(403); exit;
            }
            if (($data['retry_at'] ?? 0) > $now) { http_response_code(429); exit; }
            $step = RewardsTotp::match($secret, (string)$_POST['totp_code'], $now, $data['step'] ?? -1);
            $data['failures'] = $step === null ? min(10, (int)($data['failures'] ?? 0) + 1) : 0;
            $data['retry_at'] = $now + ($step === null ? min(300, 3 * (2 ** $data['failures'])) : 3);
            if ($step !== null) { $data['step'] = $step; $data['enabled'] = true; }
            $json = json_encode($data, JSON_THROW_ON_ERROR);
            rewind($state);
            if (fwrite($state, $json) !== strlen($json) || !ftruncate($state, strlen($json)) || !fflush($state)) {
                http_response_code(503); exit;
            }
            if ($step !== null) {
                session_regenerate_id(true);
                $_SESSION['totp_user'] = $user;
                $_SESSION['totp_generation'] = hash('sha256', $data['secret']);
                $_SESSION['totp_until'] = $now + 3600;
                if ($authMode) { $ticket['totp_generation']=hash('sha256',$data['secret']); RewardsAuth::issue($ticket,RewardsAuth::config()); }
                header('Location: '. strtok($_SERVER['REQUEST_URI'], '?'), true, 303);
                exit;
            }
            $invalid = true;
        }
    } catch (Throwable $error) {
        http_response_code(503); exit('Проверка входа временно недоступна.');
    } finally {
        fclose($state);
    }
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    http_response_code(403);
    echo '<meta charset="utf-8"><title>Припять — проверка входа</title>';
    if (($data['enabled'] ?? false) !== true || $authMode) {
        $secretText = RewardsTotp::base32($secret);
        echo '<h1>Google Authenticator</h1><p>Отсканируйте QR-код в Google Authenticator.</p>';
        $uri = 'otpauth://totp/Pripyat:'.rawurlencode($user).'?secret='.$secretText.'&issuer=Pripyat&algorithm=SHA1&digits=6&period=30';
        echo '<div id="totp-qr" data-uri="'.htmlspecialchars($uri, ENT_QUOTES, 'UTF-8').'" aria-label="QR-код привязки"></div>';
        echo '<script src="/rewards-admin/qrcode-generator-2.0.4.js"></script><script>const target=document.getElementById("totp-qr");const qr=qrcode(0,"M");qr.addData(target.dataset.uri);qr.make();const image=document.createElement("img");image.src=qr.createDataURL(6,24);image.alt="QR-код Google Authenticator";target.append(image);target.removeAttribute("data-uri");</script>';
        echo '<details><summary>Ввести ключ вручную</summary><code>'.htmlspecialchars($secretText, ENT_QUOTES, 'UTF-8').'</code></details>';
        echo '<p>После добавления введите текущий шестизначный код для подтверждения.</p>';
    }
    if (!empty($invalid)) echo '<p>Код не принят. Дождитесь нового кода и попробуйте снова.</p>';
    $prompt = ($data['enabled'] ?? false) === true ? 'Код Google Authenticator' : 'Код для подтверждения привязки';
    echo '<form method="post"><label>'.htmlspecialchars($prompt, ENT_QUOTES, 'UTF-8').' <input name="totp_code" inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code" required></label>';
    echo '<input type="hidden" name="totp_csrf" value="'.$_SESSION['totp_csrf'].'"><button>Войти</button></form>';
    exit;
}
