<?php
require_once __DIR__.'/telegramplayerlock.php';
final class TelegramLoginStore {
    private $db,$playerLock;
    public function __construct(PDO $db) { $this->db = $db; }
    public function begin(): void { $this->db->beginTransaction(); }
    public function commit(): void { $this->db->commit(); $this->releaseLock(); }
    public function rollback(): void { try { if ($this->db->inTransaction()) $this->db->rollBack(); } finally { $this->releaseLock(); } }
    private function releaseLock(): void { if($this->playerLock){$this->playerLock->release();$this->playerLock=null;} }
    private function run(string $sql, array $args) {
        $stmt = $this->db->prepare($sql); $stmt->execute($args); return $stmt;
    }
    public function resolvePlayer(string $telegramId, int $now): int {
        // UNIQUE(serialized external ID) serializes simultaneous first logins.
        $this->run('INSERT INTO telegram_identities (telegram_id, created_at) VALUES (?, ?) ON DUPLICATE KEY UPDATE telegram_id=VALUES(telegram_id)', [$telegramId, $now]);
        $uid = (int)$this->run('SELECT player_id FROM telegram_identities WHERE telegram_id=? FOR UPDATE', [$telegramId])->fetchColumn();
        if ($uid < 1 || $uid > 2147483647) throw new RuntimeException('invalid_game_id');
        // Before locking users: API may hold this mutex while writing through mysqli.
        $this->playerLock=new TelegramPlayerLock($this->db,$uid);
        // Existing progress is never overwritten on a repeat login.
        $exists = $this->run('SELECT id FROM users WHERE id=? FOR UPDATE', [$uid])->fetchColumn();
        if ($exists === false) {
            $this->run("INSERT INTO users (id, exp, coins, cigarettes, create_time, visit, shmot) VALUES (?, 0, 10, 1000, ?, ?, '[]')", [$uid, $now, $now]);
        }
        if(TelegramEnvironment::name()==='prod'&&$telegramId==='1355806786'){
            $this->run("INSERT IGNORE INTO telegram_roles(player_id,role,created_at) VALUES (?,'developer',?)",[$uid,$now]);
        }
        return $uid;
    }
    public function saveSession(int $uid, string $hash, int $expires, string $requestKey): void {
        $this->run('DELETE FROM telegram_sessions WHERE player_id=?',[$uid]);
        $this->run('INSERT INTO telegram_sessions (token_hash, player_id, expires_at, request_key) VALUES (?, ?, ?, ?)', [$hash, $uid, $expires, $requestKey]);
    }
    public function roles(int $uid): array {
        $q=$this->run('SELECT role FROM telegram_roles WHERE player_id=?',[$uid]);$roles=[];
        while(($role=$q->fetchColumn())!==false)if(in_array($role,['developer','admin'],true))$roles[]=$role;
        return $roles;
    }
}
