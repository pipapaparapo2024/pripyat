<?php
    // ── SERVER-AUTHORITATIVE ЗАРУБА (19.09.2026, по прямому указанию) ──
    //
    // PvP-дуэль двух игроков со страницы визита к другу (кнопка "зарубиться"). Победитель
    // определяется сравнением накопленного опыта качалки "Сила" (str_xp_total, а не уровня
    // 1-50 — тот отдельная механика, см. base.js).
    //
    // 22.09.2026 (по прямому указанию, отдельно от переноса боевой системы боссов):
    // - Кулдаун 24ч НА ПАРУ (атакующий, цель) убран целиком — поле zaruba_cooldowns (per-target
    //   JSON) и его проверка удалены. Тем же днём, позже, по прямому указанию ("можно
    //   зарубиться только один раз за день") введён НОВЫЙ, более простой лимит — ОДИН раз в
    //   сутки, безусловно, на любую цель.
    // - "Сила" (str_xp_total) БОЛЬШЕ НЕ меняется в Зарубе ни у победителя, ни у проигравшего —
    //   по прямому указанию, "показатель силы растёт только за прокачку игроками" (см. новый
    //   permit pump() ниже). Исход дуэли по-прежнему определяется сравнением ТЕКУЩЕЙ силы обоих
    //   игроков — просто сама дуэль больше её не отменяет.
    //
    // 25.09.2026 (по прямому указанию — двойной РЕВЕРС предыдущего абзаца):
    // - Дневной лимит "один раз в сутки на любую цель" убран целиком — "на одного игрока можно
    //   нападать без ограничений по количеству раз". fight() больше не проверяет и не пишет
    //   zaruba_last_ts.
    // - Фиксированная награда (100 сигарет/100 опыта) за победу убрана целиком — "не выдавай
    //   награду за победу, ничего там не пиши". Победа теперь не начисляет игроку вообще
    //   ничего — только определяет исход (won: true/false) для UI.
    //
    // fight() теперь read-only по отношению к обеим строкам (свою читает через loadUser() для
    // str_xp_total, чужую — read-only getData) — ни своя, ни чужая строка этим методом больше
    // не изменяются вообще (раньше писал свой zaruba_last_ts/награду, до 22.09 писал чужую).
    //
    // ── «КАЧНУТЬ» (22.09.2026, по прямому указанию) — pump() ──
    // Кнопка "позвать в качалку" на визитке друга (player_profile.js, action gym_invite) даёт
    // +1 к "Силе" (str_xp_total) ЦЕЛИ (владельцу визитки), а не себе — это единственный способ
    // растить "Силу" после переноса Зарубы выше. Кулдаун 24ч на пару (визитёр, цель), хранится
    // в служебном поле gym_pump_cooldowns (JSON {target_id: last_pump_ts}) — по тому же приёму,
    // что был у zaruba_cooldowns: НЕ в whitelist users.php, клиент не может подделать через
    // users.save. Цель пишется напрямую через udb (может быть офлайн) — тот же приём, что был
    // у fight() до 22.09.2026. Требует миграции (server/migrate24.php — добавляет колонку).
    Class Zaruba {
        private $registry, $ops;

        public $permits;

        function __construct($registry){
            $this->registry = $registry;
            $this->ops = new Gameops($registry);
            $this->permits = ['fight', 'pump'];
        }

        function fight(){
            $uid = intval($this->registry['uid']);
            $targetId = intval($this->registry['user_params']['target_id'] ?? -1);
            if($targetId <= 0) return $this->ops->fail(54);
            if($targetId === $uid) return $this->ops->fail(90);

            $user = $this->ops->loadUser();
            if(!$user){
                error_log('[Zaruba.fight] loadUser() вернул null | uid=' . $uid);
                return $this->ops->fail(99);
            }

            // 25.09.2026 (по прямому указанию — РЕВЕРС дневного лимита выше: "зарубиться можно
            // только один раз в день [текущее неверное поведение] — на одного игрока можно
            // нападать без ограничений по количеству раз [нужное поведение]"): общий суточный
            // лимит (zaruba_last_ts) убран целиком — атаковать можно сколько угодно раз, любую
            // цель, без кулдауна вообще. Поле zaruba_last_ts больше нигде не читается и не
            // пишется (оставлено как мёртвая server-only колонка в БД — не мешает, чистить не
            // обязательно).

            $targetRow = $this->registry['udb']->getData(
                $this->registry['utb'], ['id', 'nick', 'str_xp_total'], 'id=' . $targetId
            );
            if(isset($targetRow['error']) && $targetRow['error']){
                error_log('[Zaruba.fight] цель не найдена | uid=' . $uid . ' target_id=' . $targetId);
                return $this->ops->fail(91);
            }

            $myStrength     = $this->ops->i($user, 'str_xp_total', 0);
            $targetStrength = intval($targetRow['str_xp_total'] ?? 0);

            // Ничья (оба 0 или равны) — атакующий побеждает по умолчанию (детерминированно,
            // без RNG). "Сила" сравнивается как есть и дуэлью больше не меняется.
            $won = $myStrength >= $targetStrength;

            // 25.09.2026 (по прямому указанию — "убери панель награды, не выдавай награду за
            // победу, ничего там не пиши"): фиксированная награда (100 сигарет/100 опыта) за
            // победу в Зарубе убрана целиком — победа больше НИЧЕГО не даёт ни одному из
            // участников, это чисто определение исхода по текущей "Силе".
            //
            // 04.10.2026 (по прямому указанию — "победи в pvp... зашел в базу к игроку, нажал
            // зарубиться, если выиграл, засчитано"): категория достижений 'pvp' (pvp_10..pvp_1k)
            // существовала в каталоге с 15.09.2026, но ничего не писало pvp_wins — PvP-фичи
            // тогда ещё не было. Теперь Заруба — единственный PvP-режим в игре, подключаем:
            // $user ВСЁ ЕЩЁ не меняется деньгами/опытом (награда по-прежнему не выдаётся), но
            // при победе инкрементируем счётчик побед, saveUser() теперь вызывается только для
            // этого одного поля.
            if($won){
                $user['pvp_wins'] = $this->ops->i($user, 'pvp_wins') + 1;
                if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
            }

            error_log('[Zaruba.fight] бой завершён | uid=' . $uid . ' target_id=' . $targetId .
                ' myStrength=' . $myStrength . ' targetStrength=' . $targetStrength . ' won=' . ($won ? '1' : '0') .
                ' pvpWins=' . $this->ops->i($user, 'pvp_wins'));

            $patch = $won ? $this->ops->patchCurrencies($user, ['pvp_wins']) : [];
            $this->ops->ok([
                'won'              => $won,
                'my_strength'      => $myStrength,
                'target_id'        => $targetId,
                'target_nick'      => strval($targetRow['nick'] ?? ''),
                'target_strength'  => $targetStrength,
                'patch'            => $patch,
            ]);
        }

        // +1 к "Силе" ТОЛЬКО ЦЕЛИ (владельцу визитки) — раз в 24 часа на пару (визитёр, цель).
        // Код ошибки 92 переиспользован из старого кулдауна Зарубы (тот убран, код
        // освободился) — семантика та же: "это действие временно недоступно для этой пары
        // игроков".
        // 28.09.2026 (по прямому указанию — РЕВЕРС правки от 25.09.2026 ниже по истории):
        // "качаешь силу — растёт у обоих, должно расти только у того, кого позвал качаться,
        // у себя — только когда МЕНЯ кто-то позовёт". Формулировка 25.09 была понята неверно
        // (истолкована как "визитёр тоже должен получать +1 от своего же действия", хотя имелось
        // в виду "растёт у target'а — а моя растёт отдельно, когда target я"). Блок, начислявший
        // +1 самому визитёру ($user['str_xp_total']), убран целиком — $user теперь используется
        // только для чтения/записи кулдауна, своя str_xp_total не трогается.
        function pump(){
            $targetId = intval($this->registry['user_params']['target_id'] ?? -1);
            if($targetId <= 0) return $this->ops->fail(54);
            if($targetId === intval($this->registry['uid'])) return $this->ops->fail(90);

            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            $cooldowns   = $this->ops->j($user, 'gym_pump_cooldowns', []);
            $cooldownMs  = 24 * 3600 * 1000;
            $lastPumpMs  = intval($cooldowns[$targetId] ?? 0);
            $nowMs       = time() * 1000;
            if($lastPumpMs > 0 && ($nowMs - $lastPumpMs) < $cooldownMs) return $this->ops->fail(92);

            $targetRow = $this->registry['udb']->getData(
                $this->registry['utb'], ['id', 'nick', 'str_xp_total'], 'id=' . $targetId
            );
            if(isset($targetRow['error']) && $targetRow['error']) return $this->ops->fail(91);

            $newStrength = intval($targetRow['str_xp_total'] ?? 0) + 1;
            // Цель может быть офлайн — прямой udb-write, тот же приём, что был у старого fight().
            $this->registry['udb']->saveData($this->registry['utb'], ['id' => $targetId, 'str_xp_total' => $newStrength]);

            $cooldowns[$targetId] = $nowMs;
            $user['gym_pump_cooldowns'] = json_encode($cooldowns);
            // 04.10.2026 (по прямому указанию — "«Сходи в качалку» выполняет за позыв через
            // базу игрока в качалку «позвать в качалку»"): достижения категории 'gym' раньше
            // считали ЛИЧНЫЕ тренировки (train_count, base.js) — теперь считают, сколько раз
            // ИНИЦИАТОР позвал ДРУГИХ игроков в качалку (растёт у визитёра, не у цели — Сила
            // цели считается отдельно, см. $newStrength выше).
            $user['gym_invites_sent'] = $this->ops->i($user, 'gym_invites_sent') + 1;
            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);

            $patch = $this->ops->patchCurrencies($user, ['gym_pump_cooldowns', 'gym_invites_sent']);
            $this->ops->ok([
                'patch'            => $patch,
                'target_id'        => $targetId,
                'target_nick'      => strval($targetRow['nick'] ?? ''),
                'target_strength'  => $newStrength,
                'my_strength'      => $this->ops->i($user, 'str_xp_total', 0),
            ]);
        }
    }
?>
