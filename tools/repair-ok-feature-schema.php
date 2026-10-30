<?php
// CLI only. Stream to `ssh stalker-vps 'php /dev/stdin --check'` for diagnosis.
// --apply adds missing columns from migrations 51/52/53 ONLY to stalker_ok.users.
// No row updates, no copying progress from VK, no web endpoint or static password.
function okFeatureSchemaPlan(array $existing): array {
    $required = [
        'raznaryadka_data' => 'TEXT NULL',
        'game2048_session' => 'TEXT NULL',
        'game2048_daily' => 'TEXT NULL',
        'game2048_fragments' => "VARCHAR(64) DEFAULT '0'",
        'game2048_games_completed' => "VARCHAR(64) DEFAULT '0'",
        'game2048_games_completed_at' => "VARCHAR(64) DEFAULT '0'",
        'game2048_lifetime' => 'TEXT NULL',
        'stash_claims' => 'TEXT NULL',
        'stash_wishlist' => 'TEXT NULL',
    ];
    return array_diff_key($required, array_fill_keys($existing, true));
}

function repairOkFeatureSchema($link, bool $apply): array {
    if(($link->query('SELECT DATABASE() AS db')->fetch_assoc()['db'] ?? '') !== 'stalker_ok'){
        throw new RuntimeException('Refusing migration outside stalker_ok');
    }
    $lock = $link->query("SELECT GET_LOCK('stalker_ok_feature_schema_51_53', 10) AS acquired")->fetch_assoc();
    if(intval($lock['acquired'] ?? 0) !== 1) throw new RuntimeException('Schema lock unavailable');
    try {
        $columns = function() use ($link){
            $result = $link->query('SHOW COLUMNS FROM `stalker_ok`.`users`');
            $names = [];
            while($row = $result->fetch_assoc()) $names[] = $row['Field'];
            return $names;
        };
        $plan = okFeatureSchemaPlan($columns());
        $added = [];
        if($apply){
            foreach($plan as $name => $definition){
                // Names and definitions originate exclusively from the constant manifest.
                $link->query("ALTER TABLE `stalker_ok`.`users` ADD COLUMN `$name` $definition");
                $added[] = $name;
            }
            if(okFeatureSchemaPlan($columns())) throw new RuntimeException('Schema verification failed');
        }
        return ['database'=>'stalker_ok', 'mode'=>$apply?'apply':'check',
            'missing'=>array_keys($plan), 'added'=>$added];
    } finally {
        $link->query("SELECT RELEASE_LOCK('stalker_ok_feature_schema_51_53')");
    }
}

if(defined('OK_SCHEMA_TEST')) return;
if(PHP_SAPI !== 'cli'){ http_response_code(404); exit; }
try {
    $args = array_slice($argv, 1);
    if(count($args) !== 1 || !in_array($args[0], ['--check','--apply'], true)){
        throw new InvalidArgumentException('Usage: php repair-ok-feature-schema.php --check|--apply');
    }
    require '/var/www/stalker/server/core/models/registry.php';
    $registry = new Registry();
    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    $link = new mysqli($registry['server'], $registry['user'], $registry['pass'], 'stalker_ok', 3306);
    $link->set_charset('utf8mb4');
    echo json_encode(repairOkFeatureSchema($link, $args[0] === '--apply'), JSON_PRETTY_PRINT) . PHP_EOL;
    $link->close();
} catch(Throwable $error){
    fwrite(STDERR, '[repair-ok-feature-schema] ' . $error->getMessage() . PHP_EOL);
    exit(1);
}
