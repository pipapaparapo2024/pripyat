<?php
// Read-only aggregate diagnosis, streamed over SSH. No player IDs or credentials emitted.
if(PHP_SAPI !== 'cli') exit;
require '/var/www/stalker/server/core/models/registry.php';
$registry=new Registry;
foreach(['stalker','stalker_test','stalker_ok'] as $db){
    $link=new mysqli($registry['server'],$registry['user'],$registry['pass'],$db,3306);
    $cols=[];$result=$link->query('SHOW COLUMNS FROM users');
    while($row=$result->fetch_assoc())$cols[]=$row['Field'];
    $out=['database'=>$db,'missing'=>array_values(array_diff(['game2048_session','game2048_daily','game2048_games_completed','raznaryadka_data','stash_wishlist'],$cols))];
    if(!$out['missing']){
        $out['stats']=$link->query("SELECT COUNT(*) AS players,
        SUM(COALESCE(game2048_games_completed,0)-0>0) AS players_completed,
        SUM(COALESCE(game2048_games_completed,0)-0) AS completed_games,
        SUM(game2048_session IS NOT NULL AND LENGTH(game2048_session)>4) AS active_sessions,
        SUM(game2048_daily IS NOT NULL AND LENGTH(game2048_daily)>4) AS players_with_attempts
        FROM users")->fetch_assoc();
    }
    $key=$link->query("SHOW COLUMNS FROM secure LIKE 'req_key'")->fetch_assoc();
    $out['request_key_column_type']=$key['Type']??null;
    echo json_encode($out).PHP_EOL;$link->close();
}
