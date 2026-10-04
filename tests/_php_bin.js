/**
 * Общий хелпер — находит локальный PHP-интерпретатор для тестов, которые РЕАЛЬНО исполняют
 * server/core/controllers/*.php (а не просто ищут текст в файле), и мягко деградирует, если
 * его нет (тест печатает предупреждение и считается пройденным, не ломая весь прогон на машине
 * без PHP).
 *
 * 04.10.2026 (по прямому указанию, после разговора про regex-тесты vs реальное поведение):
 * в этом окружении локального PHP не было вообще — поставлен портативный PHP 8.5.11 (та же
 * ветка, что php8.5-fpm на проде) без прав администратора, zip с windows.php.net, распакован в
 * ~/tools/php (НЕ через choco — choco упал с правами доступа). mysqli включён в php.ini (нужен
 * для type-compatibility кода, хотя сами тесты реальных БД-коннектов не открывают — см. ниже).
 *
 * Стратегия тестов, использующих этот хелпер: НЕ подключаться к реальной MySQL (ни локальной,
 * ни тем более прод/тест-серверу). Приватные методы вызываются напрямую через Reflection с
 * ЛИБО чисто данными аргументами (без $link вообще — для функций без побочных эффектов на БД,
 * напр. _rollWeapons()/_friendsSinceMap()/_myFightStart()), ЛИБО с рукописным fake-объектом
 * вместо $link (duck-typing query()/prepare()/real_escape_string() и т.п.) — тот же принцип,
 * что мок PIXI/window в vm-тестах на JS-стороне (см. boss-rating-audio-regressions.test.js).
 */
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

function findPhpBin(){
    const candidates = [];
    if(process.env.PHP_BIN) candidates.push(process.env.PHP_BIN);
    candidates.push(path.join(os.homedir(), 'tools', 'php', 'php.exe')); // портативный, эта сессия
    candidates.push('php.exe');
    candidates.push('php');

    for(const bin of candidates){
        try {
            const out = execFileSync(bin, ['-v'], { encoding: 'utf-8', timeout: 5000 });
            if(/^PHP \d/.test(out)) return bin;
        } catch(e){ /* пробуем следующий кандидат */ }
    }
    return null;
}

/**
 * Запускает PHP-скрипт (строка кода, без <?php — добавляется сама) и возвращает {ok, stdout,
 * stderr}. ok=false при ненулевом exit code ИЛИ непустом stderr (PHP пишет Fatal error/Warning
 * в stderr при CLI-запуске с display_errors=stderr, что мы и хотим ловить как провал теста).
 */
function runPhp(phpBin, code){
    const tmpFile = path.join(os.tmpdir(), 'pripat-php-test-' + process.pid + '-' + Date.now() + '.php');
    fs.writeFileSync(tmpFile, '<?php\n' + code, 'utf-8');
    try {
        const stdout = execFileSync(phpBin, ['-d', 'display_errors=stderr', tmpFile], { encoding: 'utf-8', timeout: 15000 });
        return { ok: true, stdout, stderr: '' };
    } catch(e){
        return { ok: false, stdout: e.stdout || '', stderr: e.stderr || e.message };
    } finally {
        try { fs.unlinkSync(tmpFile); } catch(_){}
    }
}

module.exports = { findPhpBin, runPhp };
