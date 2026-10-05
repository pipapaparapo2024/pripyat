<?php
	Class Bosses {
        private $registry, $ops;

        // HP боссов по режимам [обычный, опасный, суровый, соло] — должно совпадать с BOSS_HP в _client/src/game/bosses.js
        private $BOSS_HP = [
            [1000,        3000,        10000,        1000],
            [10000,       30000,       60000,        10000],
            [50000,       150000,      300000,       50000],
            [100000,      300000,      600000,       100000],
            [500000,      1500000,     3000000,      500000],
            [2000000,     6000000,     12000000,     2000000],
            [3000000,     9000000,     18000000,     3000000],
            [30000000,    90000000,    180000000,    30000000],
        ];

        // Кулдаун бесплатного оружия (нож/цепь/бита) — должен совпадать с bosses.js.FREE_WPN_CD_MS.
        private $FREE_WPN_CD_MS = 21600000; // 6*60*60*1000

        // 28.09.2026 (по прямому указанию — "КД для всех трёх бесплатных видов оружия должен
        // быть общим: ударил любым — все три уходят на откат вместе, ускорение за 20р снимает
        // кулдаун сразу у всех троих"): раньше freeWpnCdMs[weaponId] хранил НЕЗАВИСИМЫЙ
        // таймстамп на каждое из трёх бесплатных оружий — игрок мог ударить ножом, затем сразу
        // цепью, затем битой, получая по факту 3 бесплатных удара подряд вместо одного. Теперь
        // удар ЛЮБЫМ из трёх пишет $now во ВСЕ три ключа разом (см. attack()), а проверка КД
        // берёт МАКСИМУМ среди всех трёх ключей (а не только $weaponId) — так поведение
        // корректно и для игроков, у кого в БД ещё лежат старые асимметричные значения.
        private $FREE_WPN_IDS = [0, 1, 2];

        // Окно жизни боя с момента bossStartMs — 9ч (FIGHT_DURATION_MS на клиенте, bosses.js)
        // + максимум возможного бонуса скилла "Повелитель времени" (60 мин, skills.js.
        // getTimeBonus(), maxLvl 30 → floor(60*30/30)=60). Сервер щедрее клиентского таймера
        // ровно на этот бонус, т.к. сам бонус пока не перенесён на сервер (см. attack()).
        private $MAX_FIGHT_WINDOW_MS = 36000000; // 32400000 + 3600000

        // 26.09.2026: Покупка ключей за рубли — функция, которой пока нет в плане/дизайне игры.
        // Реализована правильно и безопасно на случай будущего включения, но заблокирована —
        // сервер отклоняет ЛЮБОЙ вызов независимо от того, что прислал клиент. Убрать одной
        // строкой, когда фича будет утверждена.
        // 29.09.2026 (по прямому указанию — новый попап покупки ключей с ассетами/ценами
        // Счастливчик 3р/Ястреб 6р/Меченный 18р): фича утверждена, разблокирована.
        private $BUY_KEY_LOCKED = false;

        public $permits;

        function __construct($registry){
            $this->registry = $registry;
            $this->ops = new Gameops($registry);

            // 23.09.2026 (по прямому указанию, ОТКАТ общего boss_instance обратно на личный
            // производный HP — см. большой комментарий над _derivedHp() ниже): в тот же день
            // сначала был введён общий boss_instance (migrate29.php), затем пользователь на
            // конкретных примерах уточнил, что имел в виду другую механику — HP личное, урон
            // друга (ВК, взаимного) засчитывается независимо от того, какого босса он бьёт,
            // если в момент его удара у МЕНЯ уже шёл бой. friendsDamage/rating вернулись.
            $this->permits = ['friendsDamage', 'rating', 'killers', 'recordKill', 'claimKill', 'startFight', 'attack', 'endFightSession', 'useSedoy', 'rushFreeWeapon', 'buyKey'];
        }

        private function _catalog(){
            return $this->ops->catalog('bosses_config');
        }

        // Та же таблица бонусов банды, что zone.php._gangBonus() — дублирована здесь намеренно
        // (Bosses и Zone — разные контроллеры, каждый решает свою задачу изолированно; см.
        // вопрос про вынос в Gameops в итоговом сообщении).
        private function _gangBonus($user, $key){
            $catalog = $this->_catalog();
            $gangId = $this->ops->i($user, 'gang_id', -1);
            return isset($catalog['gang_bonus'][strval($gangId)][$key]) ? $catalog['gang_bonus'][strval($gangId)][$key] : 0;
        }

        // Отдельное прямое подключение к БД — по тому же паттерну, что event.php (см. _getSettings
        // там): boss_last_kill — глобальная таблица (не привязана к конкретному игроку через udb/utb),
        // поэтому обычный getData/saveData (всегда работающий с users по id текущего игрока) не подходит.
        private function _rawLink(){
            $link = new mysqli($this->registry['server'], $this->registry['user'], $this->registry['pass'], $this->registry['db'], 3306);
            if($link->connect_error) return null;
            $link->set_charset('utf8mb4');
            return $link;
        }

        // Та же проверка "локация зачищена", что bosses.js._isLocCleared() на клиенте —
        // читаем udata['zone'] напрямую (тот же формат, что пишет zone.php._applyCaptureIfFull).
        private function _isLocCleared($user, $locIdx){
            if($locIdx < 0) return true;
            $zoneData = $this->ops->j($user, 'zone', []);
            return intval($zoneData[$locIdx]['cleared'] ?? 0) >= 1;
        }

        private function _decodeBossesData($raw){
            if(is_array($raw)) return $raw;
            if(is_string($raw) && $raw !== '') return json_decode($raw, true);
            return null;
        }

        // 28.09.2026 (по прямому указанию — "лимит на боссов должен сбрасываться в 12 по МСК,
        // вся игра должна ориентироваться на московское время"): дневной лимит убийств теперь
        // использует общую $this->ops->mskDailyDate() (server/core/models/gameops.php) — та же
        // точка, что и poker.php/blackjack.php/tasks.php (единая формула на весь проект,
        // не своя копия в каждом контроллере).

        // Общий (shared) кулдаун бесплатного оружия — см. комментарий у $FREE_WPN_IDS выше.
        // Берёт МАКСИМУМ таймстампа среди всех трёх бесплатных слотов, а не $cdMap[$weaponId] —
        // так последний удар ЛЮБЫМ бесплатным оружием блокирует ВСЕ три.
        private function _freeWpnSharedLastUse($cdMap){
            $lastUse = 0;
            foreach($this->FREE_WPN_IDS as $fw) $lastUse = max($lastUse, intval($cdMap[$fw] ?? 0));
            return $lastUse;
        }

        // ── ЛИЧНЫЙ ПРОИЗВОДНЫЙ HP + ПОМОЩЬ ДРУЗЕЙ (23.09.2026, откат общего boss_instance) ──
        //
        // Утром 23.09.2026 был введён общий boss_instance (одна строка HP на всех игроков,
        // зашедших на тот же boss_id+diff_idx, миграция server/migrate29.php). В ходе разбора
        // свежего бага пользователь на конкретных примерах уточнил, что имел в виду другую,
        // уже существовавшую в проекте механику: HP — ПРОИЗВОДНОЕ значение, личное для каждого
        // игрока: `maxHp - мой урон с начала МОЕГО боя - урон моих друзей (взаимных, ВК) с
        // того же момента`. Урон друга засчитывается НЕЗАВИСИМО от того, какого босса и на
        // какой сложности он бьёт — важно только, что в момент его удара у МЕНЯ уже шёл бой
        // (направление важно: если я начал бой в 10:00, а друг ударил в 11:00 — мне засчитается;
        // если я ударил в 10:00, а друг начал бой только в 11:00 — ему НЕ засчитается). Соло
        // (diff_idx=3) исключено полностью — там нет ни рейтинга, ни помощи.
        //
        // boss_instances/boss_instance_claims (таблицы миграции 29) больше не читаются и не
        // пишутся — не дропаем (Правило №3, не трогать БД сверх миграций), просто не используем.
        // HP по-прежнему в конечном счёте определяется `boss_damage_log` (миграция 23, не
        // менялась) — 24.09.2026 поверх добавлен кэш (см. "КЭШ HP + КУРСОР" ниже), чтобы не
        // пересчитывать SUM() с нуля на каждый запрос, семантика "личный производный HP" не
        // изменилась, изменилась только реализация (мутируемый кэш вместо чистого пересчёта).
        //
        // bossStartMs в bosses_data — снова НАСТОЯЩЕЕ серверное время старта (не instance id).

        // Момент старта МОЕЙ текущей попытки для (boss_id, diff_idx) — 0, если бой не активен.
        // Поддерживает старый плоский формат bossStartMs (миграция форматов, тот же приём, что
        // клиентский _loadFromUdata()).
        private function _myFightStart($data, $diffIdx, $bossId){
            if(empty($data['bossStartMs'])) return 0;
            $slots = $data['bossStartMs'];
            if(!is_array($slots[0] ?? null)) $slots = [$slots];
            return intval($slots[$diffIdx][$bossId] ?? 0);
        }

        // Мой собственный урон ПО ЭТОМУ боссу с момента $sinceMs — скоуплен по boss_id (иначе
        // урон по другому боссу той же сложности подмешивается в текущий бой, баг 23.09.2026,
        // см. boss-rating-hp-scoped-by-boss-id.test.js).
        // 29.09.2026: $excludeSedoy — если true, добавляет `AND is_sedoy=0` (см. миграция 35).
        // ТОЛЬКО _ratingTop() зовёт с true (рейтинг «УЧАСТНИКИ БОЯ» не должен показывать удары
        // Седого как реальный боевой вклад) — _syncFightSession() (производный HP) продолжает
        // звать с false (по умолчанию), иначе HP босса не сойдётся с тем, что реально снял Седой.
        private function _damageSumSince($link, $uid, $bossId, $sinceMs, $excludeSedoy = false){
            // 22.09.2026 (репорт "соло бой заходит, но урон не растёт" — фильтр раньше был
            // `diff_idx` IN (0,1,2), молча исключая соло из суммы СОБСТВЕННОГО урона): все 4
            // режима считаются равноправно — свой урон не завязан на "помощь друзей" (это
            // отдельный гейт diffIdx!==3 внутри _syncFightSession()), поэтому здесь ограничивать нечего.
            $sedoyFilter = $excludeSedoy ? ' AND `is_sedoy`=0' : '';
            $res = $link->query("SELECT SUM(`damage`) AS s FROM `boss_damage_log`
                WHERE `uid`=".intval($uid)." AND `boss_id`=".intval($bossId)." AND `diff_idx` IN (0,1,2,3) AND `time`>=".intval($sinceMs).$sedoyFilter);
            $row = $res ? $res->fetch_assoc() : null;
            return $row ? max(0, intval($row['s'])) : 0;
        }

        // Строит "(uid=X AND time>=x) OR (uid=Y AND time>=y) OR ..." из карты $friendsSince
        // (uid => effectiveSinceMs, см. _friendsSinceMap() выше) — общий кусок для всех четырёх
        // SQL-функций ниже, которые считают урон друзей ИНДИВИДУАЛЬНО по каждому uid (а не одним
        // общим $sinceMs на всех, как было до 29.09.2026 — см. коммент у _friendsSinceMap()).
        private function _friendsSinceConds($friendsSince){
            $conds = [];
            foreach($friendsSince as $uid => $since) $conds[] = '(`uid`='.intval($uid).' AND `time`>='.intval($since).')';
            return implode(' OR ', $conds);
        }

        // Суммарный урон друзей — СОЗНАТЕЛЬНО без фильтра по boss_id: друг помогает, даже если
        // бьёт своего (другого) босса — подтверждено пользователем, см. большой комментарий выше
        // и boss-rating-hp-scoped-by-boss-id.test.js.
        // 25.09.2026 (по прямому указанию — РЕВЕРС решения ниже, подтверждено явным ответом на
        // уточняющий вопрос "сделать асимметрично, как вы описали"): раньше здесь стоял фильтр
        // `diff_idx IN (0,1,2)` — друг НЕ помогал, если сам бил в Соло (симметрично тому, что
        // получатель-Соло помощь не принимает). Теперь — асимметрично: урон друга, дерущегося В
        // СОЛО, ВСЁ РАВНО доходит до меня, если Я сам не в Соло (это уже отдельно гарантирует
        // $friendIds=[] на месте вызова при diffIdx===3 у ПОЛУЧАТЕЛЯ, см. _syncFightSession()/
        // _applyFriendDamage() ниже — им не важно, в каком режиме бьёт САМ друг). Фильтр по
        // diff_idx ДРУГА убран из обоих запросов ниже.
        // 29.09.2026: принимает $friendsSince (карта uid=>effectiveSinceMs), не плоский список +
        // общий $sinceMs — см. _friendsSinceMap() выше, фикс retroactive-урона.
        // 30.09.2026 (по прямому указанию — репорт "урон седого отправляется друзьям, не должен"):
        // добавлен `AND is_sedoy=0`. Платный помощник Седой полностью изолирован от конкретного
        // игрока, который его купил — его удар по-прежнему снижает HP босса САМОМУ покупателю
        // (см. `_damageSumSince()` выше, вызывается с excludeSedoy=false для "mine"), но не должен
        // засчитываться как "помощь друга" всем его взаимным друзьям через эту функцию — иначе один
        // платный удар Седого бесплатно снижал HP боссов ВСЕМ друзьям игрока сразу.
        private function _friendsDamageSumSince($link, $friendsSince){
            if(empty($friendsSince)) return 0;
            $res = $link->query("SELECT SUM(`damage`) AS s FROM `boss_damage_log`
                WHERE (".$this->_friendsSinceConds($friendsSince).") AND `is_sedoy`=0");
            $row = $res ? $res->fetch_assoc() : null;
            return $row ? max(0, intval($row['s'])) : 0;
        }

        // То же самое, но по каждому другу отдельно (uid => сумма) — для рейтинга. Тоже без
        // фильтра по boss_id, тот же trade-off, что и выше.
        // 29.09.2026: используется ТОЛЬКО из _ratingTop() — всегда с $excludeSedoy=true (см.
        // комментарий у _damageSumSince()). Отдельного вызова с false нет — эта функция не
        // участвует в производном HP (тем занимаются _friendsDamageSumSince()/
        // _applyFriendDamage() выше, их не трогаем), поэтому параметр можно не делать опциональным,
        // но оставляем со значением по умолчанию false для симметрии с _damageSumSince().
        // 29.09.2026: принимает $friendsSince (карта), см. _friendsDamageSumSince() выше.
        private function _friendsDamagePerUserSince($link, $friendsSince, $excludeSedoy = false){
            if(empty($friendsSince)) return [];
            $sedoyFilter = $excludeSedoy ? ' AND `is_sedoy`=0' : '';
            $res = $link->query("SELECT `uid`, SUM(`damage`) AS dmg FROM `boss_damage_log`
                WHERE (".$this->_friendsSinceConds($friendsSince).")".$sedoyFilter."
                GROUP BY `uid`");
            $out = [];
            if($res) while($row = $res->fetch_assoc()) $out[intval($row['uid'])] = max(0, intval($row['dmg']));
            return $out;
        }

        // Суммарный урон Седого (только свой), реально вошедший в ЭТУ победу — для попапа
        // результата боя. 29.09.2026 (по прямому указанию — "седой умеет наносить урон боссам,
        // отображается в попапе результата, но не учитывается в топе по урону/скиллах/прочем"):
        // Седой уже был исключён из _ratingTop() (is_sedoy=0 фильтр выше), но нигде не
        // возвращался клиенту ОТДЕЛЬНО — попап просто не показывал источник недостающего урона,
        // из-за чего сумма участников боя не сходилась с HP босса (репорт игрока Flex, скрин
        // "0/1000 HP, участники 140+32+20"). Зеркалит скоуп _damageSumSince (по boss_id), но
        // берёт ТОЛЬКО is_sedoy=1 строки.
        // 30.09.2026 (по прямому указанию — "урон седого отправляется друзьям, не должен"):
        // раньше сюда ещё плюсовался _sedoyDamageFriendsSince() (удар Седого ДРУГА, попавший в
        // ЭТУ победу) — функция удалена вместе с этим слагаемым. С тех пор как
        // _friendsDamageSumSince()/_applyFriendDamage() перестали засчитывать чужой Седой в
        // производный HP (см. комментарии там же), урон Седого друга больше физически не влияет
        // на исход ЭТОГО боя — складывать его в этот попап значило бы показывать игроку вклад,
        // который на самом деле не убивал его босса.
        private function _sedoyDamageMineSince($link, $uid, $bossId, $sinceMs){
            $res = $link->query("SELECT SUM(`damage`) AS s FROM `boss_damage_log`
                WHERE `uid`=".intval($uid)." AND `boss_id`=".intval($bossId)." AND `diff_idx` IN (0,1,2,3) AND `time`>=".intval($sinceMs)." AND `is_sedoy`=1");
            $row = $res ? $res->fetch_assoc() : null;
            return $row ? max(0, intval($row['s'])) : 0;
        }

        // Взаимные друзья ВК — кандидат остаётся другом, только если МОЙ id есть в ЕГО
        // собственном списке friends (отдельный запрос на каждого кандидата), иначе игрок мог
        // бы добавить кого угодно без встречного добавления и получать чужой урон как "помощь".
        private function _friendIds($user){
            $myUid = abs(intval($this->registry['uid']));
            $ids = [];
            foreach(explode(',', $user['friends']) as $fid){
                $fid = abs(intval($fid));
                if($fid > 0 && $fid !== $myUid) $ids[] = $fid;
            }
            if(empty($ids)) return [];

            $rows = $this->registry['udb']->getData($this->registry['utb'], array('id', 'friends'), 'id IN('.implode(',', $ids).')', true);
            $mutual = [];
            if(is_array($rows)) foreach($rows as $row){
                $theirFriends = explode(',', strval($row['friends'] ?? ''));
                foreach($theirFriends as $tfid){ if(abs(intval($tfid)) === $myUid){ $mutual[] = intval($row['id']); break; } }
            }
            return $mutual;
        }

        // ── "С КАКОГО МОМЕНТА МЫ ДРУЗЬЯ" (29.09.2026, по прямому указанию — фикс
        // retroactive-урона друга) ──
        //
        // Баг: весь урон друга засчитывался с начала МОЕГО боя ($sinceMs ниже), а не с момента
        // реального возникновения дружбы — _friendIds() выше каждый раз живьём проверяет
        // ТЕКУЩИЙ список взаимных друзей ВК, без истории "когда именно". Репорт: игрок убил
        // босса, ЗАТЕМ принял заявку в друзья от другого игрока, у которого уже шёл свой бой —
        // старый удар первого задним числом подтягивался в производный HP/рейтинг второго,
        // хотя в момент удара они ещё не были друзьями.
        //
        // friends_since (миграция 38, server-only поле — НЕ в whitelist users.php, см. CLAUDE.md
        // "Server-only session-поля") — JSON-карта {uid: timestampMs} НА МОЕЙ строке: в момент
        // ПЕРВОГО обнаружения сервером взаимной дружбы с конкретным uid ставится метка "сейчас"
        // и больше никогда не двигается назад (повторное обнаружение уже известного uid — no-op).
        // Разрыв дружбы и повторное её возникновение метку не переустанавливают — этот проект
        // вообще не отслеживает разрывы дружбы, специально заводить это ради редкого края не
        // стали (см. итоговое сообщение в этой правке).
        //
        // Возвращает [uid => effectiveSinceMs] = max($sinceMs получателя, момент первого
        // обнаружения дружбы с этим uid) — готовую карту для SQL-функций ниже
        // (_friendsDamageSumSince/_friendsDamagePerUserSince/_applyFriendDamage), которые теперь
        // считают урон друга ИНДИВИДУАЛЬНО по каждому uid,
        // а не одним общим $sinceMs на всех. Мутирует $user['friends_since'] ТОЛЬКО если
        // появился хотя бы один новый uid — саму запись в БД делает как обычно вызывающий код
        // (он и так сохраняет $user после мутаций bosses_data/friends этой же функции).
        private function _friendsSinceMap(&$user, $friendIds, $sinceMs){
            if(empty($friendIds)) return [];
            $now = intval(round(microtime(true) * 1000));
            $stored = $this->ops->j($user, 'friends_since', []);
            if(!is_array($stored)) $stored = [];
            $changed = false;
            $out = [];
            foreach($friendIds as $fid){
                $fid = intval($fid);
                $key = strval($fid);
                if(!isset($stored[$key])){
                    $stored[$key] = $now;
                    $changed = true;
                }
                $out[$fid] = max(intval($sinceMs), intval($stored[$key]));
            }
            if($changed) $user['friends_since'] = json_encode($stored);
            return $out;
        }

        // ── КЭШ HP + КУРСОР УРОНА ДРУЗЕЙ (24.09.2026, по прямому указанию — перенять у
        // референсной игры на том же движке модель "мутируемый HP + курсор", вместо
        // пересчёта SUM() с нуля на КАЖДЫЙ запрос, каким был _derivedHp() до этого) ──
        //
        // boss_fight_session — НОВОЕ server-only поле (migrate30.php), тот же класс, что
        // skills_levels/dice_session/poker_session/... — НЕ в whitelist $allowed в users.php.
        // Критично: bosses_data УЖЕ в этом whitelist, поэтому кэш HP нельзя было положить
        // туда же — читер выставил бы curHp:0 одним users.save и "убивал" любого босса без
        // единого реального удара. boss_fight_session читает/пишет ТОЛЬКО
        // Gameops::loadUser()/saveUser() (полная строка, в обход whitelist).
        //
        // Структура: {bossId, diffIdx, hp, cursorId}. bossId/diffIdx фиксируют, к какой
        // попытке относится кэш (защита от рассинхрона с bossStartMs — если не совпадает,
        // считаем кэш чужим/устаревшим и пересобираем с нуля). hp — текущее HP, мутируется
        // напрямую (свой удар — прямое вычитание в attack(), урон друга — через
        // _applyFriendDamage() ниже). cursorId — id последней уже учтённой строки
        // boss_damage_log (аналог last_did в референсной игре) — не даёт посчитать один и
        // тот же удар друга дважды, и не требует пересуммировать всю историю на каждый чек.
        private function _loadFightSession($user){
            $raw = $this->ops->j($user, 'boss_fight_session', null);
            return is_array($raw) ? $raw : [];
        }

        // Отдаёт актуальный кэш для (diffIdx,bossId). Если кэша нет, он от другой попытки,
        // или бой только что стартовал "с нуля" — ОДИН РАЗ честно пересчитывает HP по логу
        // (та же формула, что раньше жила в _derivedHp()) и заводит курсор от текущего
        // максимального id в логе (всё, что было ДО этого момента, уже учтено в самом
        // пересчёте — дальше кэш живёт мутациями). $friendsSince уже отфильтрован вызывающим
        // кодом под diffIdx (для Соло всегда []) и содержит per-uid границу времени, см.
        // _friendsSinceMap() выше (29.09.2026 — фикс retroactive-урона друга).
        private function _syncFightSession($link, $uid, $session, $diffIdx, $bossId, $bossStartMs, $friendsSince){
            $matches = isset($session['bossId'], $session['diffIdx'], $session['hp'], $session['cursorId'])
                && intval($session['bossId']) === $bossId && intval($session['diffIdx']) === $diffIdx
                && intval($session['startMs'] ?? 0) === $bossStartMs;

            if(!$matches){
                $maxHp = $this->BOSS_HP[$bossId][$diffIdx];
                $mine = $this->_damageSumSince($link, $uid, $bossId, $bossStartMs);
                $friends = ($diffIdx !== 3 && !empty($friendsSince)) ? $this->_friendsDamageSumSince($link, $friendsSince) : 0;
                // 27.09.2026 (баг найден по прямому указанию, скриншот — "босс до этого стоял, но
                // хп фулл, урон есть": HP-бар показывал 1000/1000, а панель «РЕЙТИНГ УРОНА» этой
                // же карточки честно показывала суммарный урон друзей далеко за пределами maxHp).
                // Курсор раньше заводился от ГЛОБАЛЬНОГО MAX(id) по ВСЕЙ таблице boss_damage_log,
                // без всякой связи с $friendIds/$bossStartMs. Если в момент ИМЕННО ЭТОГО пересчёта
                // $friendIds приходил пустым (например, список взаимных друзей ВК ещё не успел
                // синхронизироваться при самом первом обращении к уже какое-то время идущему бою —
                // _friendIds() требует живого запроса на каждого кандидата, см. комментарий там),
                // $friends выше честно считался нулём — но курсор всё равно уезжал вперёд МИМО уже
                // существующих строк урона друга, помечая их как «уже учтённые» НАВСЕГДА (пока
                // matches===true, то есть до конца всей текущей попытки — see $matches выше).
                // Урон друга, которого клиент так и не увидел в тот единственный момент, терялся
                // безвозвратно, даже когда friendIds на следующий вызов приходил уже правильным
                // (_applyFriendDamage() ниже смотрит только "id > cursorId", а этот id уже был
                // проглочен пустым пересчётом) — HP оставался завышенным до конца боя, при этом
                // rating() (без кэша, честный SUM() на каждый запрос) продолжал показывать
                // реальный урон. Фикс: курсор — граница СТРОГО ПО ВРЕМЕНИ (последняя строка ДО
                // начала этой попытки, $bossStartMs), а не "что там сейчас в конце таблицы". Это
                // не зависит от того, кто конкретно уже успел ударить и был ли friendIds известен
                // в момент пересчёта — следующий же вызов с корректным friendIds честно подберёт
                // ВЕСЬ урон друга с начала боя через _applyFriendDamage(), а не потеряет его.
                $res = $link->query('SELECT MAX(`id`) AS maxId FROM `boss_damage_log` WHERE `time` < '.intval($bossStartMs));
                $row = $res ? $res->fetch_assoc() : null;
                $session = [
                    'bossId' => $bossId, 'diffIdx' => $diffIdx, 'startMs' => $bossStartMs,
                    'hp' => max(0, $maxHp - $mine - $friends),
                    'cursorId' => $row ? intval($row['maxId']) : 0,
                ];
            }

            $this->_applyFriendDamage($link, $session, $diffIdx, $friendsSince);
            return $session;
        }

        // ── БЛОКИРОВКА СТРОКИ ДЛЯ boss_fight_session (04.10.2026, по прямому указанию —
        // найдено на реальных данных прод-БД при разборе "друг бьёт, HP кэша не падает") ──
        //
        // attack()/friendsDamage()/startFight()/useSedoy() — ЧЕТЫРЕ разных эндпоинта, каждый из
        // которых читал boss_fight_session через обычный Gameops::loadUser() (своё соединение,
        // полная строка игрока, БЕЗ блокировки) и писал его обратно через обычный saveUser()
        // (INSERT...ON DUPLICATE KEY UPDATE, см. Database::saveData()). Если два таких запроса
        // прилетают почти одновременно (типичный случай — клиент периодически опрашивает
        // friendsDamage(), пока игрок одновременно жмёт "Ударить"), оба читают ОДИН И ТОТ ЖЕ
        // старый кэш, оба независимо считают СВОЙ новый hp/cursorId — и чей saveUser()
        // отработает позже, тот молча затирает обновление первого (классический lost update,
        // тот же класс, что уже чинили для списания патронов тут же в attack(), см. комментарий
        // у блокировки weapons ниже). На живых данных это выглядело так: cursorId в кэше уехал
        // далеко вперёд (значит SQL матчил и "видел" урон друга), а hp при этом не падал вообще —
        // чьё-то более позднее сохранение каждый раз отменяло предыдущее уменьшение.
        //
        // Фикс — тот же паттерн, что уже доказал себя для патронов: SELECT...FOR UPDATE держит
        // блокировку СТРОКИ игрока до COMMIT, второй параллельный запрос физически ждёт эту
        // транзакцию и видит уже обновлённое значение, а не стартует от того же устаревшего
        // снимка. Критично: читаем/пересчитываем кэш ЗАНОВО ПОД локом (не доверяем значению,
        // загруженному РАНЬШЕ через обычный loadUser() в начале функции) — иначе лок защитил бы
        // только запись, но не чтение, и гонка осталась бы на уровне "кто читал раньше".
        //
        // Контракт: открывает транзакцию и НЕ коммитит её — вызывающий код может ещё что-то
        // применить к $session (вычесть свой удар, добавить урон Седого) на том же $link, прежде
        // чем сохранить через _commitFightSession() ниже. Если вызывающий код прерывается раньше
        // (return fail(...)) не вызвав _commitFightSession() — соединение закрывается в конце
        // запроса, mysqli сам откатывает незакоммиченную транзакцию, блокировка снимается, другие
        // данные игрока это не затрагивает (сама строка не менялась, только читалась).
        private function _syncFightSessionLocked($link, $uid, $diffIdx, $bossId, $bossStartMs, $friendsSince){
            $link->begin_transaction();
            $lockRes = $link->query("SELECT `boss_fight_session` FROM `{$this->registry['utb']}` WHERE `id`=".intval($uid)." FOR UPDATE");
            $lockRow = ($lockRes && $lockRes->num_rows > 0) ? $lockRes->fetch_assoc() : null;
            $raw = ($lockRow && $lockRow['boss_fight_session'] !== null) ? json_decode($lockRow['boss_fight_session'], true) : null;
            $lockedSession = is_array($raw) ? $raw : [];

            return $this->_syncFightSession($link, $uid, $lockedSession, $diffIdx, $bossId, $bossStartMs, $friendsSince);
        }

        // Пишет итоговый $session обратно (сырым UPDATE, в обход Gameops::saveUser() — та же
        // причина, что и у записи weapons в attack(): нужен ИМЕННО этот $link, внутри ТОЙ ЖЕ
        // транзакции, что и блокирующий SELECT выше) и коммитит, снимая блокировку строки.
        private function _commitFightSession($link, $uid, $session){
            $json = json_encode($session);
            $link->query("UPDATE `{$this->registry['utb']}` SET `boss_fight_session`='".$link->real_escape_string($json)."' WHERE `id`=".intval($uid));
            $link->commit();
        }

        // Курсорное (не пересчётное) подтягивание урона друзей — читает из boss_damage_log
        // ТОЛЬКО новые строки (id > cursorId), вычитает их сумму из session['hp'] и
        // продвигает курсор до максимального увиденного id. Время (`time>=bossStartMs`) тут
        // не нужно отдельным фильтром — сам курсор уже заведён от MAX(id) на момент старта
        // (см. _syncFightSession() выше), поэтому "id > cursorId" само по себе гарантирует
        // "только после начала боя". Соло (diffIdx===3) сюда не попадает вовсе.
        //
        // 29.09.2026: ДОПОЛНИТЕЛЬНО к "id > cursorId" каждая строка теперь фильтруется ещё и по
        // per-uid `time>=effectiveSinceMs` из $friendsSince (см. _friendsSinceMap() выше) — без
        // этого курсорный (не пересчётный) путь был ВТОРЫМ местом (помимо самого пересчёта в
        // _syncFightSession()), где мог просочиться retroactive-урон: если друг нанёс удар ДО
        // того, как дружба стала взаимной, но ПОСЛЕ старта моего боя (id > cursorId), курсор всё
        // равно подхватывал бы этот удар в тот момент, когда дружба впервые обнаруживалась.
        // Строка, не прошедшая time-фильтр, просто остаётся "неучтённой" — курсор не продвигается
        // мимо неё, пока не появится более свежая ПРОШЕДШАЯ фильтр строка (см. коммент у
        // _friendsSinceMap() — это самовосстанавливающийся край, не бесконечный застрой).
        private function _applyFriendDamage($link, &$session, $diffIdx, $friendsSince){
            if($diffIdx === 3 || empty($friendsSince)) return;
            // 25.09.2026 (тот же реверс, что в _friendsDamageSumSince/_friendsDamagePerUserSince
            // выше — friend's own diff_idx больше не фильтруется, урон друга из Соло тоже
            // засчитывается ПОЛУЧАТЕЛЮ, если сам получатель не в Соло — гейт выше по diffIdx===3
            // относится ТОЛЬКО к получателю).
            // 30.09.2026 (тот же фикс, что в _friendsDamageSumSince() выше — "урон седого не должен
            // отправляться друзьям"): `AND is_sedoy=0` — это курсорный (инкрементальный) путь,
            // который догоняет урон друга МЕЖДУ полными пересчётами _syncFightSession(); без этого
            // фильтра платный удар Седого друга просачивался бы обратно СЮДА даже после того, как
            // сам пересчёт (_friendsDamageSumSince) его уже исключает.
            $sinceId = intval($session['cursorId'] ?? 0);
            $res = $link->query("SELECT SUM(`damage`) AS s, MAX(`id`) AS maxId FROM `boss_damage_log`
                WHERE (".$this->_friendsSinceConds($friendsSince).") AND `id` > $sinceId AND `is_sedoy`=0");
            $row = $res ? $res->fetch_assoc() : null;
            if($row && $row['maxId'] !== null){
                $session['hp'] = max(0, intval($session['hp']) - max(0, intval($row['s'])));
                $session['cursorId'] = intval($row['maxId']);
            }
        }

        // Лёгкий эндпоинт для периодического автоопроса, пока открыт экран боя (см.
        // bosses-combat.js._syncFriendsDamage) — отдаёт готовый производный hp, клиенту не
        // нужно ничего досчитывать.
        function friendsDamage(){
            $bossId  = isset($this->registry['user_params']['boss_id'])  ? intval($this->registry['user_params']['boss_id'])  : -1;
            $diffIdx = isset($this->registry['user_params']['diff_idx']) ? intval($this->registry['user_params']['diff_idx']) : -1;
            if($bossId < 0 || $bossId > 7 || $diffIdx < 0 || $diffIdx > 3) return $this->ops->fail(54);

            $uid  = abs(intval($this->registry['uid']));
            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);
            $data = $this->_decodeBossesData($user['bosses_data'] ?? null);
            if(!is_array($data)) $data = [];

            $maxHp = $this->BOSS_HP[$bossId][$diffIdx];
            $bossStartMs = $this->_myFightStart($data, $diffIdx, $bossId);
            if($bossStartMs <= 0){
                // Бой не активен — кэшировать нечего, отдаём максимум (тот же контракт, что
                // был у _derivedHp() при startMs<=0).
                return $this->registry['tools']->output(['hp' => $maxHp, 'maxHp' => $maxHp]);
            }

            $friendIds = ($diffIdx !== 3 && !empty($user['friends'])) ? $this->_friendIds($user) : [];
            $friendsSince = $this->_friendsSinceMap($user, $friendIds, $bossStartMs);

            $link = $this->_rawLink();
            if(!$link) return $this->ops->fail(99);
            // Это единственный эндпоинт, который клиент дёргает ПЕРИОДИЧЕСКИ пока открыт
            // экран боя (см. bosses-combat.js._syncFriendsDamage) — именно здесь курсор
            // реально "едет вперёд" и сохраняется, тот же принцип, что refreshDamages() у
            // референсной игры сохраняет строку боя при каждом check(). 04.10.2026: под
            // блокировкой строки (см. _syncFightSessionLocked()) — этот опрос чаще всего и
            // участвует в гонке с attack()/useSedoy().
            $session = $this->_syncFightSessionLocked($link, $uid, $diffIdx, $bossId, $bossStartMs, $friendsSince);
            $this->_commitFightSession($link, $uid, $session);
            $link->close();

            // boss_fight_session уже атомарно сохранён выше — $user не трогаем для этого поля,
            // чтобы обычный saveUser() (другие поля, напр. friends_since) его не перезаписал.
            $this->ops->saveUser($user);

            $this->registry['tools']->output(['hp' => intval($session['hp']), 'maxHp' => $maxHp]);
        }

        // Топ-9 участников ТЕКУЩЕГО боя (моего + друзей) для панели «РЕЙТИНГ УРОНА» — моя
        // строка через _damageSumSince (скоуплена по boss_id), строки друзей через
        // _friendsDamagePerUserSince (не скоуплены — кросс-боссовая помощь). Переиспользуется
        // claimKill() для попапа результата боя.
        // 29.09.2026 (по прямому указанию + скриншот — "участники боя показывают урон друга,
        // который на самом деле пришёл от Седого, урон седого не должен рассчитываться
        // друзьям"): оба вызова ниже — с $excludeSedoy=true — ни свой Седой, ни чужой в этот
        // рейтинг не попадает: рейтинг должен отражать реальный боевой вклад, а не купленную
        // помощь. 30.09.2026 (по прямому указанию — "урон седого отправляется друзьям, не
        // должен"): раньше здесь же было написано, что удар Седого "по-прежнему снижает ОБЩЕЕ
        // HP босса" (то есть чужой Седой всё ещё помогал реальному убийству, просто не в
        // рейтинге) — это устарело. Теперь _friendsDamageSumSince()/_applyFriendDamage() тоже
        // исключают is_sedoy=1, то есть удар Седого ВООБЩЕ не передаётся друзьям ни в каком
        // виде — ни в рейтинг, ни в производный HP.
        // 29.09.2026: $friendsSince — уже готовая карта (uid=>effectiveSinceMs, см.
        // _friendsSinceMap()), а не плоский список — вызывающий код считает её сам ДО вызова
        // (нужен $startMs = _myFightStart(...), который эта функция и так пересчитывает ниже).
        private function _ratingTop($link, $uid, $nick, $bossId, $diffIdx, $myData, $friendsSince){
            $startMs = $this->_myFightStart($myData, $diffIdx, $bossId);
            // A completed fight has no active window; time >= 0 would include all history.
            if($startMs <= 0) return [];

            $myDmg = $this->_damageSumSince($link, $uid, $bossId, $startMs, true);
            $myEntry = $myDmg > 0 ? ['id' => $uid, 'damage' => $myDmg, 'nick' => $nick] : null;

            // 04.10.2026 (по прямому указанию — "может быть такое что я не попаду в топ, поэтому
            // имеет смысл брать не 8 лучших игроков по вкладу, а всё-таки 9"): раньше моя строка
            // и строки друзей сливались в ОДИН список, сортировались по урону и только потом
            // резались до 9 — если у игрока набиралось 9+ взаимных друзей, бьющих того же/другого
            // босса, и все они нанесли БОЛЬШЕ урона, чем сам игрок, его СОБСТВЕННАЯ строка
            // вылетала из "рейтинга урона" его же боя (array_slice резал её наравне со всеми).
            // Фикс: себя показываем ВСЕГДА (если бил хоть раз), друзей берём топ-8 по урону — итог
            // так и остаётся максимум 9 строк (под UI, см. комментарий выше — 3 в живой панели,
            // 3+6 в попапе результата), но свой вклад больше не может быть вытеснен чужим.
            $friendEntries = [];
            if($diffIdx !== 3 && !empty($friendsSince)){
                $perUser = $this->_friendsDamagePerUserSince($link, $friendsSince, true);
                if(!empty($perUser)){
                    $rows = $this->registry['udb']->getData($this->registry['utb'], array('id', 'nick'), 'id IN('.implode(',', array_keys($perUser)).')', true);
                    $nicks = [];
                    if(is_array($rows)) foreach($rows as $row) $nicks[intval($row['id'])] = strval($row['nick'] ?? '');
                    foreach($perUser as $fid => $dmg) $friendEntries[] = ['id' => $fid, 'damage' => $dmg, 'nick' => $nicks[$fid] ?? ''];
                }
            }
            usort($friendEntries, function($a, $b){ return $b['damage'] - $a['damage']; });
            $topFriends = array_slice($friendEntries, 0, 8);

            $entries = $myEntry ? array_merge([$myEntry], $topFriends) : $topFriends;
            usort($entries, function($a, $b){ return $b['damage'] - $a['damage']; });
            return $entries;
        }

        // Рейтинг урона (панель «РЕЙТИНГ УРОНА» + кнопка «ПЕРЕЗАГРУЗИТЬ», bosses_fight.js.
        // _fetchBossFightRating) — топ-9 по друзьям (и себе), не глобальный.
        function rating(){
            $bossId  = isset($this->registry['user_params']['boss_id'])  ? intval($this->registry['user_params']['boss_id'])  : -1;
            $diffIdx = isset($this->registry['user_params']['diff_idx']) ? intval($this->registry['user_params']['diff_idx']) : -1;
            if($bossId < 0 || $bossId > 7 || $diffIdx < 0 || $diffIdx > 3) return $this->registry['tools']->output(['top' => []]);

            $uid = abs(intval($this->registry['uid']));
            $me = $this->registry['udb']->getData($this->registry['utb'], array('bosses_data', 'friends', 'friends_since', 'nick'), 'id='.$this->registry['uid']);
            if(isset($me['error']) && $me['error']) return $this->registry['tools']->output(['top' => []]);

            $myData = $this->_decodeBossesData($me['bosses_data'] ?? null);
            if(!is_array($myData)) $myData = [];
            $friendIds = (!isset($me['error']) && $diffIdx !== 3) ? $this->_friendIds($me) : [];

            // 04.10.2026 (НАЙДЕНО по репорту "урон друзьям приходит, но они не отображаются в
            // рейтинге урона/попапе победы"): сюда передавался СЫРОЙ $friendIds (плоский список
            // uid) вместо карты uid=>effectiveSinceMs, которую строит _friendsSinceMap() и
            // ожидает _ratingTop() (параметр там называется $friendsSince не просто так — см.
            // _friendsSinceConds()). foreach по плоскому списку даёт $uid=0,1,2... (ИНДЕКСЫ
            // массива), а $since=РЕАЛЬНЫЙ uid друга — SQL-условие вида "uid=0 AND
            // time>=382448269" никогда не совпадает ни с одной строкой boss_damage_log
            // (настоящих VK-uid, равных 0 или 1, не бывает), поэтому _friendsDamagePerUserSince()
            // детерминированно возвращал [] — друзья НИКОГДА не попадали в рейтинг, независимо
            // от того, бил ли реально друг босса. HP же считается отдельным путём
            // (_syncFightSession()/friendsDamage()), который строит карту ПРАВИЛЬНО через
            // _friendsSinceMap() — отсюда и расхождение "урон засчитывается в HP, но в списке
            // участников друга нет". Тот же баг был в endFightSession() и claimKill() — см.
            // правки там же.
            $myFightStartForLog = $this->_myFightStart($myData, $diffIdx, $bossId);
            $friendsSince = (!empty($friendIds) && $myFightStartForLog > 0) ? $this->_friendsSinceMap($me, $friendIds, $myFightStartForLog) : [];

            $link = $this->_rawLink();
            if(!$link) return $this->registry['tools']->output(['top' => []]);
            $top = $this->_ratingTop($link, $uid, strval($me['nick'] ?? ''), $bossId, $diffIdx, $myData, $friendsSince);
            $link->close();

            // 24.09.2026 (диагностика по репорту "рейтинг накапливается между боями, а не
            // сбрасывается после победы" — статический разбор кода + прямая проверка SQL
            // (boss_damage_log) показали, что сумма урона ЗА ОДИН бой математически не может
            // превысить maxHp босса, значит проблему не удалось поймать чтением кода. rating()
            // был единственным из активных боссовых эндпоинтов вообще БЕЗ error_log — добавлено,
            // чтобы при следующем повторении бага в логе сразу было видно, какой именно
            // startMs использовался и что вернул SUM(), вместо гадания.
            error_log('[bosses.rating] ' . json_encode([
                'uid' => $uid, 'bossId' => $bossId, 'diffIdx' => $diffIdx,
                'myFightStart' => $myFightStartForLog, 'friendIds' => $friendIds, 'friendsSince' => $friendsSince,
                'top' => $top, 'time' => date('Y-m-d H:i:s'), 'microtime' => microtime(true),
            ]));

            $this->registry['tools']->output(['top' => $top]);
        }

        // Кто последним убил каждого из 8 боссов — ГЛОБАЛЬНО, среди ВСЕХ игроков игры.
        // Хранится в отдельной
        // таблице boss_last_kill (boss_id PK, 8 строк максимум) — обновляется recordKill()
        // при каждой победе НАД боссом ЛЮБЫМ игроком (см. bosses-combat.js._onDefeat).
        function killers(){
            $link = $this->_rawLink();
            if(!$link) return $this->registry['tools']->output(['killers' => []]);

            // JOIN с users — нужен nick (игровой ник, не VK-имя), по прямому указанию 17.09.2026
            // все рейтинги/бейджи показывают именно его.
            $utb = $this->registry['utb'];
            $out = [];
            // 29.09.2026: killed_at теперь тоже отдаётся клиенту — bosses_select.js сверяет его
            // со своей локальной меткой "я только что закрыл попап победы" (_lastOwnKill,
            // bosses-combat.js), чтобы не показать устаревшего убийцу, пока fire-and-forget
            // recordKill() ещё не долетел до сервера (см. коммент там же).
            $res = $link->query("SELECT bl.`boss_id`, bl.`user_id`, bl.`killed_at`, u.`nick` FROM `boss_last_kill` bl LEFT JOIN `{$utb}` u ON u.`id` = bl.`user_id`");
            if($res) while($row = $res->fetch_assoc()) $out[] = ['boss_id' => intval($row['boss_id']), 'id' => intval($row['user_id']), 'nick' => strval($row['nick'] ?? ''), 'killed_at' => intval($row['killed_at'])];
            $link->close();

            $this->registry['tools']->output(['killers' => $out]);
        }

        // Записывает, что ТЕКУЩИЙ игрок только что убил boss_id — вызывается один раз при
        // каждой победе (bosses-combat.js._onDefeat), fire-and-forget с клиента.
        function recordKill(){
            $bossId = isset($this->registry['user_params']['boss_id']) ? intval($this->registry['user_params']['boss_id']) : -1;
            if($bossId < 0 || $bossId > 7) return $this->registry['tools']->output(['ok' => false]);

            $link = $this->_rawLink();
            if(!$link) return $this->registry['tools']->output(['ok' => false]);

            $uid = intval($this->registry['uid']);
            $now = time();
            // 29.09.2026 (баг найден по прямому указанию — "рамка УБИВШИЙ иногда показывает не
            // того игрока"): recordKill() — fire-and-forget с клиента (bosses-combat.js._onDefeat.
            // _doRedirect), несколько игроков могут закрыть попап победы над одним боссом
            // примерно одновременно — их запросы могут долететь до сервера НЕ в том порядке, в
            // котором реально были отправлены (обычная сетевая гонка). UPDATE раньше был
            // безусловным — более СТАРЫЙ по времени killed_at, доехавший ПОСЛЕ более нового,
            // тихо перезаписывал его поверх. Задуманное поведение "последний закрывший попап
            // побеждает" (см. коммент в bosses-combat.js) должно определяться по ВРЕМЕНИ ($now),
            // а не по порядку доставки запроса — гвард ниже игнорирует запрос, если в БД уже
            // лежит запись с более поздним (или тем же) killed_at.
            $link->query("INSERT INTO `boss_last_kill` (`boss_id`, `user_id`, `killed_at`) VALUES ($bossId, $uid, $now)
                ON DUPLICATE KEY UPDATE
                    `user_id` = IF($now >= `killed_at`, $uid, `user_id`),
                    `killed_at` = IF($now >= `killed_at`, $now, `killed_at`)");
            $link->close();

            $this->registry['tools']->output(['ok' => true]);
        }

        // ── SERVER-AUTHORITATIVE СТАРТ БОЯ (17.09.2026, ответ на прямой вопрос: "таймер боя
        // остаётся на клиенте — разве его не стоит перенести на сервер?") ──
        //
        // Сервер сам проверяет зачищена ли локация и хватает ли ключей, сам их списывает и сам
        // пишет bossStartMs (серверное время, microtime) — идемпотентно для уже идущего боя
        // (не списывает ключи повторно, см. $existing ниже).
        //
        // 23.09.2026 (баг 20.09.2026, откат вместе с общим boss_instance): игрок физически
        // ведёт только ОДИН бой одновременно, но ничто не мешало открыть бой с НОВЫМ боссом, не
        // нажав "выйти из боя" у старого — старый bossStartMs так и оставался висеть ненулевым
        // навсегда, и _friendsDamageSumSince() (не скоуплена по boss_id, см. выше) продолжала
        // бы вечно засчитывать чужую помощь по нему любому другу, дерущемуся с ТЕМ ЖЕ старым
        // боссом. Фикс — старт НОВОГО боя автоматически форфейтит любую другую ещё активную пару
        // (diffIdx,bossId): bossStartMs=0. Инвариант "активен только один бой" не зависит от
        // того, нажал ли игрок "выйти".
        function startFight(){
            $bossId  = intval($this->registry['user_params']['boss_id']  ?? -1);
            $diffIdx = intval($this->registry['user_params']['diff_idx'] ?? -1);
            if($bossId < 0 || $bossId > 7 || $diffIdx < 0 || $diffIdx > 3) return $this->ops->fail(54);

            $catalog = $this->_catalog();
            $bossCfg = $catalog['bosses'][$bossId];

            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            if(!$this->_isLocCleared($user, intval($bossCfg['boss_loc'] ?? -1))) return $this->ops->fail(63); // локация не зачищена

            $data = $this->_decodeBossesData($user['bosses_data'] ?? null);
            if(!is_array($data)) $data = [];

            if(!isset($data['bossStartMs']) || !is_array($data['bossStartMs'])) $data['bossStartMs'] = [];
            for($di = 0; $di < 4; $di++){
                if(!isset($data['bossStartMs'][$di]) || !is_array($data['bossStartMs'][$di])) $data['bossStartMs'][$di] = array_fill(0, 8, 0);
                while(count($data['bossStartMs'][$di]) < 8) $data['bossStartMs'][$di][] = 0;
            }
            if(!isset($data['curCycleDmg']) || !is_array($data['curCycleDmg'])) $data['curCycleDmg'] = array_fill(0, 8, 0);
            while(count($data['curCycleDmg']) < 8) $data['curCycleDmg'][] = 0;

            // Авто-форфейт любой другой активной пары ДО записи новой попытки (см. коммент выше).
            //
            // 25.09.2026 (баг найден по прямому указанию, живой репорт со скриншотом — "КД
            // бесплатного оружия не обнуляется, хотя бой уже закончен"): этот авто-форфейт —
            // ТРЕТИЙ способ, которым бой фактически завершается (помимо явного claimKill()
            // победы и явного endFightSession() поражения/таймаута/форфейта, см. их же комментарии
            // "верни ту механику" — freeWpnCdMs=[] там уже стоит). Игрок, который просто вышел
            // через крестик (_leaveBossesFight — НЕ форфейт, сессия остаётся живой специально,
            // чтобы бой можно было продолжить) и потом начал бой с ДРУГИМ боссом/сложностью,
            // молча терял старую попытку именно здесь — но freeWpnCdMs (глобальная карта кулдаунов
            // бесплатного оружия, не привязанная к конкретному bossId/diffIdx) не сбрасывалась
            // НИ РАЗУ для этого пути, потому что копия сброса стояла только в claimKill()/
            // endFightSession(), а сюда её никто не добавил. Итог: кулдаун, выставленный
            // бесплатным ударом в брошенном бою, залипал до следующей ПОБЕДЫ/ТАЙМАУТА/форфейта —
            // произвольно долго. Теперь сбрасывается и здесь, при любом реальном авто-форфейте.
            $autoForfeited = false;
            for($di = 0; $di < 4; $di++){
                for($bi = 0; $bi < 8; $bi++){
                    if($di === $diffIdx && $bi === $bossId) continue;
                    if(intval($data['bossStartMs'][$di][$bi]) > 0){
                        $data['bossStartMs'][$di][$bi] = 0;
                        $data['curCycleDmg'][$bi] = 0;
                        $autoForfeited = true;
                    }
                }
            }
            if($autoForfeited) $data['freeWpnCdMs'] = [];

            $now = intval(round(microtime(true) * 1000));
            $existing = intval($data['bossStartMs'][$diffIdx][$bossId] ?? 0);
            if($existing > 0){
                // Уже идущий бой (не протух) — не списываем ключи повторно, просто отдаём
                // актуальный производный HP.
                $isFresh = ($now - $existing) < $this->MAX_FIGHT_WINDOW_MS;
                if(!$isFresh){
                    $existing = 0; // протух — считаем как "бой не начат", пойдём по ветке ниже
                    // 25.09.2026 (тот же фикс, что и авто-форфейт ДРУГОЙ пары выше): протухание
                    // этой ЖЕ пары (истекло MAX_FIGHT_WINDOW_MS, игрок просто вернулся позже и
                    // жмёт "начать бой" заново) — тоже реальное "бой закончился по времени", а
                    // не покрывается тем циклом (там explicit continue на $di===$diffIdx &&
                    // $bi===$bossId). Сбрасываем кулдаун и здесь.
                    $data['freeWpnCdMs'] = [];
                }
            }

            $uid = abs(intval($this->registry['uid']));
            if($existing <= 0){
                // 24.09.2026 (баг найден по прямому указанию + скриншот — "лимит 7 убийств
                // исчерпан, но бой всё равно открылся, атаковать нельзя, выйти можно только
                // через форфейт"): startFight() ВООБЩЕ не проверял дневной лимит убийств — его
                // проверял только claimKill() при добивании. Клиентский предчек (bosses_select.js
                // ._onNapastClick) обычно ловил это раньше, НО кнопка "ЕЩЁ РАЗ" на попапе
                // результата боя (boss_result.js) звала _openBossesFight() напрямую, в обход
                // этого предчека — сервер как единственный источник истины обязан проверять сам,
                // не полагаясь на то, что клиент всегда сначала спросит. Проверяем ТОЛЬКО для
                // ГЕНУИННО нового старта (эта ветка $existing<=0) — уже идущий бой (ниже по
                // функции) не трогаем, его можно доиграть/просмотреть в любом случае.
                $limit = intval($catalog['daily_kill_limit']);
                $today = $this->ops->mskDailyDate();
                if(!isset($data['dailyDate']) || $data['dailyDate'] !== $today){
                    $data['dailyDate']  = $today;
                    $data['dailyKills'] = array_fill(0, 8, 0);
                }
                if(!isset($data['dailyKills']) || !is_array($data['dailyKills'])) $data['dailyKills'] = array_fill(0, 8, 0);
                while(count($data['dailyKills']) < 8) $data['dailyKills'][] = 0;
                if(intval($data['dailyKills'][$bossId]) >= $limit) return $this->ops->fail(62); // дневной лимит убийств уже исчерпан

                if(!isset($data['keys']) || !is_array($data['keys'])) $data['keys'] = array_fill(0, 8, 0);
                while(count($data['keys']) < 8) $data['keys'][] = 0;

                // 25.09.2026 (баг найден по прямому указанию — аудит "Связки ключей"): владелец
                // постоянного предмета "Связка ключей" (keyring_owner, выдаётся roulette.php
                // через сектор №1/мини-игру) может нападать на ЛЮБОГО босса без ключей и без
                // ограничения по количеству раз — по ТЗ. Раньше это поле нигде не читалось в
                // bosses.php вообще: предмет существовал только на бумаге (лежал в БД), а
                // требование ключей проверялось как обычно. Владелец связки полностью
                // пропускает и проверку, и списание — ключи вообще не трогаются.
                $hasKeyring = $this->ops->i($user, 'keyring_owner') > 0;
                $needKeys = intval($bossCfg['keys_needed'] ?? 0);
                // Баркут и Борода используют один тип ключа: ключ Баркута (слот 5).
                // Жгут по-прежнему получает ключ только за победу над Баркутом (слот 7).
                $keySlot = intval($bossCfg['key_slot'] ?? $bossId);
                if($keySlot < 0 || $keySlot > 7) $keySlot = $bossId;
                if(!$hasKeyring){
                    if($needKeys > 0 && intval($data['keys'][$keySlot]) < $needKeys) return $this->ops->fail(64); // не хватает ключей
                    if($needKeys > 0) $data['keys'][$keySlot] = intval($data['keys'][$keySlot]) - $needKeys;
                }

                // 29.09.2026 (баг найден по прямому указанию — "лимиты атак не заканчиваются"):
                // раньше попытка списывалась ТОЛЬКО в claimKill() — то есть только при ПОБЕДЕ.
                // Поражение (форфейт "выйти из боя", endFightSession()), таймаут (тот же
                // endFightSession()) и молчаливый авто-форфейт (см. цикл автозабвения другой
                // пары выше по этой же функции) вообще не трогали dailyKills — игрок мог начать
                // бой, сразу сдаться/дождаться таймаута и повторить это неограниченное число раз
                // в рамках одного дня, ни разу не потратив дневной лимит. Особенно опасно в
                // сочетании со "Связкой ключей" (см. $hasKeyring выше) — такой игрок ещё и не
                // тратит ключи, то есть лимит был единственным, что вообще могло его остановить.
                // Фикс: попытка расходуется ЗДЕСЬ — в момент РЕАЛЬНОГО начала боя (эта ветка
                // выполняется только при $existing<=0, см. окружающий if выше), независимо от
                // того, чем бой закончится (победа/поражение/таймаут/переключение на другого
                // босса). claimKill() и endFightSession() больше НЕ трогают dailyKills.
                $data['dailyKills'][$bossId] = intval($data['dailyKills'][$bossId]) + 1;

                $data['bossStartMs'][$diffIdx][$bossId] = $now;

                // "С чистого листа" фиксируем очки скиллов на сервере (тот же смысл, что
                // client-side skills.beginSession() раньше делал сам) — sessionStartPoints нужен
                // endFightSession()/claimKill(), чтобы понять, был ли получен левелап ИМЕННО за
                // эту попытку (см. _finalizeSkillSession() выше). Только при РЕАЛЬНО новом
                // старте — повторный вход в уже идущий бой не должен сбрасывать прогресс.
                $skillsState = $this->_loadSkillsState($user);
                $skillsState['sessionStartPoints'] = $this->_skillEarnedPoints($this->ops->catalog('skills_config'), intval($skillsState['dmgSpent']));
                $user['skills_levels'] = json_encode($skillsState);
            }

            $friendIds = ($diffIdx !== 3 && !empty($user['friends'])) ? $this->_friendIds($user) : [];
            $link = $this->_rawLink();
            if(!$link) return $this->ops->fail(99);
            // $activeStartMs = $now для реально нового старта (см. запись двумя строками выше
            // в ветке $existing<=0) или $existing для возврата к уже идущему бою — в обоих
            // случаях это ровно то значение, что сейчас лежит в bossStartMs[diffIdx][bossId].
            $activeStartMs = intval($data['bossStartMs'][$diffIdx][$bossId]);
            // 30.09.2026 (баг найден по прямому указанию, при разборе устаревших тестов —
            // "почему тест матчит $friendIds, если сигнатура давно $friendsSince?"): этот вызов
            // (и ещё два — attack()/claimKill()) передавал в _syncFightSession() СЫРОЙ список
            // $friendIds вместо карты $friendsSince, хотя _friendsSinceConds() внутри
            // _friendsDamageSumSince()/_applyFriendDamage() делает `foreach($friendsSince as $uid
            // => $since)` — на плоском списке это даёт $uid=0,1,2... (индексы массива) и
            // $since=реальные VK-id друзей, то есть в SQL улетало мусорное условие вида
            // "uid=0 AND time>=123456789", которое ни с одной строкой boss_damage_log не совпадёт.
            // Единственным местом, где карта строилась ПРАВИЛЬНО (через _friendsSinceMap()), был
            // friendsDamage() — периодический опрос экрана боя. Итог: урон друга реально
            // подхватывался только этим опросом, а не сразу при старте/атаке/клейме победы.
            $friendsSince = $this->_friendsSinceMap($user, $friendIds, $activeStartMs);
            // 04.10.2026: под блокировкой строки (см. _syncFightSessionLocked()) — защита от
            // гонки с attack()/friendsDamage() на тот же самый момент старта/возврата в бой.
            $session = $this->_syncFightSessionLocked($link, $uid, $diffIdx, $bossId, $activeStartMs, $friendsSince);
            $this->_commitFightSession($link, $uid, $session);
            $link->close();
            // boss_fight_session уже атомарно сохранён выше — НЕ присваиваем $user['boss_fight_session'],
            // чтобы следующий saveUser() (ниже) его не перезаписал устаревшим значением.

            $user['bosses_data'] = json_encode($data);
            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);

            $patch = $this->ops->patchCurrencies($user, ['bosses_data', 'skills_levels']);
            $this->ops->ok(['patch' => $patch, 'bossStartMs' => $activeStartMs,
                'keysLeft' => $data['keys'][$keySlot] ?? 0,
                'hp' => intval($session['hp']), 'maxHp' => $this->BOSS_HP[$bossId][$diffIdx],
            ]);
        }

        // ── ПОКУПКА КЛЮЧА ЗА РУБЛИ (26.09.2026) ──
        //
        // Перенос клиентской bosses.js._buyKey() (списывала udata['coins'] напрямую, без единой
        // серверной проверки — читер мог получить любое число ключей из консоли, не тратя
        // ничего реально) на сервер, по образцу startFight()/claimKill() выше (тот же формат
        // bosses_data.keys[] — 8 элементов, array_fill(0,8,0) дефолт, while(count(...)<8)
        // добивание). Стоимость ключа — та же таблица buy_key, что this.data[idx].buy_key в
        // bosses.js (id1=3, id2=6, id3=18, остальные=0 — недоступно).
        //
        // Первая строка — BUY_KEY_LOCKED (см. объявление поля выше): этой функции пока нет в
        // плане/дизайне игры, сервер отклоняет ЛЮБОЙ вызов, независимо от того, что прислал
        // клиент. Код ниже флага не активен сейчас, но готов к включению одной строкой, когда
        // фича будет утверждена.
        function buyKey(){
            if($this->BUY_KEY_LOCKED) return $this->ops->fail(56);

            $bossId = intval($this->registry['user_params']['boss_id'] ?? -1);
            if($bossId < 0 || $bossId > 7) return $this->ops->fail(54);

            // Та же таблица buy_key, что this.data[idx].buy_key в _client/src/game/bosses.js
            // (строки ~56-63) — id1=3, id2=6, id3=18, остальные=0 (покупка недоступна).
            $buyKeyCost = [0, 3, 6, 18, 0, 0, 0, 0];
            $cost = intval($buyKeyCost[$bossId]);
            if($cost <= 0) return $this->ops->fail(55); // ключ для этого босса не продаётся

            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            if(!$this->ops->deduct($user, 'coins', $cost)) return $this->ops->fail(50); // не хватает рублей

            $data = $this->_decodeBossesData($user['bosses_data'] ?? null);
            if(!is_array($data)) $data = [];
            if(!isset($data['keys']) || !is_array($data['keys'])) $data['keys'] = array_fill(0, 8, 0);
            while(count($data['keys']) < 8) $data['keys'][] = 0;
            $data['keys'][$bossId] = intval($data['keys'][$bossId] ?? 0) + 1;
            $user['bosses_data'] = json_encode($data);

            $user['coins_spent'] = $this->ops->i($user, 'coins_spent') + $cost;

            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
            $this->ops->ok(['patch' => $this->ops->patchCurrencies($user, ['coins', 'coins_spent', 'bosses_data'])]);
        }

        // Тот же формат [{owned,equipped,upg,qty}, ×6], что weapons.js/weapons.php._loadWeapons()
        // — дублировано намеренно (тот же принцип, что _gangBonus() выше и killers()/zone.php.
        // leaders() дублируют _rawLink()): Weapons — другой контроллер/другой $registry, вынос
        // в Gameops общего хелпера для "загрузить + нормализовать одно JSON-поле" обсуждать
        // отдельно, не в рамках этого переноса.
        private function _loadWeaponsLocal($user){
            $raw = $this->ops->j($user, 'weapons', []);
            $data = is_array($raw) ? $raw : [];
            for($i = 0; $i < 6; $i++){
                if(!isset($data[$i]) || !is_array($data[$i])) $data[$i] = ['owned' => false, 'equipped' => false, 'upg' => 0, 'qty' => 0];
                if(!isset($data[$i]['owned']))    $data[$i]['owned']    = false;
                if(!isset($data[$i]['equipped'])) $data[$i]['equipped'] = false;
                if(!isset($data[$i]['upg']))      $data[$i]['upg']      = 0;
                if(!isset($data[$i]['qty']))      $data[$i]['qty']      = 0;
            }
            for($i = 0; $i < 3; $i++) $data[$i]['owned'] = true;
            ksort($data);
            return array_values($data);
        }

        // Тот же формат {levels,dmgSpent,sessionStartPoints}, что skills.php._loadState() —
        // дублировано по тому же принципу, что _loadWeaponsLocal() выше (разные контроллеры).
        // 22.09.2026: dmgSpent (прогресс урона на следующее очко скилла) переехал сюда же, из
        // client-writable skills_data — читер больше не может подделать его через users.save
        // (см. большой комментарий в skills.php). Растёт ТОЛЬКО внутри attack() ниже, на
        // реальный урон, только что подтверждённый сервером же.
        private function _loadSkillsState($user){
            $raw   = $this->ops->j($user, 'skills_levels', null);
            $state = is_array($raw) ? $raw : [];

            if(!isset($state['levels']) || !is_array($state['levels'])){
                $oldData = $this->ops->j($user, 'skills_data', []);
                $state['levels'] = (is_array($oldData) && isset($oldData['levels']) && is_array($oldData['levels']))
                    ? $oldData['levels'] : array_fill(0, 20, 0);
            }
            while(count($state['levels']) < 20) $state['levels'][] = 0;
            $state['levels'] = array_values($state['levels']);

            if(!isset($state['dmgSpent'])){
                // Миграция СУЩЕСТВУЮЩИХ игроков — ровно один раз подхватываем то, что клиент
                // уже накопил в старом client-writable skills_data (тот же приём, что levels
                // выше и что skills.php._loadState() делает независимо).
                $oldSkillsData = $this->ops->j($user, 'skills_data', []);
                $state['dmgSpent'] = (is_array($oldSkillsData) && isset($oldSkillsData['skillsDmgSpent']))
                    ? max(0, intval($oldSkillsData['skillsDmgSpent'])) : 0;
            }
            if(!isset($state['sessionStartPoints'])) $state['sessionStartPoints'] = 0;

            return $state;
        }

        // Та же арифметическая прогрессия, что skills.php._pointCost/_totalDmgForPoints/
        // _calcPoints — дублирована здесь по тому же принципу (разные контроллеры). При
        // изменении формулы на клиенте (skills.js) обязательно менять во ВСЕХ трёх местах.
        private function _skillTotalDmgForPoints($catalog, $n){
            if($n <= 0) return 0;
            $base = intval($catalog['point_base_cost']);
            $step = intval($catalog['point_cost_step']);
            return $n * $base + intval(floor($step * $n * ($n - 1) / 2));
        }

        private function _skillEarnedPoints($catalog, $dmgSpent){
            if($dmgSpent <= 0) return 0;
            $lo = 0; $hi = intval($catalog['total_points']);
            while($lo < $hi){
                $mid = intval(ceil(($lo + $hi) / 2));
                if($this->_skillTotalDmgForPoints($catalog, $mid) <= $dmgSpent) $lo = $mid;
                else $hi = $mid - 1;
            }
            return $lo;
        }

        // Та же сумма уровней, что skills.php._spentPoints() — дублирована по тому же принципу
        // (разные контроллеры).
        private function _skillSpentPoints($levels){
            $spent = 0;
            foreach($levels as $v) $spent += intval($v);
            return $spent;
        }

        // 25.09.2026 (по прямому указанию — "может будем сохранять отдельным полем, мне
        // кажется это хорошее решение"): доступные очки скиллов раньше ВСЕГДА пересчитывались
        // на лету (earned - spent) — само по себе не баг (обе величины монотонно растут, терять
        // или дублировать было нечем), но по явной просьбе переведено на персистентный баланс
        // $state['points'], который апгрейд тратит напрямую, а не earned-spent на каждый показ.
        // $state['earnedBaseline'] — earned на момент последней синхронизации, чтобы начислять
        // только НОВЫЕ очки (дельту), не весь earned заново. Мигрирует существующих игроков один
        // раз тем же приёмом, что уже применён к levels/dmgSpent выше в _loadSkillsState().
        private function _syncSkillPoints(&$state, $catalog){
            $earned = $this->_skillEarnedPoints($catalog, intval($state['dmgSpent'] ?? 0));
            if(!isset($state['earnedBaseline'])){
                $state['earnedBaseline'] = $earned;
                $state['points'] = max(0, $earned - $this->_skillSpentPoints($state['levels']));
                return;
            }
            $delta = $earned - intval($state['earnedBaseline']);
            if($delta > 0){
                $state['points'] = intval($state['points'] ?? 0) + $delta;
                $state['earnedBaseline'] = $earned;
            }
        }

        // Общий выход из попытки боя (победа / поражение / таймаут / форфейт).
        // 22.09.2026 (по прямому указанию — "хочу чтобы очки скиллов обнулялись всегда, без
        // исключений, когда начинается новый бой"): раньше (17-18.09.2026 дизайн) прогресс до
        // следующего очка обнулялся, ТОЛЬКО ЕСЛИ за эту попытку не было получено ни одного
        // нового очка (leveled-check от sessionStartPoints) — если очко было получено, остаток
        // прогресса к СЛЕДУЮЩЕМУ очку переносился в новый бой. Пользователь явно подтвердил, что
        // это уже не то поведение, которое нужно — теперь остаток обнуляется ПОСЛЕ КАЖДОГО боя
        // безусловно, даже если очко(и) было получено. sessionStartPoints (bosses.startFight())
        // и сам leveled-check в этой функции больше не нужны — не убраны из startFight() полностью
        // (поле остаётся в структуре skills_levels, просто больше не читается здесь), чтобы не
        // трогать формат данных лишний раз.
        // 23.09.2026 (баг найден по прямому указанию — "опыт всё равно сохраняется после победы
        // над боссом, независимо от того как закончился бой"): комментарий выше утверждал
        // "мутирует $user['skills_levels'] НА МЕСТЕ", но параметр был объявлен БЕЗ `&$user` —
        // PHP-массивы передаются по значению, значит эта функция все годы мутировала только
        // СВОЮ ЛОКАЛЬНУЮ КОПИЮ $user, а вызывающий код (claimKill()/endFightSession()) сохранял
        // ('$this->ops->saveUser($user)') совершенно нетронутый оригинал. Обнуление прогресса до
        // следующего очка скилла было no-op с самого начала, для ВСЕХ 4 путей выхода из боя
        // (победа/поражение/таймаут/форфейт/крестик) — не только для крестика, который чинили
        // вчера отдельно (тот фикс был правильным и нужным, но не мог сработать без этого).
        // 04.10.2026 (аудит гонок состояний — то же, что уже исправлено в attack() выше):
        // раньше читала skills_levels из $user, загруженного В НАЧАЛЕ claimKill()/
        // endFightSession() — если параллельный attack() того же игрока успевал сохранить
        // новый dmgSpent МЕЖДУ тем loadUser() и этим вызовом, финализация пересчитывала откат
        // от устаревшего снимка и теряла реальный прогресс последнего удара (или наоборот —
        // откатывала его дважды). Теперь читает АКТУАЛЬНОЕ значение под SELECT...FOR UPDATE
        // (тот же лок, что и в attack()/skills.upgrade() — одна и та же строка игрока) и пишет
        // результат ОТДЕЛЬНЫМ UPDATE прямо здесь. Больше НЕ мутирует $user по ссылке и ничего
        // не сохраняет через общий saveUser() вызывающего — возвращает готовую JSON-строку,
        // которую вызывающий код должен присвоить в $user['skills_levels'] ПОСЛЕ своего
        // saveUser(), иначе тот saveUser() перезапишет поле устаревшим снимком (тот же принцип,
        // что у boss_fight_session/weapons — см. комментарии в attack()).
        //
        // 04.10.2026 (баг найден при написании теста на этот же фикс — "если _rawLink() не
        // смог открыть соединение, финализация считалась, но НИКОГДА не сохранялась": в
        // фолбэк-случае функция просто возвращала JSON, ничего не записывая — а вызывающий
        // код (claimKill()/endFightSession()) присваивал его в $user ТОЛЬКО ПОСЛЕ своего
        // saveUser(), то есть слишком поздно для этого же запроса). Теперь возврат — массив
        // ['json'=>…, 'locked'=>bool]: 'locked'=true — уже записано отдельным UPDATE,
        // вызывающий присваивает в $user ПОСЛЕ своего saveUser(); 'locked'=false — лока не
        // было, вызывающий ОБЯЗАН присвоить в $user ДО своего saveUser(), иначе результат
        // потеряется молча.
        private function _finalizeSkillSession($user){
            $sCatalog = $this->ops->catalog('skills_config');
            $uid = intval($this->registry['uid']);

            $link = $this->_rawLink();
            if($link){
                $link->begin_transaction();
                $res = $link->query("SELECT `skills_levels` FROM `{$this->registry['utb']}` WHERE `id`=$uid FOR UPDATE");
                $row = ($res && $res->num_rows > 0) ? $res->fetch_assoc() : null;
                $userForState = $row ? array_merge($user, ['skills_levels' => $row['skills_levels']]) : $user;
                $state = $this->_loadSkillsState($userForState);

                $earned = $this->_skillEarnedPoints($sCatalog, intval($state['dmgSpent']));
                $state['dmgSpent'] = $this->_skillTotalDmgForPoints($sCatalog, $earned);
                $json = json_encode($state);

                $link->query("UPDATE `{$this->registry['utb']}` SET `skills_levels`='".$link->real_escape_string($json)."' WHERE `id`=$uid");
                $link->commit();
                $link->close();
                return ['json' => $json, 'locked' => true];
            }

            // Фолбэк без лока (не удалось открыть отдельное соединение) — лучше редкий шанс
            // гонки, чем полностью заблокированный выход из боя.
            $state = $this->_loadSkillsState($user);
            $earned = $this->_skillEarnedPoints($sCatalog, intval($state['dmgSpent']));
            $state['dmgSpent'] = $this->_skillTotalDmgForPoints($sCatalog, $earned);
            return ['json' => json_encode($state), 'locked' => false];
        }

        // Фиксирует ИСТИННОЕ окончание боя без победы (таймаут/форфейт "выйти из боя") — client
        // fire-and-forget, та же роль, что claimKill() уже играет для победы (см.
        // _finalizeSkillSession() выше). Без этого прогресс скиллов, накопленный за брошенную
        // попытку без левелапа, навсегда оставался бы засчитанным — то, что чинили ещё
        // 18.09.2026 на клиенте (skills.js.resetSession()/forfeitSession()), теперь должно
        // повториться на сервере, раз dmgSpent больше не client-writable.
        //
        // 24.09.2026 (РЕВЕРТ — крестик БОЛЬШЕ не вызывает этот эндпоинт, см. подробный коммент
        // у bosses_fight.js._leaveBossesFight): крестик просто закрывает экран, бой не окончен,
        // его можно продолжить — эта функция теперь вызывается только для реальных концов боя
        // (победа/поражение/таймаут), не для скрытия экрана.
        //
        // 24.09.2026 (баг "на попапе поражения висит чужой/давний урон в 'УЧАСТНИКИ БОЯ'", по
        // прямому указанию + скриншот): раньше _showBossResultPopup() для isWin:false вообще
        // не получал top — PIXI-строки панели переиспользуются между открытиями попапа и молча
        // показывали то, что там осталось с ПРОШЛОГО раза (старая победа/дев-тест), а не текущий
        // бой. Плюс отдельная проблема: клиент сбрасывал bossStartMs ОПТИМИСТИЧНО локально и
        // тут же слал это отдельным users.save() (flushPlayerSave) ПАРАЛЛЕЛЬНО с этим самым
        // запросом — если та запись доезжала до БД раньше, topEntries здесь считались бы уже
        // по обнулённому bossStartMs и получали пустой топ (тот же класс гонки, что чинили для
        // bosses.attack/claimKill, см. suspendPlayerSave() в player-save.js). Теперь: топ
        // считается ЗДЕСЬ (принимает boss_id/diff_idx), ДО сброса bossStartMs, а сам сброс тоже
        // переехал сюда — единственный писатель этого поля для пути "поражение", клиентский
        // parallel-флаш больше физически не может его обогнать (см. suspendPlayerSave() вокруг
        // вызова этого эндпоинта в bosses-combat.js/bosses_fight.js).
        function endFightSession(){
            $bossId  = isset($this->registry['user_params']['boss_id'])  ? intval($this->registry['user_params']['boss_id'])  : -1;
            $diffIdx = isset($this->registry['user_params']['diff_idx']) ? intval($this->registry['user_params']['diff_idx']) : -1;

            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            $top = [];
            $patchKeys = ['skills_levels'];

            if($bossId >= 0 && $bossId <= 7 && $diffIdx >= 0 && $diffIdx <= 3){
                $data = $this->_decodeBossesData($user['bosses_data'] ?? null);
                if(!is_array($data)) $data = [];

                $friendIds = ($diffIdx !== 3 && !empty($user['friends'])) ? $this->_friendIds($user) : [];
                // 04.10.2026 (тот же баг, что в rating()/claimKill() — см. подробный комментарий
                // в rating()): _ratingTop() ожидает карту uid=>effectiveSinceMs ($friendsSince),
                // а не сырой список uid ($friendIds) — раньше сюда передавался именно сырой
                // список, и друзья никогда не попадали в «участники боя» этого попапа.
                $endFightStartMs = $this->_myFightStart($data, $diffIdx, $bossId);
                $friendsSince = (!empty($friendIds) && $endFightStartMs > 0) ? $this->_friendsSinceMap($user, $friendIds, $endFightStartMs) : [];
                $link = $this->_rawLink();
                if($link){
                    $top = $this->_ratingTop($link, abs(intval($this->registry['uid'])), strval($user['nick'] ?? ''), $bossId, $diffIdx, $data, $friendsSince);
                    $link->close();
                }

                if(isset($data['bossStartMs'][$diffIdx][$bossId]) && intval($data['bossStartMs'][$diffIdx][$bossId]) > 0){
                    $data['bossStartMs'][$diffIdx][$bossId] = 0;
                }

                // 25.09.2026 (РЕВЕРТ по прямому указанию — "верни ту механику"): кулдаун
                // бесплатного оружия снова сбрасывается на любое завершение боя (таймаут/
                // поражение/выход) — этот эндпоинт вызывается ровно для этих случаев (см.
                // большой коммент над endFightSession() выше). Победа сбрасывает его отдельно
                // в claimKill(). Пишем безусловно (не только внутри if выше), т.к. бой мог
                // закончиться и без активного bossStartMs (например, повторный вызов) — кулдаун
                // всё равно должен обновиться.
                $data['freeWpnCdMs'] = [];
                $user['bosses_data'] = json_encode($data);
                $patchKeys[] = 'bosses_data';
            }

            // 04.10.2026: _finalizeSkillSession() теперь сама лочит строку и пишет
            // skills_levels отдельным UPDATE (не мутирует $user) — присваиваем результат В
            // $user ДО saveUser() ТОЛЬКО если лока не было (иначе результат потеряется), см.
            // комментарий в самой функции.
            $skillsResult = $this->_finalizeSkillSession($user);
            if(!$skillsResult['locked']) $user['skills_levels'] = $skillsResult['json'];
            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
            $user['skills_levels'] = $skillsResult['json'];
            $patch = $this->ops->patchCurrencies($user, $patchKeys);
            $this->ops->ok(['patch' => $patch, 'top' => $top]);
        }

        // ── SERVER-AUTHORITATIVE УДАР (22.09.2026, по прямому указанию — "перенеси весь бой на
        // сервер: урон, крит, скиллы, банда, расход оружия, кулдаун бесплатного оружия") ──
        //
        // Клиент шлёт ТОЛЬКО намерение (каким оружием и с каким множителем патронов бьёт), а
        // урон/крит/бонусы скиллов/бонус банды/расход патронов/кулдаун бесплатного оружия
        // считает и проверяет СЕРВЕР — по тем же формулам и тем же таблицам, что раньше жили в
        // bosses-combat.js/weapons.js/skills.js/gangs.js (сверено построчно при переносе).
        //
        // HP — личный кэш в boss_fight_session (24.09.2026, см. _syncFightSession() выше).
        // Каждый удар пишется в boss_damage_log (источник правды для истории/рейтинга) И
        // напрямую вычитается из кэша — без пересчёта SUM() на каждый удар.
        //
        // ЧТО ОСОЗНАННО НЕ ПЕРЕНЕСЕНО (см. итоговое сообщение пользователю): прогресс скиллов
        // (skillsDmgSpent — сколько урона накоплено на СЛЕДУЮЩЕЕ очко скилла) остаётся
        // client-reported, как и раньше (см. комментарий в skills.php) — это отдельный, более
        // крупный фронт (сессии скиллов, левел-апы, ачивки), не связанный напрямую с расчётом
        // урона по боссу.
        function attack(){
            $bossId   = intval($this->registry['user_params']['boss_id']   ?? -1);
            $diffIdx  = intval($this->registry['user_params']['diff_idx']  ?? -1);
            $weaponId = intval($this->registry['user_params']['weapon_id'] ?? -1);
            $mult     = intval($this->registry['user_params']['mult']      ?? 1);

            if($bossId < 0 || $bossId > 7 || $diffIdx < 0 || $diffIdx > 3) return $this->ops->fail(54);
            if($weaponId < 0 || $weaponId > 5) return $this->ops->fail(54);

            $wCatalog = $this->ops->catalog('weapons_config');
            $isFree = $weaponId <= 2;
            if($isFree){
                $mult = 1;
            } else if(!in_array($mult, $wCatalog['mult_options'], true)){
                return $this->ops->fail(54); // некорректный множитель патронов
            }

            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            $data = $this->_decodeBossesData($user['bosses_data'] ?? null);
            if(!is_array($data)) $data = [];

            $uid = abs(intval($this->registry['uid']));
            $bossStartMs = $this->_myFightStart($data, $diffIdx, $bossId);
            if($bossStartMs <= 0) return $this->ops->fail(65); // бой не начат через сервер
            $now = intval(round(microtime(true) * 1000));
            if(($now - $bossStartMs) >= $this->MAX_FIGHT_WINDOW_MS) return $this->ops->fail(66); // бой протух

            // Оружие: экипировано ли, хватает ли патронов/кулдауна.
            $weapons = $this->_loadWeaponsLocal($user);
            $wp = $weapons[$weaponId];
            if(!$isFree){
                if(empty($wp['owned'])) return $this->ops->fail(89); // оружие не куплено
                if(intval($wp['qty'] ?? 0) < $mult) return $this->ops->fail(87); // недостаточно оружия/патронов на этот удар
            } else {
                $cdMap = (isset($data['freeWpnCdMs']) && is_array($data['freeWpnCdMs'])) ? $data['freeWpnCdMs'] : [];
                $lastUse = $this->_freeWpnSharedLastUse($cdMap);
                if($lastUse > 0 && ($now - $lastUse) < $this->FREE_WPN_CD_MS) return $this->ops->fail(88); // кулдаун бесплатного удара (общий на все три бесплатных оружия)
            }

            // Урон: база оружия + тир апгрейда + "Зал оружия" + флэт-скилл, крит — своя сумма ×
            // множитель банды, всё как в bosses-combat.js._attack (сверено построчно).
            $tierBonus = intval($wCatalog['tier_damage'][min(20, intval($wp['upg'] ?? 0))] ?? 0);
            // 25.09.2026 (по прямому указанию — "убираем эту механику"): бонус "Зала оружия"
            // (+1 урона за каждый пройденный порог накопленного total_damage) убран целиком.
            $baseDmgWpn = intval($wCatalog['base_damage'][$weaponId]) + $tierBonus;

            $weapKey = $wCatalog['weapon_key'][$weaponId];
            $sCatalog = $this->ops->catalog('skills_config');
            $skillsState = $this->_loadSkillsState($user);
            $levels = $skillsState['levels'];
            $flatSkill = 0; $critChance = 0;
            foreach($sCatalog['skills'] as $i => $sk){
                $lvl = intval($levels[$i] ?? 0);
                if($lvl <= 0 || $sk['weapon'] !== $weapKey) continue;
                $maxLvl = intval($sCatalog['max_lvl'][$i]);
                if($maxLvl <= 0) continue;
                $bonus = intval(floor($sk['totalBonus'] * $lvl / $maxLvl));
                if($sk['type'] === 'flat') $flatSkill += $bonus;
                else if($sk['type'] === 'crit') $critChance += $bonus;
            }

            // 22.09.2026 (по прямому указанию): бонус банды на урон закомментирован — банды как
            // реальная, доигранная до конца фича с рабочим бонусом на урон в бою пока не
            // существуют в игре. $gangDmg зафиксирован в 1 (нейтрально), чтобы не считать бонус,
            // которого по факту нет. Раскомментировать (вернуть `1 + $this->_gangBonus($user,
            // 'damage') / 100`), когда банды реально заработают. Бонусы банды на exp/монеты
            // (claimKill() ниже) банд это НЕ касается — они уже реальные и работают.
            $gangDmg = 1;

            // Бонусы владеемых вещей — единственный источник характеристик серверный
            // каталог. Плоский бонус действует только на соответствующий тип оружия, поэтому
            // шмот с +N к автомату не усиливает пистолет или мачете.
            //
            // 28.09.2026 (по прямому указанию — новая экономика бонусов шмота): раньше бонус
            // давали только НАДЕТЫЕ вещи (`equipped`), теперь достаточно ПОЛУЧИТЬ вещь
            // (`owned`) — надевать необязательно. Бонусы от ВСЕХ владеемых предметов с одним
            // и тем же bk СКЛАДЫВАЮТСЯ (цикл ниже и раньше суммировал все совпадения, менять
            // саму логику сложения не пришлось — только условие фильтра).
            $shmotCatalog = $this->ops->catalog('shmot_items');
            $shmotState = $this->ops->j($user, 'shmot', []);
            $shmotDmgPct = 0; $shmotFlat = 0;
            $weaponShmotKey = ['machete' => 'machete_flat', 'gun' => 'gun_flat', 'auto' => 'auto_flat'][$weapKey] ?? null;
            foreach($shmotCatalog as $it){
                if(!isset($it['cat'])) continue; // старые id0-40 без 'cat' — удалены из клиента 23.09.2026, мёртвый код
                $iid = intval($it['id']);
                if(empty($shmotState[$iid]['owned'])) continue;
                $bonusKey = $it['bk'] ?? '';
                if($bonusKey === 'damage') $shmotDmgPct += intval($it['bv']);
                if($weaponShmotKey !== null && $bonusKey === $weaponShmotKey) $shmotFlat += intval($it['bv']);
            }
            $shmotDmgMult = 1 + $shmotDmgPct / 100;

            // mt_rand(0,999999)/10000 даёт равномерный процент 0.00-99.99 — та же точность, что
            // JS Math.random()*100 нужна для сравнения с целочисленным critChance.
            $critRoll = mt_rand(0, 999999) / 10000;
            $isCrit = $critChance > 0 && $critRoll < $critChance;
            $damage = intval(floor(($baseDmgWpn + $flatSkill + $shmotFlat) * ($isCrit ? 1.5 : 1) * $gangDmg * $shmotDmgMult)) * $mult;
            if($damage <= 0) $damage = 1;

            $maxHp = $this->BOSS_HP[$bossId][$diffIdx];

            $link = $this->_rawLink();
            if(!$link) return $this->ops->fail(99);

            // ── HP до удара — из личного кэша (_syncFightSession подтягивает свежий урон
            // друзей курсором перед тем, как применить мой удар) ────
            // 30.09.2026 (тот же баг, что в startFight()/claimKill() — см. комментарий там):
            // раньше сюда передавался сырой $friendIds вместо карты $friendsSince, из-за чего
            // урон друга на КАЖДОЙ атаке фактически не подхватывался (мусорное SQL-условие).
            $friendIds = ($diffIdx !== 3 && !empty($user['friends'])) ? $this->_friendIds($user) : [];
            $friendsSince = $this->_friendsSinceMap($user, $friendIds, $bossStartMs);
            // 04.10.2026: под блокировкой строки (см. _syncFightSessionLocked()) — найдено на
            // реальных прод-данных: без лока параллельный friendsDamage()-опрос мог прочитать
            // тот же устаревший кэш и своим более поздним saveUser() затереть именно ЭТОТ удар.
            $session = $this->_syncFightSessionLocked($link, $uid, $diffIdx, $bossId, $bossStartMs, $friendsSince);
            $hpBefore = intval($session['hp']);

            $newHp = max(0, $hpBefore - $damage);
            $session['hp'] = $newHp;
            // Коммитим СРАЗУ (снимает блокировку строки) — INSERT ниже и списание патронов это
            // уже отдельные, самостоятельные операции, им эта блокировка не нужна.
            $this->_commitFightSession($link, $uid, $session);

            // 26.09.2026 (по прямому указанию — "бью х10, урон 2к/10к, а при победе фиксирует
            // хп босса 1к, но отображать в попапе победы нужно ровно столько, сколько ударил"):
            // раньше здесь писался dealt=min(hpBefore,damage) — урон, ОБРЕЗАННЫЙ по
            // остатку HP босса (та же величина уходила в total_damage/personalDamageTotal/
            // очки скиллов ниже). Теперь везде — РЕАЛЬНЫЙ расчётный $damage без обрезки: боевой
            // множитель (mult) — это осознанная ставка патронами, добивающий удар "с запасом"
            // не даёт скидку ни на патроны (см. блок списания ниже), ни на итоговую цифру в
            // рейтинге/попапе победы (boss_damage_log — источник top в claimKill()/rating()),
            // ни на прогресс скиллов. Единственное, что остаётся ограниченным остатком HP —
            // сам HP босса ($newHp = max(0, ...) выше), это не связанная величина.
            $critInt = $isCrit ? 1 : 0;
            $stmt = $link->prepare('INSERT INTO `boss_damage_log` (`uid`,`boss_id`,`diff_idx`,`damage`,`critical`,`time`) VALUES (?,?,?,?,?,?)');
            $stmt->bind_param('iiiiii', $uid, $bossId, $diffIdx, $damage, $critInt, $now);
            $stmt->execute();
            $stmt->close();

            // 23.09.2026 (по прямому указанию, превентивно — тот же класс логирования, что у
            // блэкджека после репорта "выпала AA хотя pity ещё далеко"): полная раскладка
            // расчёта урона + HP на момент удара, для error_log и debug-ответа клиенту.
            $damageDebugPre = [
                'weaponId' => $weaponId, 'isFree' => $isFree, 'mult' => $mult,
                'baseDmgWpn' => $baseDmgWpn, 'tierBonus' => $tierBonus,
                'flatSkill' => $flatSkill, 'critChance' => $critChance, 'critRoll' => $critRoll, 'isCrit' => $isCrit,
                'gangDmg' => $gangDmg, 'shmotDmgPct' => $shmotDmgPct, 'shmotDmgMult' => $shmotDmgMult,
                'damageFormulaResult' => $damage, 'bossStartMs' => $bossStartMs,
                'friendIds' => $friendIds, 'sessionCursorId' => $session['cursorId'] ?? null,
                'maxHp' => $maxHp, 'hpBefore' => $hpBefore, 'newHp' => $newHp,
            ];

            // 26.09.2026 (по прямому указанию — "оружка тратится согласно тому сколько и
            // ударил, похуй на хп босса"): раньше добивающий удар при mult>1 "экономил"
            // патроны — списывал только столько единиц mult, сколько реально требовалось для
            // оставшегося HP. Теперь множитель — это твёрдая ставка: выбрал mult=10, значит
            // потратил 10 патронов этим ударом целиком, независимо от того, хватило бы и
            // меньшего mult, чтобы добить босса.
            if(!$isFree){
                // 26.09.2026 (аудит перед модерацией VK — гонка параллельных запросов): раньше
                // здесь было read-modify-write БЕЗ блокировки — $weapons был прочитан в начале
                // attack() через обычный ops->loadUser() (своё отдельное соединение), и два
                // параллельных запроса могли оба пройти проверку qty>=mult на одном и том же
                // устаревшем значении, оба списать и оба нанести урон — патроны спишутся
                // фактически один раз (lost update), урон засчитается дважды. SELECT...FOR
                // UPDATE держит блокировку строки игрока до COMMIT — второй параллельный запрос
                // физически ждёт эту транзакцию и видит УЖЕ уменьшённое значение, либо получает
                // честный fail(87), если патронов на самом деле не хватает.
                $link->begin_transaction();
                $lockRes = $link->query("SELECT `weapons` FROM `{$this->registry['utb']}` WHERE `id`=".intval($this->registry['uid'])." FOR UPDATE");
                $lockRow = ($lockRes && $lockRes->num_rows > 0) ? $lockRes->fetch_assoc() : null;
                $lockedWeapons = $lockRow ? json_decode($lockRow['weapons'], true) : null;
                if(!is_array($lockedWeapons)) $lockedWeapons = $weapons; // крайне маловероятный фолбэк, чтобы не ронять запрос

                $lockedQty = intval($lockedWeapons[$weaponId]['qty'] ?? 0);
                if($lockedQty < $mult){
                    $link->rollback();
                    $link->close();
                    return $this->ops->fail(87); // патроны кончились между первой проверкой и списанием — гонка параллельных запросов
                }

                $lockedWeapons[$weaponId]['qty'] = $lockedQty - $mult;
                $newWeaponsJson = json_encode($lockedWeapons);
                $link->query("UPDATE `{$this->registry['utb']}` SET `weapons`='".$link->real_escape_string($newWeaponsJson)."' WHERE `id`=".intval($this->registry['uid']));
                $link->commit();

                // Синхронизируем локальные переменные с реально сохранённым значением — код
                // ниже читает $weapons[$weaponId]['qty'] для ответа клиенту и патча.
                $weapons = $lockedWeapons;
                $user['weapons'] = $newWeaponsJson;
            } else {
                if(!isset($data['freeWpnCdMs']) || !is_array($data['freeWpnCdMs'])) $data['freeWpnCdMs'] = [];
                // Общий кулдаун — удар ЛЮБЫМ бесплатным оружием ставит на откат ВСЕ три
                // (не только то, которым ударили), см. $FREE_WPN_IDS выше.
                foreach($this->FREE_WPN_IDS as $fw) $data['freeWpnCdMs'][$fw] = $now;
            }
            $link->close();

            // 26.09.2026 (по прямому указанию — "в очки скиллов придёт только урон который ты
            // ударил, похуй на хп босса"): пожизненные метрики и прогресс скиллов считаются по
            // РЕАЛЬНОМУ расчётному $damage удара, без обрезки по остатку HP босса — тот же
            // принцип, что и в boss_damage_log/списании патронов выше. Это осознанный реверс
            // фикса от 24.09.2026 (там наоборот обрезали до $dealt, чтобы сумма урона за бой не
            // превышала maxHp) — теперь превышение специально разрешено: множитель считается
            // "инвестицией", результат которой не срезается из-за случайного остатка HP.
            $this->ops->add($user, 'total_damage', $damage);
            if(!isset($data['personalDamageTotal'])) $data['personalDamageTotal'] = 0;
            $data['personalDamageTotal'] = intval($data['personalDamageTotal']) + $damage;
            if(!isset($data['bossDamage']) || !is_array($data['bossDamage'])) $data['bossDamage'] = array_fill(0, 8, 0);
            while(count($data['bossDamage']) < 8) $data['bossDamage'][] = 0;
            $data['bossDamage'][$bossId] = intval($data['bossDamage'][$bossId]) + $damage;

            // Прогресс скиллов (22.09.2026) — растёт ТОЛЬКО здесь, на реальный только что
            // посчитанный урон. Кап на total_points (460, ~20кк урона) — дальше копить смысла
            // нет, тот же принцип, что у skills.js.addFightDamage() был на клиенте.
            //
            // 04.10.2026 (аудит гонок состояний): skills.php.upgrade() мутирует ТО ЖЕ самое
            // skills_levels обычным loadUser()/saveUser() без лока — $skillsState выше прочитан
            // в начале attack() ДО удара и мог устареть, если игрок параллельно прокачал навык
            // (или если второй attack() того же игрока прилетел почти одновременно). Тот же
            // приём, что уже применён к weapons чуть выше в этой же функции — SELECT...FOR
            // UPDATE на строке держит её до COMMIT, второй параллельный запрос (другой attack()
            // ИЛИ skills.upgrade() — оба теперь используют одноимённую блокировку строки)
            // реально ждёт и видит уже обновлённое значение, а не гонит lost update. НЕ
            // присваиваем $user['skills_levels'] здесь — присвоение переносится ПОСЛЕ saveUser()
            // ниже (см. тот же приём у boss_fight_session чуть ниже), иначе общий saveUser()
            // перезаписал бы поле устаревшим снимком, загруженным в начале функции.
            $skLink = $this->_rawLink();
            if($skLink){
                $skLink->begin_transaction();
                $skRes = $skLink->query("SELECT `skills_levels` FROM `{$this->registry['utb']}` WHERE `id`=".intval($this->registry['uid'])." FOR UPDATE");
                $skRow = ($skRes && $skRes->num_rows > 0) ? $skRes->fetch_assoc() : null;
                $skUserForState = $skRow ? array_merge($user, ['skills_levels' => $skRow['skills_levels']]) : $user;
                $skillsState = $this->_loadSkillsState($skUserForState);

                if($this->_skillEarnedPoints($sCatalog, intval($skillsState['dmgSpent'])) < intval($sCatalog['total_points'])){
                    $skillsState['dmgSpent'] = intval($skillsState['dmgSpent']) + $damage;
                }
                $this->_syncSkillPoints($skillsState, $sCatalog);
                $finalSkillsJson = json_encode($skillsState);

                $skLink->query("UPDATE `{$this->registry['utb']}` SET `skills_levels`='".$skLink->real_escape_string($finalSkillsJson)."' WHERE `id`=".intval($this->registry['uid']));
                $skLink->commit();
                $skLink->close();
            } else {
                // 04.10.2026 (баг найден при написании теста на этот же фикс — "если
                // _rawLink() не смог открыть соединение, прогресс скиллов считался, но
                // НИКОГДА не сохранялся": прямой UPDATE выше пропускался, а отложенное
                // присвоение $user['skills_levels'] происходило бы уже ПОСЛЕ saveUser(), то
                // есть слишком поздно для этого же запроса). Без лока — сохраняем как раньше:
                // лучше редкий шанс гонки, чем полностью потерянный прогресс.
                if($this->_skillEarnedPoints($sCatalog, intval($skillsState['dmgSpent'])) < intval($sCatalog['total_points'])){
                    $skillsState['dmgSpent'] = intval($skillsState['dmgSpent']) + $damage;
                }
                $this->_syncSkillPoints($skillsState, $sCatalog);
                $finalSkillsJson = json_encode($skillsState);
                $user['skills_levels'] = $finalSkillsJson;
            }

            // boss_fight_session уже атомарно сохранён выше (_commitFightSession) — НЕ
            // присваиваем его здесь, иначе этот saveUser() перезаписал бы его значением,
            // загруженным ДО блокировки (устаревшим относительно только что закоммиченного).
            $user['bosses_data'] = json_encode($data);
            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);

            // skills_levels — тот же принцип, что bosses_data/boss_fight_session выше: только
            // ТЕПЕРЬ, после saveUser(), можно безопасно подставить свежее значение в $user для
            // patch/debug ниже — сам saveUser() уже прошёл и не может перезаписать его заново.
            // Если лок не удался, $user['skills_levels'] уже выставлен ВЫШЕ (до saveUser()) —
            // переприсвоение того же значения здесь безвредно (идемпотентно).
            $user['skills_levels'] = $finalSkillsJson;

            $verifyUser = $this->ops->loadUser(['id', 'bosses_data']);
            $verifyRaw  = $verifyUser ? ($verifyUser['bosses_data'] ?? null) : '!!! loadUser() ПОСЛЕ save вернул null !!!';
            $saveVerifyMismatch = !$this->ops->sameJsonState($user['bosses_data'], $verifyRaw);

            $debug = $damageDebugPre + [
                'fn' => 'attack', 'uid' => $uid, 'bossId' => $bossId, 'diffIdx' => $diffIdx,
                'time' => date('Y-m-d H:i:s'), 'microtime' => microtime(true),
                'rawParams' => $this->registry['user_params'],
                'sessionSavedRaw' => $user['bosses_data'],
                'sessionVerifiedFromDbAfterSave' => $verifyRaw,
                'saveVerifyMismatch' => $saveVerifyMismatch,
            ];
            error_log('[bosses.attack] ' . json_encode($debug)
                . ($saveVerifyMismatch ? ' !!! ЗАПИСАННОЕ И ПРОЧИТАННОЕ ОБРАТНО ЗНАЧЕНИЕ РАЗОШЛИСЬ !!!' : ''));

            $patchKeys = ['total_damage', 'bosses_data', 'skills_levels'];
            if(!$isFree){
                $patchKeys[] = 'weapons';
                $ammoKeys = [3 => 'ammo_machete', 4 => 'ammo_gun', 5 => 'ammo_auto'];
                if(isset($ammoKeys[$weaponId])){
                    $user[$ammoKeys[$weaponId]] = strval($weapons[$weaponId]['qty']);
                    $patchKeys[] = $ammoKeys[$weaponId];
                }
            }
            $patch = $this->ops->patchCurrencies($user, $patchKeys);

            $this->ops->ok([
                'patch' => $patch,
                'damage' => $damage,
                'critical' => $critInt,
                'hp' => $newHp,
                'maxHp' => $maxHp,
                'qty' => $isFree ? null : $weapons[$weaponId]['qty'],
                'debug' => $debug,
            ]);
        }

        // 26.09.2026 (новая фича — попап перезарядки бесплатного оружия с кнопкой «Ускорить за
        // 20»): раньше сброс кулдауна бесплатного удара (bosses-combat.js.resetFreeWeaponCd)
        // тратил рубли ПРЯМО НА КЛИЕНТЕ (udata['coins'] -= 20, без единого похода на сервер) —
        // читер мог вызвать bosses.resetFreeWeaponCd() из консоли и сбросить кулдаун бесплатно,
        // либо заранее подменить udata['coins']. По Правилу №9 (новая экономика — только на
        // сервере) сброс перенесён сюда: сервер сам проверяет, что оружие бесплатное (0-2) и
        // реально сейчас на кулдауне, сам списывает рубли через Gameops::deduct() и сам обнуляет
        // freeWpnCdMs — общий кулдаун на все три бесплатных оружия (см. $FREE_WPN_IDS выше) —
        // клиент только шлёт намерение и применяет patch.
        //
        // 28.09.2026 (по прямому указанию — общий КД): weaponId в запросе больше не выбирает,
        // КАКОЕ оружие сбросить (кулдаун один на все три) — оставлен только для валидации
        // "это вообще бесплатное оружие" (0-2) и для error_log, само списание/сброс всегда
        // затрагивает все три ключа разом.
        function rushFreeWeapon(){
            $weaponId = intval($this->registry['user_params']['weapon_id'] ?? -1);
            if($weaponId < 0 || $weaponId > 2) return $this->ops->fail(54); // только бесплатное оружие: нож(0)/цепь(1)/бита(2)

            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            $data = $this->_decodeBossesData($user['bosses_data'] ?? null);
            if(!is_array($data)) $data = [];
            $cdMap = (isset($data['freeWpnCdMs']) && is_array($data['freeWpnCdMs'])) ? $data['freeWpnCdMs'] : [];
            $lastUse = $this->_freeWpnSharedLastUse($cdMap);
            $now = intval(round(microtime(true) * 1000));
            if($lastUse <= 0 || ($now - $lastUse) >= $this->FREE_WPN_CD_MS) return $this->ops->fail(53); // бесплатное оружие уже не на кулдауне

            $cost = 20;
            if(!$this->ops->deduct($user, 'coins', $cost)) return $this->ops->fail(50); // недостаточно рублей
            $this->ops->add($user, 'coins_spent', $cost);

            foreach($this->FREE_WPN_IDS as $fw) $cdMap[$fw] = 0;
            $data['freeWpnCdMs'] = $cdMap;
            $user['bosses_data'] = json_encode($data);
            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);

            error_log('[bosses.rushFreeWeapon] uid=' . abs(intval($this->registry['uid'])) . ' weaponId=' . $weaponId . ' cost=' . $cost . ' coinsAfter=' . intval($user['coins']) . ' (сброшен ОБЩИЙ кулдаун всех трёх бесплатных видов)');

            $patch = $this->ops->patchCurrencies($user, ['coins', 'coins_spent', 'bosses_data']);
            $this->ops->ok(['patch' => $patch]);
        }

        // ── УРОН "СЕДОЙ" (26.09.2026, баг найден по прямому указанию — "боевка вылетает с
        // ошибкой, когда босс убит уроном седого") ──
        //
        // Урон седого раньше был чисто client-only механикой (bosses_fight.js._useSedoyDamage —
        // вычитала HP локально через bosses._setHp() и сразу звала bosses._onDefeat()), но
        // НИКОГДА не писалась в boss_damage_log — единственный источник правды для серверного
        // HP (см. _syncFightSession() выше). Итог: клиент видел свой локальный HP=0 и запускал
        // claimKill(), а сервер честно пересчитывал HP заново из лога, видел его ещё > 0 (седой
        // там не значился) и отвечал fail(67) — экран боя вылетал с ошибкой вместо победного
        // попапа. Теперь урон седого — такой же реальный удар, как в attack(): пишется в
        // boss_damage_log (значит попадает и в производный HP, и в _ratingTop() — рейтинг урона
        // друзей ВНУТРИ этого боя), но НЕ трогает skills_levels.dmgSpent (тот растёт только
        // внутри attack(), см. комментарий там).
        //
        // 28.09.2026 (по прямому указанию — "урон седого не должен засчитываться в топ по
        // урону, аналогично скиллам"): раньше сюда же добавлялся `total_damage` — тот же
        // lifetime-счётчик, что кормит ГЛОБАЛЬНЫЙ топ игроков по урону (top.php, сортировка по
        // `total_damage`) и задания на суммарный урон (`zadaniya_config.json`/`tasks_pool.json`,
        // ключ total_damage). Это не то же самое, что _ratingTop() выше — тот считает урон по
        // ОДНОМУ боссу ВНУТРИ текущего боя из boss_damage_log, и седой там по-прежнему
        // учитывается (иначе HP босса не сойдётся с фактически нанесённым уроном друзей).
        // `total_damage` теперь удар седого больше не увеличивает вообще — ни в топе, ни в
        // заданиях/личной статистике он считаться не должен.
        function useSedoy(){
            $bossId  = intval($this->registry['user_params']['boss_id']  ?? -1);
            $diffIdx = intval($this->registry['user_params']['diff_idx'] ?? -1);
            if($bossId < 0 || $bossId > 7 || $diffIdx < 0 || $diffIdx > 3) return $this->ops->fail(54);
            // 30.09.2026 (по прямому указанию — "урон Седого нельзя использовать в Соло"):
            // серверная сторона того же блока, что и в bosses_fight.js._useSedoyDamage() —
            // клиентская проверка не спасает от прямого запроса с diff_idx=3 в обход UI.
            if($diffIdx === 3) return $this->ops->fail(90); // Соло — "один на один", без Седого

            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            $data = $this->_decodeBossesData($user['bosses_data'] ?? null);
            if(!is_array($data)) $data = [];

            $uid = abs(intval($this->registry['uid']));
            $bossStartMs = $this->_myFightStart($data, $diffIdx, $bossId);
            if($bossStartMs <= 0) return $this->ops->fail(65); // бой не начат через сервер
            $now = intval(round(microtime(true) * 1000));
            if(($now - $bossStartMs) >= $this->MAX_FIGHT_WINDOW_MS) return $this->ops->fail(66); // бой протух

            $sedoyLeft = $this->ops->i($user, 'sedoy_dmg_left');
            if($sedoyLeft <= 0) return $this->ops->fail(68); // урон седого на сегодня исчерпан

            $link = $this->_rawLink();
            if(!$link) return $this->ops->fail(99);

            // Тот же личный производный HP-кэш, что и у attack() — седой бьёт МОЕГО текущего
            // босса, поэтому подтягиваем свежий урон друзей курсором точно так же, прежде чем
            // накладывать удар седого поверх.
            // 30.09.2026 (тот же баг, что в startFight()/attack()/claimKill() — см. комментарии
            // там): это ПЯТОЕ место, где сырой $friendIds передавался вместо карты $friendsSince —
            // пропущено при первом проходе фикса, найдено регресс-тестом
            // boss-friendssince-map-all-call-sites.test.js (он считает ВСЕ вызовы
            // _syncFightSession() в файле, а не только 4 ожидаемых).
            $friendIds = ($diffIdx !== 3 && !empty($user['friends'])) ? $this->_friendIds($user) : [];
            $friendsSince = $this->_friendsSinceMap($user, $friendIds, $bossStartMs);
            // 04.10.2026: под блокировкой строки (см. _syncFightSessionLocked()) — тот же класс
            // гонки, что в attack()/friendsDamage().
            $session = $this->_syncFightSessionLocked($link, $uid, $diffIdx, $bossId, $bossStartMs, $friendsSince);
            $hpBefore = intval($session['hp']);

            // dealt = min(остаток урона седого, текущее HP) — не расходуем больше, чем нужно для
            // добивания, тот же принцип, что был в клиентской версии (bosses_fight.js).
            $dealt = min($sedoyLeft, $hpBefore);
            $newHp = max(0, $hpBefore - $dealt);
            $session['hp'] = $newHp;

            if($dealt > 0){
                // critical=0 — удар седого никогда не критует, это не оружие/навыки/крит-ролл.
                // 29.09.2026 (баг найден по прямому указанию + скриншот — "участники боя
                // показывают урон друга, который на самом деле пришёл от Седого, урон седого
                // не должен рассчитываться друзьям"): is_sedoy=1 (миграция 35) — помечаем ЭТУ
                // строку как удар Седого. 30.09.2026 (уточнение по прямому указанию — "урон
                // седого отправляется друзьям, не должен"): "мой" HP-путь (_damageSumSince() с
                // excludeSedoy=false внутри _syncFightSession()) по-прежнему считает эту строку
                // без фильтра — иначе HP МОЕГО собственного босса не сойдётся с тем, что реально
                // снял мой же Седой. Но "друзья"-путь (_friendsDamageSumSince()/
                // _applyFriendDamage()) теперь ЭТУ строку фильтрует (`is_sedoy=0`) — удар Седого
                // снижает HP ТОЛЬКО тому, кто его купил, и не передаётся взаимным друзьям как
                // помощь. Фильтр по is_sedoy в _ratingTop() (см. комментарий там) — отдельный,
                // более старый случай (там исключается ещё и МОЙ собственный Седой из рейтинга).
                $critZero = 0;
                $isSedoy = 1;
                $stmt = $link->prepare('INSERT INTO `boss_damage_log` (`uid`,`boss_id`,`diff_idx`,`damage`,`critical`,`is_sedoy`,`time`) VALUES (?,?,?,?,?,?,?)');
                $stmt->bind_param('iiiiiii', $uid, $bossId, $diffIdx, $dealt, $critZero, $isSedoy, $now);
                $stmt->execute();
                $stmt->close();
            }
            // Коммитим после INSERT (та же транзакция, что и блокирующий SELECT в
            // _syncFightSessionLocked()) — снимает блокировку строки.
            $this->_commitFightSession($link, $uid, $session);
            $link->close();

            // 28.09.2026: total_damage здесь БОЛЬШЕ НЕ растёт (см. большой комментарий над
            // функцией) — этот удар уже учтён в boss_damage_log/HP выше, этого достаточно для
            // корректной боёвки и внутрибоевого рейтинга друзей; в lifetime-счётчик топа/заданий
            // он попадать не должен.
            // boss_fight_session уже атомарно сохранён выше — НЕ присваиваем его здесь.
            $user['sedoy_dmg_left'] = strval(max(0, $sedoyLeft - $dealt));
            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);

            error_log('[bosses.useSedoy] uid=' . $uid . ' bossId=' . $bossId . ' diffIdx=' . $diffIdx
                . ' dealt=' . $dealt . ' hpBefore=' . $hpBefore . ' newHp=' . $newHp
                . ' sedoyLeftAfter=' . $user['sedoy_dmg_left']);

            $patch = $this->ops->patchCurrencies($user, ['sedoy_dmg_left']);
            $this->ops->ok([
                'patch' => $patch,
                'dealt' => $dealt,
                'hp' => $newHp,
                'maxHp' => $this->BOSS_HP[$bossId][$diffIdx],
            ]);
        }

        // ── SERVER-AUTHORITATIVE НАГРАДА ЗА УБИЙСТВО ──
        //
        // Сервер сам считает сигареты/опыт/ключи/рюкзак/хату/шмот по каталогу
        // json/bosses_config.json (сверен построчно с bosses.js).
        //
        // 23.09.2026 (откат общего boss_instance, см. большой комментарий над
        // _syncFightSession() выше): чтобы получить награду, требуется:
        // 1) бой реально начат через startFight() (bossStartMs > 0) и ещё не протух
        //    (MAX_FIGHT_WINDOW_MS) — fail 65/66;
        // 2) кэш HP (boss_fight_session, свежий урон друга подтянут курсором) реально
        //    ≤ 0 — fail 67, если ещё жив.
        // Дневной лимит попыток (dailyKills, fail 62) проверяется РАНЬШЕ, в startFight() —
        // см. большой комментарий там (29.09.2026, "лимиты атак не заканчиваются") — не здесь.
        // Отдельная таблица клеймов не нужна: в конце функции bossStartMs[diffIdx][bossId]
        // обнуляется — повторный вызов сразу упадёт на fail 65 "бой не начат".
        function claimKill(){
            $bossId  = intval($this->registry['user_params']['boss_id']  ?? -1);
            $diffIdx = intval($this->registry['user_params']['diff_idx'] ?? -1);
            if($bossId < 0 || $bossId > 7 || $diffIdx < 0 || $diffIdx > 3) return $this->ops->fail(54);

            $catalog = $this->_catalog();
            $bossCfg = $catalog['bosses'][$bossId];
            $diffCfg = $catalog['diff_mult'][$diffIdx];
            $limit   = intval($catalog['daily_kill_limit']);

            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            $data = $this->_decodeBossesData($user['bosses_data'] ?? null);
            if(!is_array($data)) $data = [];

            $uid = abs(intval($this->registry['uid']));
            $fightStart = intval($data['bossStartMs'][$diffIdx][$bossId] ?? 0);
            if($fightStart <= 0) return $this->ops->fail(65); // бой не начат через сервер
            $now = intval(round(microtime(true) * 1000));
            $elapsed = $now - $fightStart;
            if($elapsed > $this->MAX_FIGHT_WINDOW_MS) return $this->ops->fail(66); // бой протух

            $hpLink = $this->_rawLink();
            if(!$hpLink) return $this->ops->fail(99);

            // 30.09.2026 (тот же баг, что в startFight()/attack() — см. комментарий там): раньше
            // сюда передавался сырой $hpFriendIds вместо карты $friendsSince — HP-проверка на
            // клейме не подхватывала свежий урон друга, случившийся между последним attack() и
            // самим claimKill() (если friendsDamage() ещё не успел опросить в этот момент).
            // 04.10.2026: НЕ переведено на _syncFightSessionLocked() — эта проверка ничего не
            // пишет обратно (просто гейт curHp<=0 чуть ниже), поэтому лока от lost-update ей не
            // нужно. Возможная цена нелоченного чтения — редкий ложный fail(67) на "бой ещё не
            // добит", если прямо в этот момент параллельно летит чужой attack()/friendsDamage() —
            // безопасно восстанавливается повторным кликом ЗАБРАТЬ, в отличие от молчаливой
            // потери урона в кэше, которую лок в attack()/friendsDamage()/useSedoy() и чинит.
            $hpFriendIds = ($diffIdx !== 3 && !empty($user['friends'])) ? $this->_friendIds($user) : [];
            $hpFriendsSince = $this->_friendsSinceMap($user, $hpFriendIds, $fightStart);
            $hpSession = $this->_syncFightSession($hpLink, $uid, $this->_loadFightSession($user), $diffIdx, $bossId, $fightStart, $hpFriendsSince);
            $hpLink->close();
            $curHp = intval($hpSession['hp']);
            $claimDebug = ['fightStart' => $fightStart, 'elapsed' => $elapsed, 'curHpAtClaim' => $curHp, 'sessionCursorId' => $hpSession['cursorId'] ?? null,];
            if($curHp > 0){
                error_log('[bosses.claimKill] uid=' . $uid . ' ОТКЛОНЕНО (HP ещё > 0): ' . json_encode($claimDebug));
                return $this->ops->fail(67); // HP ещё не дошло до 0 — победа не подтверждена
            }

            // 29.09.2026 (по прямому указанию — "лимит должен тратиться и за победу, и за
            // поражение/таймаут/выход, а не только за победу"): попытка теперь расходуется в
            // startFight() (см. большой комментарий там же), в момент РЕАЛЬНОГО старта боя — не
            // здесь. claimKill() больше НЕ проверяет и НЕ инкрементирует dailyKills (иначе победа
            // считала бы попытку ДВАЖДЫ — один раз в startFight(), второй раз тут). Оставляем
            // только гарантию формы массива — на случай структуры данных, ещё не мигрированной.
            if(!isset($data['dailyKills']) || !is_array($data['dailyKills'])) $data['dailyKills'] = array_fill(0, 8, 0);
            while(count($data['dailyKills']) < 8) $data['dailyKills'][] = 0;

            // Топ участников этой победы (для попапа результата боя) — считаем ДО сброса
            // bossStartMs ниже, тем же _ratingTop(), что и живая панель «РЕЙТИНГ УРОНА».
            // 04.10.2026 (НАЙДЕНО по репорту "урон друзьям приходит, но в попапе победы их нет"):
            // раньше здесь заново строился СЫРОЙ $friendIds и передавался в _ratingTop() вместо
            // карты uid=>effectiveSinceMs — переиспользуем уже готовый $hpFriendsSince (посчитан
            // чуть выше для HP-проверки той же _friendsSinceMap(), тот же $fightStart) — тот же
            // баг, что и в rating()/endFightSession(), см. подробный комментарий в rating().
            $hpLink = $this->_rawLink();
            if(!$hpLink) return $this->ops->fail(99);
            $topEntries = $this->_ratingTop($hpLink, $uid, strval($user['nick'] ?? ''), $bossId, $diffIdx, $data, $hpFriendsSince);
            // Отдельно от topEntries (см. большой комментарий у _sedoyDamageMineSince выше) —
            // сколько снял МОЙ Седой за ЭТУ попытку, для отдельной строки в попапе результата
            // боя, не смешанной с реальным боевым рейтингом. 30.09.2026: урон Седого ДРУГА сюда
            // больше не плюсуется — он больше не влияет на HP этого боя (см. комментарий у
            // _sedoyDamageMineSince()).
            $sedoyDamage = $this->_sedoyDamageMineSince($hpLink, $uid, $bossId, $fightStart);
            $hpLink->close();

            // Награда — та же формула, что bosses.js._calcReward(): base × diff_mult × бонус банды.
            $gangExp = 1 + $this->_gangBonus($user, 'exp_bonus')   / 100;
            $gangCig = 1 + $this->_gangBonus($user, 'coins_bonus') / 100;
            $earnedExp = intval(floor($bossCfg['exp'] * $diffCfg['exp'] * $gangExp));
            $earnedCig = intval(floor($bossCfg['cig'] * $diffCfg['cig'] * $gangCig));

            $this->ops->add($user, 'cigarettes', $earnedCig);
            $this->ops->add($user, 'exp', $earnedExp);

            $user['bosses_killed'] = $this->ops->i($user, 'bosses_killed') + 1;
            // boss_kills_0/1/2 — единственные реальные колонки БД (нужны только 3 конкретным
            // заданиям в zadaniya.js); для остальных боссов колонки просто не существует —
            // попытка сохранить boss_kills_3..7 упадёт fatal error "Unknown column".
            if($bossId <= 2) $user['boss_kills_'.$bossId] = $this->ops->i($user, 'boss_kills_'.$bossId) + 1;

            // Очки рюкзака (по каталогу — те же RYUKZAK_PTS, что в bosses-combat.js._onDefeat).
            //
            // 04.10.2026 (аудит гонок состояний): ryukzak.php.open() читает ryukzak_points и
            // обнуляет его отдельным loadUser()/saveUser() без лока — если игрок открывает
            // рюкзак ровно в момент получения награды за килл, одно из двух сохранений
            // (начисление здесь или обнуление там) могло затереть другое. SELECT...FOR UPDATE
            // на строке держит её до COMMIT — второй параллельный запрос реально ждёт и видит
            // уже актуальное значение. НЕ присваиваем $user['ryukzak_points'] здесь — это
            // сделает общий saveUser() ниже перезаписать поле устаревшим снимком (тот же
            // принцип, что у skills_levels/boss_fight_session выше); присвоение переносится
            // ПОСЛЕ saveUser(), только для patch/debug.
            $ryukzakPts = intval($catalog['ryukzak_pts'][$bossId] ?? 0);
            $rpLink = $this->_rawLink();
            if($rpLink){
                $rpLink->begin_transaction();
                $rpRes = $rpLink->query("SELECT `ryukzak_points` FROM `{$this->registry['utb']}` WHERE `id`=".intval($this->registry['uid'])." FOR UPDATE");
                $rpRow = ($rpRes && $rpRes->num_rows > 0) ? $rpRes->fetch_assoc() : null;
                $freshRyukzakPts = ($rpRow !== null ? intval($rpRow['ryukzak_points']) : $this->ops->i($user, 'ryukzak_points')) + $ryukzakPts;
                $rpLink->query("UPDATE `{$this->registry['utb']}` SET `ryukzak_points`='".intval($freshRyukzakPts)."' WHERE `id`=".intval($this->registry['uid']));
                $rpLink->commit();
                $rpLink->close();
            } else {
                // 04.10.2026 (баг найден при написании теста на этот же фикс — "если
                // _rawLink() не смог открыть соединение, начисление считалось, но НИКОГДА не
                // сохранялось": прямой UPDATE выше пропускался, а отложенное присвоение
                // $user['ryukzak_points'] происходило бы уже ПОСЛЕ saveUser(), то есть
                // слишком поздно для этого же запроса). Без лока — сохраняем как раньше: лучше
                // редкий шанс гонки, чем полностью потерянное начисление.
                $freshRyukzakPts = $this->ops->i($user, 'ryukzak_points') + $ryukzakPts;
                $user['ryukzak_points'] = $freshRyukzakPts;
            }

            // Прогресс хаты — максимальный побеждённый босс (та же логика, что hata_progress в клиенте).
            $curHataProg = intval($this->ops->i($user, 'hata_progress', -1));
            if($bossId > $curHataProg) $user['hata_progress'] = $bossId;

            // Ключи — в обычном (0) и соло (3), живут внутри bosses_data.keys[]. 19.09.2026
            // (баг найден, по прямому указанию): было "diffIdx < 2" — что на практике исключало
            // ТОЛЬКО соло (единственный второй реально доступный режим — опасный/суровый,
            // diffIdx 1/2, пока заблокированы на клиенте, active:false в bosses_prefight.js),
            // то есть соло никогда не давало ключей. Явно перечисляем оба играбельных режима.
            $keysGranted = [];
            if(($diffIdx === 0 || $diffIdx === 3) && !empty($bossCfg['gives_keys'])){
                if(!isset($data['keys']) || !is_array($data['keys'])) $data['keys'] = array_fill(0, 8, 0);
                while(count($data['keys']) < 8) $data['keys'][] = 0;
                foreach($bossCfg['gives_keys'] as $nextIdx){
                    if($nextIdx >= 0 && $nextIdx < 8){
                        $data['keys'][$nextIdx] = intval($data['keys'][$nextIdx]) + 1;
                        $keysGranted[] = $nextIdx;
                    }
                }
            }

            // dailyKills[$bossId] НЕ трогаем здесь — уже учтена в startFight() (см. комментарий
            // там же и в блоке выше). killsTotal — отдельный счётчик "побед за всё время", он
            // по смыслу должен расти только при реальной победе, поэтому инкрементируется именно
            // тут, а не в startFight().
            if(!isset($data['killsTotal']) || !is_array($data['killsTotal'])) $data['killsTotal'] = array_fill(0, 8, 0);
            while(count($data['killsTotal']) < 8) $data['killsTotal'][] = 0;
            $data['killsTotal'][$bossId] = intval($data['killsTotal'][$bossId]) + 1;
            // Счётчик медалей отделён от общего числа убийств: миграция 42 может обнулить
            // медали всем, не ломая историю убийств, награды и доступы босса.
            if(!isset($data['medalKills']) || !is_array($data['medalKills'])) $data['medalKills'] = array_fill(0, 8, 0);
            while(count($data['medalKills']) < 8) $data['medalKills'][] = 0;
            $data['medalKills'][$bossId] = intval($data['medalKills'][$bossId]) + 1;

            // dev_force_drops остаётся только для персональных пулов боссов ниже.
            $devForceDrops = !empty($user['dev_force_drops']);
            $shmotAmount = 0;

            // 22.09.2026 (по прямому указанию, финальная сверка полного присланного списка
            // сетов — "почти все шмотки достаются с боссов") — второй, НЕЗАВИСИМЫЙ от блока
            // выше дроп вещи из ПЕРСОНАЛЬНОГО пула ЭТОГО босса+режима (boss_shmot_drop_pool в
            // bosses_config.json, id41+, заполнен по источникам из game/shmot.js — тщательно
            // сверено с полным присланным списком сетов, см. тест
            // boss-personal-shmot-drop-pool.test.js). Роллится только для обычного (0) и соло
            // (3) — единственные играбельные режимы.
            //
            // Шансы (по прямому указанию, уточнение того же дня):
            //  - соло-вещи (любой босс) — 100%, 1 килл = 1 вещь, пока не собрана.
            //  - фрагменты сета "ссср" (Панама-Охотник/Футболка-Счастливчик/Шорты-Ястреб,
            //    обычный режим, fragment_items[id]=20) — 100%, +1 часть за КАЖДОЕ убийство.
            //  - остальные вещи обычного режима (Меченный/Крыс/Баркут/Борода/Жгут, где по
            //    несколько "цельных" вещей сразу) — boss_shmot_normal_chance_pct (50%).
            $bossShmotItemId  = null; // полная вещь выдана ИМЕННО в этом убийстве (id) — для попапа
            $bossShmotFragment = null; // {id, have, need} — фрагмент добавлен, вещь ещё не собрана
            if($diffIdx === 0 || $diffIdx === 3){
                $modeKey  = $diffIdx === 0 ? 'normal' : 'solo';
                $bossPool = $catalog['boss_shmot_drop_pool'][strval($bossId)][$modeKey] ?? [];
                if(!empty($bossPool)){
                    $bossShmotState = $this->ops->j($user, 'shmot', []);
                    $fragState      = $this->ops->j($user, 'shmot_fragments', []);
                    $fragmentItems  = $catalog['fragment_items'] ?? [];

                    $available = [];
                    foreach($bossPool as $iid){
                        $iid = intval($iid);
                        if(empty($bossShmotState[$iid]['owned'])) $available[] = $iid;
                    }
                    if(!empty($available)){
                        $wonId    = $available[array_rand($available)];
                        $needFrag = intval($fragmentItems[strval($wonId)] ?? 0);
                        // Соло и фрагменты — 100% (без броска); "цельные" вещи обычного режима —
                        // по проценту (или мгновенно, если включён dev_force_drops).
                        $isSolo = $diffIdx === 3;
                        $normalRoll = mt_rand(1, 100);
                        $roll = $isSolo || $needFrag > 0 || $devForceDrops
                            || $normalRoll <= intval($catalog['boss_shmot_normal_chance_pct'] ?? 100);
                        $claimDebug['bossPersonalPoolDrop'] = [
                            'wonId' => $wonId, 'needFrag' => $needFrag, 'isSolo' => $isSolo,
                            'normalRoll' => $normalRoll, 'chancePct' => intval($catalog['boss_shmot_normal_chance_pct'] ?? 100),
                            'hit' => $roll,
                        ];
                        if($roll){
                            if($needFrag > 0){
                                $have = intval($fragState[strval($wonId)] ?? 0) + 1;
                                if($have >= $needFrag){
                                    while(count($bossShmotState) <= $wonId) $bossShmotState[] = ['owned' => false, 'equipped' => false];
                                    $bossShmotState[$wonId]['owned'] = true;
                                    unset($fragState[strval($wonId)]);
                                    $bossShmotItemId = $wonId;
                                } else {
                                    $fragState[strval($wonId)] = $have;
                                    $bossShmotFragment = ['id' => $wonId, 'have' => $have, 'need' => $needFrag];
                                }
                            } else {
                                while(count($bossShmotState) <= $wonId) $bossShmotState[] = ['owned' => false, 'equipped' => false];
                                $bossShmotState[$wonId]['owned'] = true;
                                $bossShmotItemId = $wonId;
                            }
                            $user['shmot'] = json_encode($bossShmotState);
                            $user['shmot_fragments'] = json_encode($fragState);
                            // Собранная (или уже владеемая) персональная вещь босса — тот же
                            // счётчик, что общий пул id0-40 выше, попап результата боя не
                            // различает источник, только "сколько шмоток выпало в этой победе".
                            if($bossShmotItemId !== null){
                                $shmotAmount++;
                                $this->ops->applyShmotOwnBonus($user, $bossShmotItemId);
                            }
                        }
                    }
                }
            }

            // Сброс состояния боя — та же уборка, что bosses-combat.js._onDefeat() делает
            // локально (HP на максимум, обнуление таймера/помощи друзей/урона цикла).
            if(!isset($data['hpByDiff']) || !is_array($data['hpByDiff'])) $data['hpByDiff'] = [];
            if(!isset($data['hpByDiff'][$diffIdx]) || !is_array($data['hpByDiff'][$diffIdx])) $data['hpByDiff'][$diffIdx] = array_fill(0, 8, 0);
            $data['hpByDiff'][$diffIdx][$bossId] = $this->BOSS_HP[$bossId][$diffIdx];

            if(!isset($data['bossStartMs']) || !is_array($data['bossStartMs'])) $data['bossStartMs'] = [];
            if(!isset($data['bossStartMs'][$diffIdx]) || !is_array($data['bossStartMs'][$diffIdx])) $data['bossStartMs'][$diffIdx] = array_fill(0, 8, 0);
            $data['bossStartMs'][$diffIdx][$bossId] = 0;

            if(!isset($data['friendDmgApplied']) || !is_array($data['friendDmgApplied'])) $data['friendDmgApplied'] = [];
            if(!isset($data['friendDmgApplied'][$diffIdx]) || !is_array($data['friendDmgApplied'][$diffIdx])) $data['friendDmgApplied'][$diffIdx] = array_fill(0, 8, 0);
            $data['friendDmgApplied'][$diffIdx][$bossId] = 0;
            if(!isset($data['friendDmgByUid']) || !is_array($data['friendDmgByUid'])) $data['friendDmgByUid'] = [];
            if(!isset($data['friendDmgByUid'][$diffIdx]) || !is_array($data['friendDmgByUid'][$diffIdx])) $data['friendDmgByUid'][$diffIdx] = [];
            $data['friendDmgByUid'][$diffIdx][$bossId] = [];

            if(!isset($data['curCycleDmg']) || !is_array($data['curCycleDmg'])) $data['curCycleDmg'] = array_fill(0, 8, 0);
            while(count($data['curCycleDmg']) < 8) $data['curCycleDmg'][] = 0;
            $data['curCycleDmg'][$bossId] = 0;

            // 25.09.2026 (РЕВЕРТ по прямому указанию — "верни ту механику"): кулдаун бесплатного
            // оружия снова сбрасывается, когда бой заканчивается ЛЮБЫМ способом (победа — здесь;
            // поражение/таймаут/выход — см. endFightSession() ниже). 24.09.2026 это было убрано
            // как "эксплойт" (см. история freeWpnCdMs выше и тест free-weapon-cooldown-not-
            // wiped-on-fight-end.test.js) — по новому прямому указанию пользователя возвращено.
            $data['freeWpnCdMs'] = [];

            // 24.09.2026: очищаем кэш HP этой попытки — следующий startFight() (новый или
            // другой bossId/diffIdx) заведёт свежий session с нуля (см. _syncFightSession()).
            $user['boss_fight_session'] = json_encode([]);

            $user['bosses_data'] = json_encode($data);

            // 22.09.2026: победа завершает попытку — та же финализация сессии скиллов (откат
            // прогресса до пола уровня, если левелапа не было ЗА ЭТУ попытку), что
            // endFightSession() делает для таймаута/форфейта/крестика (см. _finalizeSkillSession()).
            // 04.10.2026: функция теперь сама лочит строку и пишет skills_levels отдельным
            // UPDATE (не мутирует $user) — присваиваем результат в $user ДО saveUser() ТОЛЬКО
            // если лока не было (иначе результат потеряется), см. комментарий в самой функции.
            $skillsResult = $this->_finalizeSkillSession($user);
            if(!$skillsResult['locked']) $user['skills_levels'] = $skillsResult['json'];

            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);

            $user['skills_levels'] = $skillsResult['json'];
            $user['ryukzak_points'] = $freshRyukzakPts;

            $verifyUser = $this->ops->loadUser(['id', 'bosses_data']);
            $verifyRaw  = $verifyUser ? ($verifyUser['bosses_data'] ?? null) : '!!! loadUser() ПОСЛЕ save вернул null !!!';
            $saveVerifyMismatch = !$this->ops->sameJsonState($user['bosses_data'], $verifyRaw);

            $claimDebug += [
                'fn' => 'claimKill', 'uid' => abs(intval($this->registry['uid'])), 'bossId' => $bossId, 'diffIdx' => $diffIdx,
                'time' => date('Y-m-d H:i:s'), 'microtime' => microtime(true),
                // 29.09.2026: больше не "-1" — dailyKills инкрементируется в startFight(), не
                // здесь, поэтому текущее значение УЖЕ включает эту попытку (не нужно вычитать).
                'dailyKillsAtStart' => intval($data['dailyKills'][$bossId] ?? 0), 'dailyLimit' => $limit,
                'earnedExp' => $earnedExp, 'earnedCig' => $earnedCig,
                'keysGranted' => $keysGranted, 'shmotAmount' => $shmotAmount,
                'bossShmotItemId' => $bossShmotItemId, 'bossShmotFragment' => $bossShmotFragment,
                // 24.09.2026 (та же диагностика, что в rating() выше — "рейтинг накапливается
                // между боями"): topEntries — то, что реально уйдёт в попап результата боя
                // (boss_result.js), посчитано ДО сброса bossStartMs чуть выше по коду.
                'topEntries' => $topEntries,
                'sedoyDamage' => $sedoyDamage,
                'sessionSavedRaw' => $user['bosses_data'],
                'sessionVerifiedFromDbAfterSave' => $verifyRaw,
                'saveVerifyMismatch' => $saveVerifyMismatch,
            ];
            error_log('[bosses.claimKill] ' . json_encode($claimDebug)
                . ($saveVerifyMismatch ? ' !!! ЗАПИСАННОЕ И ПРОЧИТАННОЕ ОБРАТНО ЗНАЧЕНИЕ РАЗОШЛИСЬ !!!' : ''));

            $patch = $this->ops->patchCurrencies($user, [
                'coins','cigarettes','stew','exp','bosses_killed','boss_kills_0','boss_kills_1','boss_kills_2',
                'ryukzak_points','hata_progress','bosses_data','skills_levels','shmot','max_energy',
                // 22.09.2026: shmot_fragments — прогресс сборки персональных вещей боссов по
                // частям (см. блок дропа выше) — клиент должен видеть накопленный прогресс
                // (тултип магазина шмоток "N/20 частей"), поэтому едет в patch как и остальные
                // server-only поля (сохраняется только сервером, но читается клиентом).
                'shmot_fragments',
            ]);

            $this->ops->ok([
                'patch' => $patch,
                // ryukzak добавлен 18.09.2026 (по прямому указанию) — попап результата боя
                // теперь показывает "+N очков рюкзака" рядом с иконкой, раньше эта сумма нигде
                // явно не возвращалась клиенту (только тихо копилась в ryukzak_points).
                'reward' => ['cig' => $earnedCig, 'exp' => $earnedExp, 'ryukzak' => $ryukzakPts],
                'keysGranted' => $keysGranted,
                // 22.09.2026: 0, 1 или 2 (оба независимых дропа выше сработали разом) —
                // сколько предметов шмота выпало с этого убийства. boss_result.js уже содержал
                // готовый (но мёртвый) код под это поле — теперь оно реально приходит.
                'shmotAmount' => $shmotAmount,
                // 22.09.2026: id персональной вещи босса, если она была именно СОБРАНА в этом
                // убийстве (не null только когда вещь стала owned:true только что) — клиент
                // резолвит название/бонус по своему каталогу game/shmot.js (id — общий источник
                // правды с сервером), чтобы показать явное "Получено: <название>".
                'bossShmotItemId' => $bossShmotItemId,
                // {id, have, need} — если в этом убийстве добавился фрагмент, но вещь ещё не
                // собрана целиком (нужно "have < need" частей). null, если фрагмента не было.
                'bossShmotFragment' => $bossShmotFragment,
                'maxHp' => $this->BOSS_HP[$bossId][$diffIdx],
                // 22.09.2026: топ участников боя, посчитанный ДО сброса bossStartMs выше — см.
                // комментарий у $topEntries. Попап результата боя (boss_result.js) берёт его
                // отсюда напрямую вместо отдельного (и всегда пустого после победы) запроса
                // bosses.rating().
                'top' => $topEntries,
                // 29.09.2026: см. большой комментарий у _sedoyDamageMineSince() выше — отдельная
                // сумма урона Седого (не входит в 'top'), чтобы boss_result.js мог показать её
                // отдельной строкой, а не оставлять игрока гадать, откуда взялась разница между
                // суммой топа и maxHp.
                'sedoyDamage' => $sedoyDamage,
                'debug' => $claimDebug,
            ]);
        }
	}
?>
