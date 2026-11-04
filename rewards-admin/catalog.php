<?php
function shmot_catalog(){
    return include __DIR__ . '/shmot_catalog.php';
}

// bossId (0-7) ⇔ имя — тот же порядок, что server/core/controllers/bosses.php::BOSS_HP
// и CLAUDE.md ("Боссы (8): Охотник→Счастливчик→Ястреб→Меченный→Крыс→Баркут→Борода→Жгут").
function boss_catalog(){
    return [
        0 => 'Охотник', 1 => 'Счастливчик', 2 => 'Ястреб', 3 => 'Меченный',
        4 => 'Крыс', 5 => 'Баркут', 6 => 'Борода', 7 => 'Жгут',
    ];
}

// containerId (0-3) ⇔ имя — тот же порядок/названия, что server/json/habar_daily_config.json
// (containers[].name) и server/json/habar_containers.json — habar_bought=containerId+1
// разблокирует 30-дневный сбор через habar.php.collectDay(), см. rewardlinks.php.
function habar_catalog(){
    return [
        0 => 'Обычный', 1 => 'Пацанский', 2 => 'Авторитетный', 3 => 'Элитный',
    ];
}

function currency_catalog(){
    return [
        'coins'         => 'Рубли',
        'cigarettes'    => 'Сухари',
        'stew'          => 'Тушёнка',
        'respect'       => 'Уважение',
        'exp'           => 'Опыт',
        'energy'        => 'Энергия',
        'ammo_auto'     => 'Патроны (автомат)',
        'ammo_gun'      => 'Патроны (пистолет)',
        'ammo_machete'  => 'Заряды (мачете)',
    ];
}
