/**
 * Test: батч 22.09.2026 (по прямому указанию — "Показатель силы растёт только за прокачку
 * игроками. То есть, зашли к тебе на локацию, нажали качнуть - прибавилась на 1") — новая
 * фича "качнуть": +1 к "Силе" (str_xp_total) ЦЕЛИ (не себе), клик по кнопке "позвать в
 * качалку" на визитке друга. Кнопка уже существовала как визуальная заглушка
 * (player_profile.js, action gym_invite) — реализована серверная логика (zaruba.php.pump())
 * и клиентский вызов. Требует миграции server/migrate24.php (новое служебное поле
 * gym_pump_cooldowns, НЕ в whitelist users.php).
 *
 * Run: node tests/zaruba-gym-pump.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const zarubaPhp   = readSrc('server/core/controllers/zaruba.php');
const usersPhp    = readSrc('server/core/controllers/users.php');
const migrateSrc  = readSrc('server/migrate24.php');
const profileJs   = readSrc('_client/src/game/shell/overlays/player_profile.js');

console.log('\nTest 1: zaruba.php — permit pump добавлен');
{
    assert(/\$this->permits = \['fight', 'pump'\];/.test(zarubaPhp), "'pump' добавлен в permits (иначе роутер отклонит метод)");
    assert(/function pump\(\)\{/.test(zarubaPhp), 'метод pump() существует');
}

console.log('\nTest 2: pump() — валидация, кулдаун 24ч на пару (визитёр, цель), +1 цели');
{
    const start = zarubaPhp.indexOf('function pump(){');
    const end   = zarubaPhp.indexOf('\n        }', zarubaPhp.lastIndexOf('$this->ops->ok(['));
    const body  = zarubaPhp.slice(start, end);

    assert(/if\(\$targetId <= 0\) return \$this->ops->fail\(54\);/.test(body), 'невалидный target_id → код 54');
    assert(/if\(\$targetId === intval\(\$this->registry\['uid'\]\)\) return \$this->ops->fail\(90\);/.test(body),
        'нельзя качнуть самого себя → код 90');
    assert(/\$cooldowns\s*= \$this->ops->j\(\$user, 'gym_pump_cooldowns', \[\]\);/.test(body),
        'читает кулдауны из НОВОГО служебного поля gym_pump_cooldowns (отдельного от zaruba_cooldowns)');
    assert(/\$cooldownMs\s*= 24 \* 3600 \* 1000;/.test(body), 'кулдаун 24 часа на пару (визитёр, цель)');
    assert(/if\(\$lastPumpMs > 0 && \(\$nowMs - \$lastPumpMs\) < \$cooldownMs\) return \$this->ops->fail\(92\);/.test(body),
        'повторный клик на ту же цель раньше 24ч отклоняется кодом 92');
    assert(/if\(isset\(\$targetRow\['error'\]\) && \$targetRow\['error'\]\) return \$this->ops->fail\(91\);/.test(body),
        'несуществующая цель → код 91');

    assert(/\$newStrength = intval\(\$targetRow\['str_xp_total'\] \?\? 0\) \+ 1;/.test(body), 'сила цели растёт ровно на +1');
    assert(/\$this->registry\['udb'\]->saveData\(\$this->registry\['utb'\], \['id' => \$targetId, 'str_xp_total' => \$newStrength\]\);/.test(body),
        'цель обновляется напрямую через udb (может быть офлайн) — не через self-only Gameops::saveUser');
    assert(/\$cooldowns\[\$targetId\] = \$nowMs;/.test(body), 'кулдаун записывается по конкретному target_id');
    assert(/\$user\['gym_pump_cooldowns'\] = json_encode\(\$cooldowns\);/.test(body), 'кулдаун сохраняется в СВОЙ аккаунт (визитёра), не в аккаунт цели');
}

console.log('\nTest 3: gym_pump_cooldowns НЕ в client-writable whitelist users.php, и очищается при полном сбросе (resetSession)');
{
    const allowedMatch = usersPhp.match(/\$allowed = \[([\s\S]*?)\];/);
    assert(!!allowedMatch, '$allowed массив найден');
    assert(!/'gym_pump_cooldowns'/.test(allowedMatch ? allowedMatch[1] : ''),
        "'gym_pump_cooldowns' сознательно НЕ в whitelist — клиент не может обнулить кулдаун через users.save");
    assert(/'gym_pump_cooldowns'\s*=> null,/.test(usersPhp),
        'gym_pump_cooldowns очищается в users.resetSession() — полный сброс аккаунта не оставляет зависший кулдаун (Правило CLAUDE.md)');
}

console.log('\nTest 4: server/migrate24.php — добавляет колонку gym_pump_cooldowns, идемпотентно (SHOW COLUMNS перед ALTER)');
{
    assert(/\$col = 'gym_pump_cooldowns';/.test(migrateSrc), 'нацелен на нужную колонку');
    assert(/\$def = "TEXT DEFAULT NULL";/.test(migrateSrc), 'тип TEXT — тот же, что у аналогичных JSON-полей (zaruba_cooldowns и т.п.)');
    assert(/SHOW COLUMNS FROM `\{\$registry\['utb'\]\}` LIKE '\$col'/.test(migrateSrc), 'проверяет наличие колонки перед ALTER — повторный запуск безопасен');
    assert(/ALTER TABLE `\{\$registry\['utb'\]\}` ADD COLUMN `\$col` \$def/.test(migrateSrc), 'реальный ALTER TABLE ADD COLUMN');
    assert(/if\(!isset\(\$_GET\['key'\]\) \|\| \$_GET\['key'\] !== 'stalker_migrate24_2026'\)\{/.test(migrateSrc),
        'защищён уникальным ключом (тот же приём, что предыдущие миграции)');
}

console.log('\nTest 5: player_profile.js — кнопка "позвать в качалку" реально вызывает zaruba.pump, больше не заглушка');
{
    const buttonsStart = profileJs.indexOf('proto._buildFriendActionButtons');
    const buttonsEnd   = profileJs.indexOf('\n    };', buttonsStart);
    const buttonsBody  = profileJs.slice(buttonsStart, buttonsEnd);
    assert(/if\(b\.action === 'gym_invite'\)\{ this\._startGymPump\(profile\); return; \}/.test(buttonsBody),
        'клик по gym_invite вызывает новый _startGymPump(), больше не только console.log-заглушку');

    const start = profileJs.indexOf('proto._startGymPump = function');
    const end   = profileJs.indexOf('\n    };', start);
    const body  = profileJs.slice(start, end);
    assert(/TS\.php\('zaruba\.pump', \{target_id: profile\.id\}/.test(body), 'отправляет target_id профиля, на который зашли в гости');
    assert(/if\(this\._profileStrTxt\) this\._profileStrTxt\.text = String\(res\.target_strength\);/.test(body),
        'обновляет отображаемую Силу на визитке сразу после успеха, без повторного открытия профиля');
    assert(/err && err\.code === 92/.test(body), 'обрабатывает код 92 (кулдаун) адресным сообщением "раз в 24 часа"');
}

console.log('\nTest 6: player_profile.js — visitCard сохраняет ссылку this._profileStrTxt для последующего live-обновления');
{
    const start = profileJs.indexOf('proto._buildVisitCard = function');
    const end   = profileJs.indexOf('\n    };', start);
    const body  = profileJs.slice(start, end);
    assert(/this\._profileStrTxt = strTxt;/.test(body), 'ссылка на текстовый узел Силы сохраняется на this — иначе _startGymPump не сможет её обновить');
}

console.log('\nTest 7: 28.09.2026 (по прямому указанию — РЕВЕРС правки 25.09.2026: "сила растёт у обоих, должно расти только у того, кого позвал качаться, у себя — только когда меня позовут") — визитёр СВОЮ силу не получает');
{
    const start = zarubaPhp.indexOf('function pump(){');
    const end   = zarubaPhp.indexOf('\n        }', zarubaPhp.lastIndexOf('$this->ops->ok(['));
    const body  = zarubaPhp.slice(start, end);

    assert(!/\$myNewStrength\s*=\s*\$this->ops->i\(\$user, 'str_xp_total', 0\) \+ 1;/.test(body),
        'визитёр БОЛЬШЕ НЕ получает +1 к своей str_xp_total за качание чужой цели');
    assert(!/\$user\['str_xp_total'\]\s*=/.test(body), 'своя str_xp_total ($user) методом pump() не переписывается вообще');
    // 04.10.2026: patch расширен — gym_invites_sent (счётчик достижений cat 'gym', растёт у
    // инициатора, см. achievements-pvp-gym-friends-semantics-and-svod-live-refresh.test.js) —
    // 'str_xp_total' по-прежнему НЕ включена (визитёр не видит рост своей Силы от чужого качания).
    assert(/patchCurrencies\(\$user, \['gym_pump_cooldowns', 'gym_invites_sent'\]\);/.test(body),
        "patch содержит gym_pump_cooldowns и gym_invites_sent — 'str_xp_total' по-прежнему исключена");
    assert(/'my_strength'\s*=>\s*\$this->ops->i\(\$user, 'str_xp_total', 0\),/.test(body),
        "поле 'my_strength' в ответе отражает ТЕКУЩУЮ (неизменную) силу визитёра, не increment");
}

console.log('\nTest 8: player_profile.js — применяет res.patch (раньше патч от pump() вообще не применялся клиентом)');
{
    const start = profileJs.indexOf('proto._startGymPump = function');
    const end   = profileJs.indexOf('\n    };', start);
    const body  = profileJs.slice(start, end);
    assert(/if\(res\.patch\) applyPatch\(res\.patch\);/.test(body),
        'applyPatch(res.patch) вызывается — иначе новая own str_xp_total/gym_pump_cooldowns осядет в БД, но не долетит в udata до перезахода');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
