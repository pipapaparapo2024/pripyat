<?php
require __DIR__ . '/config.php';
require_login();

// 27.09.2026 (по прямому указанию — "убери из ссылки на игру id Володи", тот же фикс, что и в
// index.php — logs.php держит свою отдельную копию той же константы).


$link = db();

// Пытаемся резолвить ник игрока напрямую из БД игры (users.nickname) — без похода в VK API,
// админка не запускает VK Bridge. Если ника нет (пусто) — показываем просто VK id.
$rows = [];
$res = $link->query("SELECT c.id, c.link_id, c.user_id, c.claimed_at, rl.code, rl.label, rl.reward,
    u.nick AS nickname
    FROM reward_link_claims c
    JOIN reward_links rl ON rl.id = c.link_id
    LEFT JOIN users u ON u.id = c.user_id
    ORDER BY c.id DESC LIMIT 200");
if($res) while($row = $res->fetch_assoc()) $rows[] = $row;

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
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Логи получений — Припять</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="wrap">
        <nav>
            <h1>Логи получений</h1>
            <div><a href="index.php?platform=<?= urlencode(reward_platform()) ?>">← Наградные ссылки</a></div>
        </nav>

        <table class="list">
            <thead><tr><th>Когда</th><th>Игровой ID</th><th>Ник</th><th>Награда</th><th>Ссылка</th></tr></thead>
            <tbody>
            <?php foreach($rows as $r): ?>
                <?php $url = reward_url($r['code']); ?>
                <tr>
                    <td><?= date('d.m.Y H:i:s', intval($r['claimed_at'])) ?></td>
                    <td><?= intval($r['user_id']) ?></td>
                    <td><?= htmlspecialchars($r['nickname'] ?: '—') ?></td>
                    <td><?= render_reward_summary($r['reward']) ?></td>
                    <td><a href="<?= htmlspecialchars($url) ?>" target="_blank"><?= htmlspecialchars($r['code']) ?></a>
                        <?php if($r['label']): ?><span class="muted"> (<?= htmlspecialchars($r['label']) ?>)</span><?php endif; ?>
                    </td>
                </tr>
            <?php endforeach; ?>
            <?php if(!$rows): ?><tr><td colspan="5">Пока никто ничего не получал</td></tr><?php endif; ?>
            </tbody>
        </table>
    </div>
</body>
</html>
