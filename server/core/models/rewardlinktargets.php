<?php
/** Server-owned world/environment map. Never accepts a database or user ID from a URL. */
final class RewardLinkTargets {
    const DATABASES=[
        'test'=>['vk'=>'stalker_test','ok'=>'stalker_ok_test','telegram'=>'stalker_telegram_test','site'=>'stalker_site_test'],
        'prod'=>['vk'=>'stalker','ok'=>'stalker_ok','telegram'=>'stalker_telegram','site'=>'stalker_site'],
    ];
    public static function database(string $environment,string $platform): string {
        $db=self::DATABASES[$environment][$platform]??null;
        if(!$db)throw new InvalidArgumentException('invalid_reward_target');return $db;
    }
    public static function code(string $environment,string $platform): string {
        self::database($environment,$platform);return 'r1_'.$environment.'_'.$platform.'_'.bin2hex(random_bytes(16));
    }
    public static function matches(string $code,string $database): bool {
        // Preserve historical links. New bound codes cannot fall back to this branch.
        if(!str_starts_with($code,'r1_'))return true;
        if(!preg_match('/^r1_(test|prod)_(vk|ok|telegram|site)_[a-f0-9]{32}$/D',$code,$m))return false;
        return self::database($m[1],$m[2])===$database;
    }
    public static function url(string $environment,string $platform,string $code): string {
        if(!self::matches($code,self::database($environment,$platform))||!str_starts_with($code,'r1_'))throw new InvalidArgumentException('reward_target_mismatch');
        if($platform==='telegram'){
            $bot=$environment==='test'?'pripyat_game_test_bot':'pripyat_game_bot';
            return 'https://t.me/'.$bot.'?startapp=g_'.$code;
        }
        // The website must retain this intent through verified login of THIS provider.
        return 'https://pripyat-game-site.ru/reward/?'.http_build_query(['platform'=>$platform,'code'=>$code],'','&',PHP_QUERY_RFC3986);
    }
}
