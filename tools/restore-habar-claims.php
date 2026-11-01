<?php
// One-off repair, run over SSH only. Not part of the public server directory.
function planHabarClaimRestore($row, $nowMs) {
    $before = [];
    foreach (['habar_bought','habar_bought_ts','habar_days_collected','habar_last_collect_ts'] as $key) $before[$key] = strval($row[$key] ?? '0');
    $claimedMs = intval($row['claimed_at']) * 1000;
    $result = ['id'=>strval($row['id']), 'nick'=>$row['nick'], 'before'=>$before, 'after'=>$before];
    // Do not touch cancelled, replaced, or independently bought subscriptions.
    if (intval($before['habar_bought']) !== 2 || $claimedMs <= 0 || $claimedMs > $nowMs) return $result + ['action'=>'skip'];
    $start = intval($before['habar_bought_ts']);
    if ($start !== 1792509429751 && abs($start - $claimedMs) > 60000) return $result + ['action'=>'skip'];
    $expiresMs = intval((floor(($claimedMs + 10800000) / 86400000) + 30) * 86400000 - 10800000);
    $day = fn($ms) => intval(floor(($ms + 10800000) / 86400000));
    $result['elapsed_days'] = min(30, max(0, $day($nowMs) - $day($claimedMs)));
    $result['received_ms'] = $claimedMs; $result['expires_ms'] = $expiresMs;
    if ($nowMs >= $expiresMs) {
        $result['action'] = 'expire'; $result['after'] = array_fill_keys(array_keys($before), '0');
    } else {
        $result['action'] = 'restore'; $result['after']['habar_bought_ts'] = strval($claimedMs);
    }
    return $result;
}

if (defined('HABAR_RESTORE_TEST')) return;
$apply = defined('HABAR_RESTORE_APPLY') && HABAR_RESTORE_APPLY;
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
$_POST['platform'] = 'vk';
require '/var/www/stalker/server/core/models/registry.php';
$registry = new Registry();
if ($registry['db'] !== 'stalker' || $registry['utb'] !== 'users') throw new RuntimeException('Wrong target');
$db = new mysqli($registry['server'],$registry['user'],$registry['pass'],$registry['db'],3306);
$db->set_charset('utf8mb4');
$db->query($apply ? 'START TRANSACTION' : 'START TRANSACTION READ ONLY');
try {
    $reward = $db->query('SELECT reward FROM reward_links WHERE id=18')->fetch_assoc();
    $entries = json_decode($reward['reward'] ?? '',true); $matches = false;
    foreach (is_array($entries) ? $entries : [] as $entry) if (($entry['kind'] ?? '') === 'habar' && intval($entry['containerId'] ?? -1) === 1) $matches = true;
    if (!$matches) throw new RuntimeException('Reward definition changed');
    $sql = 'SELECT u.id,u.nick,u.habar_bought,u.habar_bought_ts,u.habar_days_collected,u.habar_last_collect_ts,c.claimed_at FROM users u JOIN reward_link_claims c ON c.user_id=u.id WHERE c.link_id=18 ORDER BY u.id';
    $rows = $db->query($sql . ($apply ? ' FOR UPDATE' : ''))->fetch_all(MYSQLI_ASSOC);
    $nowMs = intval(round(microtime(true)*1000));
    $plan = array_map(fn($row) => planHabarClaimRestore($row,$nowMs),$rows);
    $counts = array_count_values(array_column($plan,'action'));
    $backup = null;
    if ($apply) {
        if (count($rows) !== 36) throw new RuntimeException('Unexpected claim count; review plan again');
        $backup = '/var/backups/pripyat-habar-claims-' . gmdate('YmdHis');
        if (!mkdir($backup,0700)) throw new RuntimeException('Backup directory failed');
        $bytes = file_put_contents($backup.'/before.json',json_encode(['database'=>'stalker','link_id'=>18,'now_ms'=>$nowMs,'rows'=>$rows,'plan'=>$plan],JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE),LOCK_EX);
        if (!$bytes || !chmod($backup.'/before.json',0600)) throw new RuntimeException('Backup failed');
        $stmt = $db->prepare('UPDATE users SET habar_bought=?,habar_bought_ts=?,habar_days_collected=?,habar_last_collect_ts=? WHERE id=?');
        foreach ($plan as $item) {
            if ($item['action'] === 'skip' || $item['before'] === $item['after']) continue;
            $a = $item['after']; $id = $item['id'];
            $stmt->bind_param('sssss',$a['habar_bought'],$a['habar_bought_ts'],$a['habar_days_collected'],$a['habar_last_collect_ts'],$id); $stmt->execute();
            if ($stmt->affected_rows !== 1) throw new RuntimeException('Player update failed');
        }
        $stmt->close();
        $after = $db->query($sql)->fetch_all(MYSQLI_ASSOC); $byId = array_column($after,null,'id');
        foreach ($plan as $item) foreach ($item['after'] as $key=>$value) if (strval($byId[$item['id']][$key]) !== $value) throw new RuntimeException('Verification failed');
        if (!file_put_contents($backup.'/after.json',json_encode($after,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE),LOCK_EX) || !chmod($backup.'/after.json',0600)) throw new RuntimeException('Verification backup failed');
        $db->commit();
    } else $db->rollback();
    echo json_encode(['apply'=>$apply,'counts'=>$counts,'backup'=>$backup,'plan'=>$plan],JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE);
} catch (Throwable $error) { $db->rollback(); throw $error; }
finally { $db->close(); }
