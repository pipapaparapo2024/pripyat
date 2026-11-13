<?php
/** Server-selected deployment. Request parameters never select environment or database. */
final class TelegramEnvironment {
    private static string $environment='test';
    public static function select(array $config): void {
        $environment=$config['environment']??'';
        $databases=['test'=>'stalker_telegram_test','prod'=>'stalker_telegram'];
        if(!isset($databases[$environment])||($config['database']??'')!==$databases[$environment]) {
            throw new RuntimeException('telegram_disabled');
        }
        self::$environment=$environment;
    }
    public static function name(): string {return self::$environment;}
    public static function database(): string {return self::$environment==='prod'?'stalker_telegram':'stalker_telegram_test';}
    public static function origin(): string {return self::$environment==='prod'?'https://pripyat-game-site.ru/telegram':'https://tg-test-pripyat-game.ru';}
    // Telegram's sendPhoto fetches this URL from its own network, so use the
    // public HTTPS endpoint. Port 8443 is an internal relay and not reachable here.
    public static function mediaOrigin(): string {return 'https://tg-test-pripyat-game.ru';}
    public static function stateDirectory(): string {return '/var/lib/pripyat-tg-'.self::$environment;}
    public static function runtimeDirectory(): string {return '/var/www/stalker-tg-'.self::$environment.'/public';}
    public static function botUsername(): string {return self::$environment==='prod'?'pripyat_game_bot':'pripyat_game_test_bot';}
}
