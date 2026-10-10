<?php
// Исполняемый PHP-регресс для инцидента 09.10.2026: HP босса уже стал 0, но claimKill()
// упал с InnoDB Lock wait timeout. Причина: внешний shmot-lock удерживал строку users,
// затем _finalizeSkillSession() из другого mysqli-соединения пытался залочить ту же строку.
// Это не эмулятор MySQL: он проверяет обязательный контракт рабочего PHP-кода, который
// исключает этот класс self-lock до обращения к базе.

$source = file_get_contents(__DIR__ . '/../../server/core/controllers/bosses.php');
if ($source === false) {
    echo "FAIL: не удалось прочитать bosses.php\n";
    exit(1);
}

$start = strpos($source, 'function claimKill(){');
if ($start === false) {
    echo "FAIL: claimKill() не найден\n";
    exit(1);
}
$claimKill = substr($source, $start);
$skills = strpos($claimKill, '$skillsResult = $this->_finalizeSkillSession($user);');
$shmot = strpos($claimKill, '$shmotLockLink = $this->_rawLink();');

echo "=== Test 1: навыки завершаются до отдельной транзакции дропа ===\n";
echo ($skills !== false && $shmot !== false && $skills < $shmot ? 'PASS' : 'FAIL')
    . ": _finalizeSkillSession() расположен раньше shmotLockLink и не ждёт собственный SELECT ... FOR UPDATE\n";

echo "=== Test 2: после захвата shmot-lock нет второго запуска skills-финализации ===\n";
$afterLock = $shmot === false ? '' : substr($claimKill, $shmot);
$secondSkills = strpos($afterLock, '$skillsResult = $this->_finalizeSkillSession($user);');
echo ($secondSkills === false ? 'PASS' : 'FAIL')
    . ": shmot-lock не охватывает отдельную skills-транзакцию\n";

echo "=== Test 3: результат финализации по-прежнему переносится в снимок пользователя ===\n";
$copyResult = strpos($claimKill, 'if(!$skillsResult[\'locked\']) $user[\'skills_levels\'] = $skillsResult[\'json\'];');
echo ($skills !== false && $copyResult !== false && $skills < $copyResult && $copyResult < $shmot ? 'PASS' : 'FAIL')
    . ": успешная финализация skills_levels сохраняется до общего saveUser()\n";
