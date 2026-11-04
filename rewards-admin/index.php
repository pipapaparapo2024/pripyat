<?php
require __DIR__ . '/config.php';
require_login();

const ROW_COUNT = 6;

$link = db();
$generatedUrls = [];
$formError = null;

// 26.09.2026 (по прямому указанию — "должна быть возможность удалить ссылку принудительно"):
// физическое DELETE сломало бы историю получений (logs.php джойнит reward_link_claims →
// reward_links по link_id) — вместо этого выключаем ссылку (active=0), сервер (rewardlinks.php
// claim()) уже проверяет этот флаг и отвечает reason:'notfound' для выключенных ссылок, то есть
// это полноценное принудительное отключение, просто без потери истории кто что уже получил.
if($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'deactivate'){
    $delId = intval($_POST['id'] ?? 0);
    if($delId > 0){
        $stmt = $link->prepare('UPDATE reward_links SET active = 0 WHERE id = ?');
        $stmt->bind_param('i', $delId);
        $stmt->execute();
        $stmt->close();
    }
    header('Location: index.php?platform='.urlencode(reward_platform()));
    exit;
}

if($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'create'){
    $reward = [];
    for($i = 0; $i < ROW_COUNT; $i++){
        $kind = $_POST["kind_$i"] ?? 'none';
        if($kind === 'currency'){
            $field  = strval($_POST["cur_field_$i"] ?? '');
            $amount = intval($_POST["cur_amount_$i"] ?? 0);
            if($amount <= 0) continue;
            // 26.09.2026 (баг найден по прямому указанию — "хотел тушёнку, пришли рубли"):
            // раньше при пустом $field (админ не тронул select) строка ниже просто не
            // добавлялась, а select всегда показывал первую опцию currency_catalog() —
            // 'coins' — как визуально выбранную, хотя реально ничего выбрано не было.
            // Теперь список содержит явный плейсхолдер без значения, и невыбор — ошибка,
            // а не молчаливый coins.
            if($field === '' || !array_key_exists($field, currency_catalog())){
                $formError = 'Строка ' . ($i + 1) . ': не выбран ресурс (выпадающий список остался на плейсхолдере) — ссылка не создана, чтобы не выдать по ошибке "Рубли" вместо нужного ресурса.';
                break;
            }
            $reward[] = ['kind' => 'currency', 'field' => $field, 'amount' => $amount];
        } else if($kind === 'shmot'){
            $itemId = intval($_POST["shmot_id_$i"] ?? -1);
            if($itemId >= 0){
                $reward[] = ['kind' => 'shmot', 'itemId' => $itemId];
            }
        } else if($kind === 'key'){
            $bossId = intval($_POST["key_boss_$i"] ?? -1);
            $amount = intval($_POST["key_amount_$i"] ?? 1);
            if($bossId >= 0 && $bossId <= 7 && $amount > 0){
                $reward[] = ['kind' => 'key', 'bossId' => $bossId, 'amount' => $amount];
            }
        } else if($kind === 'habar'){
            $habarId = intval($_POST["habar_id_$i"] ?? -1);
            if($habarId >= 0 && $habarId <= 3){
                $reward[] = ['kind' => 'habar', 'containerId' => $habarId];
            }
        }
    }

    $label = trim(strval($_POST['label'] ?? ''));
    $ttlSec = intval($_POST['ttl'] ?? 0); // 0 = без срока

    if($formError){
        // ошибка уже выставлена выше (невыбранный ресурс) — ссылку не создаём
    } else if(empty($reward)){
        $formError = 'Нужно добавить хотя бы одну награду.';
    } else {
        try {
            if(!hash_equals($_SESSION['create_nonce'],strval($_POST['create_nonce']??'')))throw new InvalidArgumentException('duplicate_create');
            unset($_SESSION['create_nonce']);
            $platforms=$_POST['platforms']??[];
            if(!is_array($platforms))throw new InvalidArgumentException('invalid_targets');
            $_SESSION['reward_links_generated']=reward_publisher()->create($platforms,$reward,$label,$ttlSec,time());
            header('Location: index.php?platform='.urlencode(reward_platform()));exit;
        } catch(Throwable $e){$formError='Не удалось создать ссылки. Проверьте площадки и награды; повторите с обновлённой страницы.';}
    }
}

if(isset($_SESSION['reward_links_generated'])){
    $generatedUrls=$_SESSION['reward_links_generated'];unset($_SESSION['reward_links_generated']);

}

function render_reward_summary($rewardJson){
    $reward = json_decode($rewardJson, true);
    if(!is_array($reward)) return '—';
    $cur = currency_catalog();
    $shmotById = [];
    foreach(shmot_catalog() as $it) $shmotById[$it['id']] = $it['name'];
    $boss = boss_catalog();

    $parts = [];
    foreach($reward as $e){
        $kind = $e['kind'] ?? '';
        if($kind === 'currency'){
            $name = $cur[$e['field']] ?? $e['field'];
            $parts[] = htmlspecialchars('+' . intval($e['amount']) . ' ' . $name);
        } else if($kind === 'shmot'){
            $name = $shmotById[intval($e['itemId'])] ?? ('шмотка #' . intval($e['itemId']));
            $parts[] = htmlspecialchars($name);
        } else if($kind === 'key'){
            $name = $boss[intval($e['bossId'])] ?? ('босс #' . intval($e['bossId']));
            $parts[] = htmlspecialchars('+' . intval($e['amount']) . ' ключ (' . $name . ')');
        } else if($kind === 'habar'){
            $name = habar_catalog()[intval($e['containerId'])] ?? ('хабар #' . intval($e['containerId']));
            $parts[] = htmlspecialchars('Хабар: ' . $name . ' (30 дней)');
        }
    }
    return implode(', ', $parts);
}

$recent = [];
$res = $link->query('SELECT rl.id, rl.code, rl.reward, rl.label, rl.created_at, rl.expires_at, rl.active,
    (SELECT COUNT(*) FROM reward_link_claims c WHERE c.link_id = rl.id) AS claims
    FROM reward_links rl ORDER BY rl.id DESC LIMIT 30');
if($res) while($row = $res->fetch_assoc()) $recent[] = $row;
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Припять — наградные ссылки</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="wrap">
        <nav>
            <h1>Наградные ссылки</h1>
            <div><a href="logs.php?platform=<?= urlencode(reward_platform()) ?>">Логи получений</a></div>
        </nav>

        <?php foreach($generatedUrls as $platform=>$result): ?>
        <div class="generated">
          <div><?= htmlspecialchars(reward_platform_names()[$platform]) ?>: <?= $result['created']?'ссылка создана':'ошибка — ссылка не создана, другие площадки независимы' ?></div>
          <?php if($result['created']): ?><input type="text" readonly value="<?= htmlspecialchars($result['url']) ?>" onclick="this.select()"><?php endif; ?>
        </div>
        <?php endforeach; ?>
        <?php if($formError): ?><div class="error"><?= htmlspecialchars($formError) ?></div><?php endif; ?>

        <form method="post" class="create-form">
            <input type="hidden" name="csrf" value="<?= htmlspecialchars($_SESSION['csrf']) ?>">
            <input type="hidden" name="action" value="create">
            <h2>Новые ссылки · TEST</h2>
            <input type="hidden" name="create_nonce" value="<?= htmlspecialchars($_SESSION['create_nonce']) ?>">
            <fieldset><legend>Создать отдельную ссылку для каждой выбранной площадки</legend>
            <?php foreach(reward_platform_names() as $key=>$name): ?>
              <label><input type="checkbox" name="platforms[]" value="<?= $key ?>"> <?= htmlspecialchars($name) ?></label>
            <?php endforeach; ?></fieldset>

            <label>Название (для себя, необязательно)</label>
            <input type="text" name="label" placeholder="Например: конкурс в группе">

            <label>Срок действия</label>
            <select name="ttl">
                <option value="0">Без срока</option>
                <option value="60">1 минута</option>
                <option value="300">5 минут</option>
                <option value="3600">1 час</option>
                <option value="86400">1 день</option>
                <option value="604800">1 неделя</option>
            </select>

            <h3>Награды (заполните нужные строки, лишние оставьте "—")</h3>
            <table class="rows">
                <thead><tr><th>Тип</th><th colspan="2">Параметры</th></tr></thead>
                <tbody>
                <?php for($i = 0; $i < ROW_COUNT; $i++): ?>
                    <tr>
                        <td>
                            <select name="kind_<?= $i ?>">
                                <option value="none">—</option>
                                <option value="currency">Ресурс</option>
                                <option value="shmot">Шмотка</option>
                                <option value="key">Ключ босса</option>
                                <option value="habar">Хабар (30 дней)</option>
                            </select>
                        </td>
                        <td>
                            <select name="cur_field_<?= $i ?>">
                                <option value="" selected disabled>— выберите ресурс —</option>
                                <?php foreach(currency_catalog() as $k => $label): ?>
                                    <option value="<?= htmlspecialchars($k) ?>"><?= htmlspecialchars($label) ?></option>
                                <?php endforeach; ?>
                            </select>
                            <select name="shmot_id_<?= $i ?>">
                                <?php foreach(shmot_catalog() as $it): ?>
                                    <option value="<?= $it['id'] ?>"><?= htmlspecialchars($it['cat'] . ': ' . $it['name']) ?></option>
                                <?php endforeach; ?>
                            </select>
                            <select name="key_boss_<?= $i ?>">
                                <?php foreach(boss_catalog() as $id => $name): ?>
                                    <option value="<?= $id ?>"><?= htmlspecialchars($name) ?></option>
                                <?php endforeach; ?>
                            </select>
                            <select name="habar_id_<?= $i ?>">
                                <?php foreach(habar_catalog() as $id => $name): ?>
                                    <option value="<?= $id ?>"><?= htmlspecialchars($name) ?></option>
                                <?php endforeach; ?>
                            </select>
                        </td>
                        <td>
                            <input type="number" name="cur_amount_<?= $i ?>" placeholder="кол-во" min="1" class="num">
                            <input type="number" name="key_amount_<?= $i ?>" placeholder="кол-во ключей" min="1" value="1" class="num">
                        </td>
                    </tr>
                <?php endfor; ?>
                </tbody>
            </table>
            <p class="hint">Поле "кол-во" используется для строк "Ресурс" и "Ключ босса" (для шмотки — не нужно, выдаётся 1 шт).</p>

            <button type="submit">Сгенерировать ссылку</button>
        </form>

        <h2>Последние ссылки: <?= htmlspecialchars(reward_platform_names()[reward_platform()]) ?></h2>
        <form method="get"><label>Площадка <select name="platform" onchange="this.form.submit()">
          <?php foreach(reward_platform_names() as $key=>$name): ?><option value="<?= $key ?>" <?= $key===reward_platform()?'selected':'' ?>><?= htmlspecialchars($name) ?></option><?php endforeach; ?>
        </select></label><button>Показать</button></form>
        <table class="list">
            <thead><tr><th>Код</th><th>Название</th><th>Награда</th><th>Создана</th><th>Истекает</th><th>Получений</th><th>Статус</th><th>Действие</th></tr></thead>
            <tbody>
            <?php foreach($recent as $r): ?>
                <?php
                    $expired = $r['expires_at'] !== null && intval($r['expires_at']) > 0 && time() > intval($r['expires_at']);
                    $status = !intval($r['active']) ? 'выключена' : ($expired ? 'истекла' : 'активна');
                    $url = reward_url($r['code']);
                ?>
                <tr>
                    <td><a href="<?= htmlspecialchars($url) ?>" target="_blank"><?= htmlspecialchars($r['code']) ?></a></td>
                    <td><?= htmlspecialchars($r['label'] ?: '—') ?></td>
                    <td><?= render_reward_summary($r['reward']) ?></td>
                    <td><?= date('d.m.Y H:i', intval($r['created_at'])) ?></td>
                    <td><?= $r['expires_at'] ? date('d.m.Y H:i', intval($r['expires_at'])) : 'без срока' ?></td>
                    <td><?= intval($r['claims']) ?></td>
                    <td class="status-<?= htmlspecialchars($status) ?>"><?= htmlspecialchars($status) ?></td>
                    <td>
                        <?php if(intval($r['active'])): ?>
                        <form method="post" style="display:inline" onsubmit="return confirm('Удалить (принудительно выключить) эту ссылку? Награду по ней больше нельзя будет получить.');">
                            <input type="hidden" name="csrf" value="<?= htmlspecialchars($_SESSION['csrf']) ?>">
                            <input type="hidden" name="action" value="deactivate">
                            <input type="hidden" name="id" value="<?= intval($r['id']) ?>">
                            <button type="submit" class="btn-del">Удалить</button>
                        </form>
                        <?php else: ?>
                        —
                        <?php endif; ?>
                    </td>
                </tr>
            <?php endforeach; ?>
            <?php if(!$recent): ?><tr><td colspan="8">Ссылок пока нет</td></tr><?php endif; ?>
            </tbody>
        </table>
    </div>
    <script>
        // Прогрессивное улучшение: показывает только нужный select/поле для выбранного типа
        // строки. Если JS не выполнится — все поля просто останутся видимыми, форма всё
        // равно рабочая (сервер сам смотрит только на kind_N).
        function syncRow(i){
            var kind = document.querySelector('[name="kind_' + i + '"]').value;
            document.querySelector('[name="cur_field_' + i + '"]').style.display  = (kind === 'currency') ? '' : 'none';
            document.querySelector('[name="cur_amount_' + i + '"]').style.display = (kind === 'currency') ? '' : 'none';
            document.querySelector('[name="shmot_id_' + i + '"]').style.display   = (kind === 'shmot') ? '' : 'none';
            document.querySelector('[name="key_boss_' + i + '"]').style.display   = (kind === 'key') ? '' : 'none';
            document.querySelector('[name="key_amount_' + i + '"]').style.display = (kind === 'key') ? '' : 'none';
            document.querySelector('[name="habar_id_' + i + '"]').style.display   = (kind === 'habar') ? '' : 'none';
        }
        for(var i = 0; i < <?= ROW_COUNT ?>; i++){
            (function(i){
                var sel = document.querySelector('[name="kind_' + i + '"]');
                sel.addEventListener('change', function(){ syncRow(i); });
                syncRow(i);
            })(i);
        }
    </script>
</body>
</html>
