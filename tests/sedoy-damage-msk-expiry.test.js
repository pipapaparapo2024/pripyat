const fs = require('fs');
const path = require('path');
const assert = require('assert');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const habar = read('server/core/controllers/habar.php');
const bosses = read('server/core/controllers/bosses.php');
const users = read('server/core/controllers/users.php');
const client = read('_client/src/game/shell/overlays/bosses_fight.js');

const collect = habar.slice(habar.indexOf('function collectDay('), habar.indexOf('function report('));
assert(collect.includes("$this->ops->mskDailyDate(intval($now / 1000))"),
    'сбор сравнивает пул с текущей датой МСК');
assert(collect.includes("$this->ops->mskDailyDate(intval($lastTs / 1000))"),
    'дата пула берётся из времени последнего сбора');
assert(/if\(\$sedoyPoolDay !== \$todayMsk\)\s*\{\s*\$lockedUser\['sedoy_dmg_total'\] = '0';\s*\$lockedUser\['sedoy_dmg_left'\] = '0';/.test(collect),
    'при новом сборе после смены МСК-дня старый пул очищается под блокировкой строки');
assert(collect.includes("$patchKeys[] = 'sedoy_dmg_total'; $patchKeys[] = 'sedoy_dmg_left';"),
    'ответ нового сбора обновляет локальные значения клиента нулями');
assert(collect.indexOf('$patchKeys = [];') < collect.indexOf("$lockedUser['sedoy_dmg_total'] = '0';"),
    'список патча инициализирован до добавления полей сброшенного пула');
assert(collect.indexOf("$lockedUser['sedoy_dmg_left'] = '0';") < collect.indexOf("$type === 'damage'"),
    'старый пул сбрасывается до начисления награды нового дня');

const useSedoy = bosses.slice(bosses.indexOf('function useSedoy(){'), bosses.indexOf('// ── SERVER-AUTHORITATIVE НАГРАДА ЗА УБИЙСТВО'));
assert(useSedoy.includes("$this->ops->mskDailyDate(intval($now / 1000))"),
    'использование урона проверяет текущий день по МСК');
assert(useSedoy.includes("$this->ops->mskDailyDate(intval($lastHabarCollectMs / 1000))"),
    'использование урона проверяет день последнего сбора');
assert(/UPDATE `\{\$this->registry\['utb'\]\}` SET `sedoy_dmg_total`='0',`sedoy_dmg_left`='0' WHERE `id`="\.\$uid[\s\S]*?AND `habar_last_collect_ts`="\.\$lastHabarCollectMs/.test(useSedoy),
    'просроченные серверные поля обнуляются условным UPDATE, защищённым от параллельного свежего сбора');
assert(useSedoy.indexOf('$sedoyPoolDay !== $todayMsk') < useSedoy.indexOf("$this->ops->i($user, 'sedoy_dmg_left')"),
    'устаревший остаток отвергается до расчёта урона');
assert(useSedoy.includes("return $this->ops->fail(69); // остаток сгорел в 00:00 МСК"),
    'для сгоревшего вчерашнего пула используется отдельный ответ сервера');

assert(client.includes("if(err && err.code === 69)") && client.includes("udata['sedoy_dmg_left'] = '0';"),
    'клиент очищает отображаемый остаток после серверного отказа для просроченного урона');
assert(client.includes("69: 'Вчерашний остаток урона Седого сгорел в 00:00 по Москве'"),
    'игрок получает понятное сообщение именно об истечении пула');

const usersGet = users.slice(users.indexOf('function get(){'), users.indexOf('function getProfile(){'));
assert(usersGet.includes('$this->_expireStaleSedoyPool($user);'),
    'собственный профиль при загрузке сразу очищает вчерашний отображаемый остаток');
assert(usersGet.indexOf('$this->_expireStaleSedoyPool($user);') < usersGet.indexOf("$this->registry['tools']->output(array('udata'=>$user"),
    'обновлённые значения передаются клиенту до ответа users.get');
const expirePool = users.slice(users.indexOf('private function _expireStaleSedoyPool('), users.indexOf('private function _defaultResetUdata()'));
assert(expirePool.includes("SET `sedoy_dmg_total`='0',`sedoy_dmg_left`='0'"),
    'загрузка профиля обнуляет сохранённый устаревший пул');
assert(expirePool.includes('AND `habar_last_collect_ts`=$lastCollectMs')
    && expirePool.includes('AND `sedoy_dmg_total`=$oldTotal AND `sedoy_dmg_left`=$oldLeft'),
    'условная запись не удалит новый пул или урон, изменившийся конкурентным запросом');
assert(expirePool.includes("if($updated && $link->affected_rows === 0)")
    && expirePool.includes('SELECT `habar_last_collect_ts`,`sedoy_dmg_total`,`sedoy_dmg_left`'),
    'после проигранной гонки профиль перечитывает значения и сохраняет свежую награду');

const mskDate = (utcMs) => new Date(utcMs + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
const beforeMidnightMsk = Date.parse('2026-11-10T20:59:59.999Z');
const atMidnightMsk = Date.parse('2026-11-10T21:00:00.000Z');
assert.strictEqual(mskDate(beforeMidnightMsk), '2026-11-10', 'перед полуночью ещё действует дата 10 ноября МСК');
assert.strictEqual(mskDate(atMidnightMsk), '2026-11-11', 'ровно в 00:00 МСК начинается новый день');

// Исполняем фактический helper users.get с поддельным SQL-соединением: старый пул очищается,
// а если между чтением и UPDATE уже выдан сегодняшний хабар, сервер возвращает свежие значения.
const {findPhpBin}=require('./_php_bin');
const {execFileSync}=require('node:child_process');
const php=findPhpBin();
if(php){
    const fixture=`
class Ops { function mskDailyDate($seconds){return gmdate('Y-m-d',intval($seconds)+3*3600);} }
class QueryResult { public $row; function __construct($row){$this->row=$row;} function fetch_assoc(){return $this->row;} }
class FakeLink { public $affected_rows=1,$queries=[],$fresh=null; function query($sql){$this->queries[]=$sql;return str_starts_with($sql,'SELECT ')?new QueryResult($this->fresh):true;} function close(){} }
class Fixture { public $ops,$registry=['uid'=>7,'utb'=>'users_test'],$link; function __construct($link){$this->ops=new Ops();$this->link=$link;} function _rawLink(){return $this->link;} function expire(&$user){$this->_expireStaleSedoyPool($user);} ${expirePool} }
$nowMs=intval(round(microtime(true)*1000));$yesterday=$nowMs-86400000;
$link=new FakeLink();$f=new Fixture($link);$user=['habar_last_collect_ts'=>$yesterday,'sedoy_dmg_total'=>'500000','sedoy_dmg_left'=>'100000'];$f->expire($user);$expired=[$user,$link->queries];
$link2=new FakeLink();$link2->affected_rows=0;$link2->fresh=['habar_last_collect_ts'=>$nowMs,'sedoy_dmg_total'=>'600000','sedoy_dmg_left'=>'600000'];$f2=new Fixture($link2);$user2=['habar_last_collect_ts'=>$yesterday,'sedoy_dmg_total'=>'500000','sedoy_dmg_left'=>'100000'];$f2->expire($user2);
$link3=new FakeLink();$f3=new Fixture($link3);$user3=['habar_last_collect_ts'=>$nowMs,'sedoy_dmg_total'=>'600000','sedoy_dmg_left'=>'400000'];$f3->expire($user3);
echo json_encode([$expired,$user2,$link2->queries,$user3,$link3->queries]);`;
    const [expired,user2,queries2,user3,queries3]=JSON.parse(execFileSync(php,['-r',fixture],{encoding:'utf8'}));
    assert.equal(expired[0].sedoy_dmg_total,'0');
    assert.equal(expired[0].sedoy_dmg_left,'0');
    assert.match(expired[1][0],/AND `habar_last_collect_ts`=/);
    assert.equal(user2.sedoy_dmg_total,'600000','fresh daily award survives an UPDATE race');
    assert.equal(user2.sedoy_dmg_left,'600000');
    assert.equal(queries2.length,2,'lost update race re-reads database values');
    assert.equal(user3.sedoy_dmg_left,'400000','same-day remainder stays intact');
    assert.equal(queries3.length,0,'same-day profile read performs no cleanup query');
}else console.log('Пропуск PHP-поведенческой фикстуры: PHP CLI не найден');

console.log('ОК: урон Седого сгорает в 00:00 МСК, профиль очищает старое значение, а конкурентная новая награда сохраняется.');
