<?php
require_once __DIR__.'/sitepayments.php';

final class TelegramWebsitePayments {
    public const TEST_WORLD = 'telegram_test';
    /** Backward-compatible TEST alias used by existing callers and fixtures. */
    public const WORLD = self::TEST_WORLD;
    public const PROD_WORLD = 'telegram';
    public const LIVE_TEST_WORLD = 'telegram_test_live';
    public const OWNER = '1355806786';
    private SiteYooKassa $provider;
    private string $world;
    private array $primaryConfig;

    public function __construct(private PDO $db, array $config, string $mode='test', private array $notificationProviders=[]) {
        if(!in_array($mode,['test','live_test_owner','prod'],true))throw new InvalidArgumentException('invalid_telegram_payment_mode');
        $this->primaryConfig=$config;
        $this->provider = new SiteYooKassa($config);
        if($mode==='test'&&$this->provider->isTest())$this->world=self::TEST_WORLD;
        else if($mode==='live_test_owner'&&!$this->provider->isTest())$this->world=self::LIVE_TEST_WORLD;
        else if($mode==='prod'&&!$this->provider->isTest())$this->world=self::PROD_WORLD;
        else throw new InvalidArgumentException('telegram_payment_mode_mismatch');
    }

    public static function websiteTestMode(string $telegramId,bool $preview,bool $liveTestEnabled): string {
        return $preview&&$liveTestEnabled&&$telegramId===self::OWNER?'live_test_owner':'test';
    }

    public static function databaseForMode(string $mode): string {
        return match($mode){'test','live_test_owner'=>'stalker_telegram_test','prod'=>'stalker_telegram',default=>throw new InvalidArgumentException('invalid_telegram_payment_mode')};
    }

    public function mode(): string {return in_array($this->world,[self::LIVE_TEST_WORLD,self::PROD_WORLD],true)?'live':'test';}

    public function enabled(): bool {
        if (!$this->provider->checkoutReady()) return false;
        $schema=self::databaseForMode(match($this->world){self::PROD_WORLD=>'prod',self::LIVE_TEST_WORLD=>'live_test_owner',default=>'test'});
        $tables = $this->db->prepare("SELECT COUNT(*) FROM information_schema.tables
            WHERE table_schema=? AND table_name IN ('site_payment_orders','site_payment_receipts')");
        $tables->execute([$schema]);
        return (int)$tables->fetchColumn() === 2;
    }

    public function player(string $telegramId, string $token, int $now): ?int {
        if (!preg_match('/^[a-f0-9]{64}$/D',$token)) return null;
        $query = $this->db->prepare('SELECT i.player_id FROM telegram_identities i
            JOIN telegram_sessions s ON s.player_id=i.player_id
            WHERE i.telegram_id=? AND s.token_hash=? AND s.expires_at>?');
        $query->execute([$telegramId,hash('sha256',$token),$now]);
        $player = $query->fetchColumn();
        return $player === false ? null : (int)$player;
    }

    public function create(int $player, int $product, string $intent, int $now): array {
        $query = $this->db->prepare('SELECT COUNT(*) FROM site_payment_orders WHERE player_id=? AND created_at>? AND id<>?');
        $query->execute([$player,$now-3600,$intent]);
        if ((int)$query->fetchColumn() >= 10) throw new DomainException('rate_limited');
        return (new SitePayments($this->db,$this->provider,$this->world))->create($player,$product,$intent,$now);
    }

    public function status(int $player, string $order, int $now): string {
        if (!preg_match('/^[a-f0-9]{64}$/D',$order)) throw new InvalidArgumentException('invalid_order');
        $query = $this->db->prepare('SELECT status,credited_at,provider_payment_id FROM site_payment_orders WHERE id=? AND player_id=?');
        $query->execute([$order,$player]);
        $row = $query->fetch(PDO::FETCH_ASSOC);
        if (!$row || !$row['provider_payment_id']) throw new DomainException('unknown_payment');
        if ($row['credited_at'] !== null) return 'already_credited';
        if ($row['status'] === 'canceled') return 'canceled';
        return (new SitePayments($this->db,$this->provider,$this->world))->settle($row['provider_payment_id'],$now);
    }

    public static function notificationId(mixed $notification): ?string {
        if (!is_array($notification) || ($notification['type']??null)!=='notification'
            || !in_array($notification['event']??null,['payment.succeeded','payment.canceled'],true)) return null;
        $id = $notification['object']['id']??null;
        if (!is_string($id) || !preg_match('/^[a-zA-Z0-9-]{1,64}$/D',$id)) throw new InvalidArgumentException('invalid_payment');
        return $id;
    }

    public function notification(string $paymentId, int $now): void {
        $query = $this->db->prepare('SELECT 1 FROM site_payment_orders WHERE provider_payment_id=? AND credited_at IS NULL');
        $query->execute([$paymentId]);
        if (!$query->fetchColumn()) return;
        $configs=array_merge([$this->primaryConfig],$this->notificationProviders);
        foreach($configs as $config){
            if(!is_array($config))continue;
            $provider=new SiteYooKassa($config);if(!$provider->ready())continue;
            try{$payment=$provider->request('payments/'.$paymentId);}
            catch(DomainException $e){if($e->getMessage()==='payment_not_found')continue;throw $e;}
            $provider->assertEnvironment($payment);
            $world=$provider->isTest()?self::TEST_WORLD:($this->world===self::PROD_WORLD?self::PROD_WORLD:self::LIVE_TEST_WORLD);
            if($world!==$this->world)continue;
            (new SitePayments($this->db,$provider,$world))->settle($paymentId,$now);
            return;
        }
    }

}
