<?php
/** Only Telegram-hosted files downloaded server-side. Never return a bot-token URL. */
final class TelegramAvatars {
    private $bot,$secret,$dir,$download;
    public function __construct($bot,string $secret,string $dir='/var/www/stalker-tg-test/public/images/telegram-avatars',$download=null){$this->bot=$bot;$this->secret=$secret;$this->dir=$dir;$this->download=$download;}
    public function get(string $external,int $now): ?string {
        if(!TelegramAccess::validId($external))return null;
        $key=hash_hmac('sha256',$external,$this->secret);$base=$this->dir.'/'.$key;
        if(!is_dir($this->dir))return null;
        $lock=@fopen($base.'.lock','c+');if(!$lock)return null;
        try{
            if(!flock($lock,LOCK_EX))return null;
            clearstatcache(true,$base.'.stamp');
            if(is_file($base.'.stamp') && filemtime($base.'.stamp')>$now-3600)return $this->cached($key);
            try{
                $photos=$this->bot->call('getUserProfilePhotos',['user_id'=>(int)$external,'limit'=>1]);
                $sizes=$photos['photos'][0]??[];$size=null;
                foreach($sizes as $candidate)if(isset($candidate['file_id'])&&(!$size||abs(($candidate['width']??0)-160)<abs(($size['width']??0)-160)))$size=$candidate;
                if(!$size){if(is_file($base.'.jpg'))unlink($base.'.jpg');file_put_contents($base.'.stamp','');return null;}
                $file=$this->bot->call('getFile',['file_id'=>$size['file_id']]);$path=$file['file_path']??'';
                if(!is_string($path)||!preg_match('~^[A-Za-z0-9_/-]+\.(?:jpg|jpeg|png)$~D',$path)||str_contains($path,'..'))throw new RuntimeException('invalid_photo_path');
                $bytes=$this->download?($this->download)($path):$this->bot->downloadFile($path);
                $info=is_string($bytes)&&strlen($bytes)<=2097152?@getimagesizefromstring($bytes):false;
                if(!$info||$info[2]!==IMAGETYPE_JPEG||$info[0]>4096||$info[1]>4096)throw new RuntimeException('invalid_photo');
                $tmp=$base.'.tmp';if(file_put_contents($tmp,$bytes)!==strlen($bytes)||!rename($tmp,$base.'.jpg'))throw new RuntimeException('photo_write_failed');
                chmod($base.'.jpg',0644);file_put_contents($base.'.stamp','');
            }catch(Throwable $e){/* Retry temporary failures in a minute; a photo must never prevent play. */file_put_contents($base.'.stamp','');touch($base.'.stamp',$now-3540);}
            return $this->cached($key);
        }finally{flock($lock,LOCK_UN);fclose($lock);}
    }
    private function cached(string $key): ?string {return is_file($this->dir.'/'.$key.'.jpg')?'https://tg-test-pripyat-game.ru/images/telegram-avatars/'.$key.'.jpg?v='.filemtime($this->dir.'/'.$key.'.jpg'):null;}
}
