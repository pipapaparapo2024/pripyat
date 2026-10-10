/**
 * Регрессия 09.10.2026: claimKill() держал SELECT ... FOR UPDATE для шмоток и затем вызывал
 * _finalizeSkillSession(), который во втором mysqli-соединении снова делал FOR UPDATE той же
 * строки users. MySQL ждал собственный lock и завершал победу ошибкой Lock wait timeout;
 * босс оставался с HP=0 и активным bossStartMs. Финализация скиллов обязана идти ДО shmot-lock.
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'server', 'core', 'controllers', 'bosses.php'), 'utf8');
const claimStart = src.indexOf('function claimKill(){');
const claim = src.slice(claimStart);
const skills = claim.indexOf('$skillsResult = $this->_finalizeSkillSession($user);');
const shmot = claim.indexOf('$shmotLockLink = $this->_rawLink();');

if(skills < 0 || shmot < 0 || skills > shmot){
    console.error('❌ _finalizeSkillSession() должен выполниться до shmotLockLink, иначе claimKill сам себя блокирует');
    process.exit(1);
}
console.log('✅ Финализация скиллов выполняется до блокировки дропа шмоток; self-lock claimKill исключён');
