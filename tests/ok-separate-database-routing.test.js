// Модерация ОК (02.10.2026, п.6: "Прогресс не должен синхронизироваться между ОК и ВК").
// Путь A (см. memory project_stalker_ok_audit) рендерит тот же бандл через тот же VK Bridge
// с теми же api_id/api_secret что и VK — единственный, кто знает реальную площадку, это
// клиент (modules/platform.js, по referrer/ancestorOrigins встраивающей страницы). Поэтому
// клиент передаёт площадку явным полем 'platform' с каждым запросом (modules/server.js), а
// registry.php выбирает БД (`stalker` vs `stalker_ok`) по этому полю — НЕ по подписи (api_secret
// общий для VK/ОК, проверка подписи в security.php не меняется). Тест проверяет текстом (PHP
// здесь не исполняется — см. стиль "простой regex/текстовый assert" в AGENTS.md), что:
// 1) клиент реально отправляет platform с каждым запросом;
// 2) registry.php переключает БД на stalker_ok только при platform==='ok', иначе (пусто/vk/
//    любой другой мусор от старых клиентов) остаётся на 'stalker' — безопасный дефолт;
// 3) миграция 45 создаёт stalker_ok клонированием ТОЛЬКО структуры (без данных), не трогая
//    существующую stalker.
const fs = require('fs'), assert = require('assert'), path = require('path');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

// 1. Клиент
{
    const s = read('_client/src/modules/server.js');
    assert(s.includes("import { detectPlatform } from './platform.js';"), 'server.js должен импортировать detectPlatform');
    assert(s.includes("this.MSSparams += '&platform='+detectPlatform();"), 'server.js должен добавлять platform в КАЖДЫЙ запрос к universal.php');
}

// 2. Сервер — регистри
{
    const s = read('server/core/models/registry.php');
    assert(s.includes("function __construct(){"), 'Registry должен получить конструктор для выбора БД по площадке');
    assert(s.includes("$_POST['platform'] ?? ''"), 'переключение БД должно читать $_POST[\'platform\'] с безопасным дефолтом на пустую строку');
    assert(s.includes("=== 'ok'"), 'переключение БД должно срабатывать только при явном platform===\'ok\'');
    assert(s.includes("\$this->vars['db'] = 'stalker_ok';"), 'при platform===\'ok\' БД должна переключаться на stalker_ok');
    // дефолтное значение 'db'=>'stalker' в исходном массиве не тронуто — старые/VK-клиенты не затронуты
    assert(s.includes("'db'=>'stalker',"), 'БД по умолчанию (VK, старые клиенты без поля platform) должна остаться stalker');
}

// 3. Миграция 45 — клонирование структуры stalker_ok
{
    const s = read('server/migrate45.php');
    assert(s.includes("stalker_migrate45_2026"), 'миграция должна требовать защитный key в query-параметре, как все остальные migrateNN.php');
    assert(s.includes("CREATE DATABASE IF NOT EXISTS `stalker_ok`"), 'миграция должна создавать БД stalker_ok (аддитивно, IF NOT EXISTS)');
    assert(s.includes("CREATE TABLE `stalker_ok`.`$table` LIKE `stalker`.`$table`"), 'миграция должна клонировать СТРУКТУРУ таблиц (LIKE), не данные');
    assert(!/INSERT INTO|SELECT \* FROM `stalker`/.test(s), 'миграция НЕ должна копировать данные игроков stalker в stalker_ok');
}

console.log('PASS: platform передаётся с каждым запросом, registry.php переключает БД только по явному platform===\'ok\' с дефолтом на stalker, migrate45 клонирует только структуру');
