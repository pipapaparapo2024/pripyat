<?php
/** Shared advisory lock for the native TEST gateway and the Habar worker. */
final class HabarAutoTest {
    public const WORLDS = ['stalker_test', 'stalker_ok_test'];

    public const DAY_MS = 86400000;

    public static function used(array $settings): bool {
        $until = (int) ($settings['autoHabarAccessUntilMs'] ?? 0);
        $last = (int) ($settings['lastAutoHabarMs'] ?? 0);
        return $until > 0 && $last > 0 && $last >= $until - self::DAY_MS && $last < $until;
    }

    public static function eligible(array $settings, int $now): bool {
        $until = (int) ($settings['autoHabarAccessUntilMs'] ?? 0);
        return ($settings['autoHabar'] ?? false) === true
            && $now >= $until - self::DAY_MS && $now < $until && !self::used($settings);
    }

    public static function lock(PDO $db, string $world, int $uid, int $timeout): ?string {
        if(!in_array($world, self::WORLDS, true) || $uid < 1 || $uid > 2147483647){
            throw new InvalidArgumentException('invalid_test_character');
        }
        $name = "pripyat.native.test.$world.player.$uid";
        $q = $db->prepare('SELECT GET_LOCK(?,?)');
        $q->execute([$name, $timeout]);
        return (int)$q->fetchColumn() === 1 ? $name : null;
    }

    public static function unlock(PDO $db, string $name): void {
        $q = $db->prepare('SELECT RELEASE_LOCK(?)');
        $q->execute([$name]);
    }

    public static function connect(string $world, string $user, string $password): PDO {
        if(!in_array($world, self::WORLDS, true)) throw new InvalidArgumentException('invalid_test_world');
        return new PDO("mysql:host=127.0.0.1;port=3306;dbname=$world;charset=utf8mb4", $user, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }
}
