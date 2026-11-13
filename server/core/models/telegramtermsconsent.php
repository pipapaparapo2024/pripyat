<?php
/** Versioned, server-side record of a player's explicit Telegram purchase-terms consent. */
final class TelegramTermsConsent {
    public const VERSION='2026-11-10-1';
    private static function paths(): array {
        $dir=TelegramEnvironment::stateDirectory().'/terms';
        if(!is_dir($dir)&&!mkdir($dir,0700,true)&&!is_dir($dir))throw new RuntimeException('terms_storage_unavailable');
        if(!chmod($dir,0700))throw new RuntimeException('terms_storage_unavailable');
        return [$dir.'/acceptances.json',$dir.'/acceptances.lock'];
    }
    public static function accepted(int $playerId,string $telegramId,string $version=self::VERSION): bool {
        [$path,$lockPath]=self::paths();$lock=fopen($lockPath,'c+');
        if(!$lock||!flock($lock,LOCK_SH))throw new RuntimeException('terms_lock_failed');chmod($lockPath,0600);
        try{
            if(!is_file($path))return false;
            $data=json_decode((string)file_get_contents($path),true,32,JSON_THROW_ON_ERROR);
            if(!is_array($data))throw new RuntimeException('terms_storage_invalid');
            return isset($data[$telegramId.':'.$playerId.':'.$version])&&is_int($data[$telegramId.':'.$playerId.':'.$version]);
        }finally{flock($lock,LOCK_UN);fclose($lock);}
    }
    public static function accept(int $playerId,string $telegramId,int $now,string $version=self::VERSION): void {
        if($playerId<1||!TelegramAccess::validId($telegramId)||$now<1)throw new InvalidArgumentException('invalid_terms_acceptance');
        [$path,$lockPath]=self::paths();$lock=fopen($lockPath,'c+');
        if(!$lock||!flock($lock,LOCK_EX))throw new RuntimeException('terms_lock_failed');chmod($lockPath,0600);
        $tmp=null;
        try{
            $data=is_file($path)?json_decode((string)file_get_contents($path),true,32,JSON_THROW_ON_ERROR):[];
            if(!is_array($data))throw new RuntimeException('terms_storage_invalid');
            $key=$telegramId.':'.$playerId.':'.$version;
            if(!isset($data[$key]))$data[$key]=$now;
            $tmp=$path.'.'.bin2hex(random_bytes(8)).'.tmp';$json=json_encode($data,JSON_THROW_ON_ERROR);
            if(file_put_contents($tmp,$json,LOCK_EX)!==strlen($json)||!chmod($tmp,0600)||!rename($tmp,$path))throw new RuntimeException('terms_write_failed');
        }finally{if($tmp&&is_file($tmp))unlink($tmp);flock($lock,LOCK_UN);fclose($lock);}
    }
}
