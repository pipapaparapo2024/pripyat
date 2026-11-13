<?php
require_once __DIR__.'/telegramenvironment.php';
/** Private TEST allowlist. No SQL, usernames, request parameters or developer roles grant access. */
final class TelegramAccess {
    const OWNER='1355806786';
    private $path;
    public function __construct(?string $path=null){$this->path=$path??TelegramEnvironment::stateDirectory().'/access.json';}
    public static function canUseStars(string $id): bool {return $id===self::OWNER||(TelegramEnvironment::name()==='prod'&&self::validId($id));}
    public static function validId(string $id): bool {return preg_match('/^[1-9][0-9]{0,15}$/D',$id) && strlen($id)<=16 && (int)$id<=4503599627370495;}
    private function read(): array {
        if(!is_file($this->path))return [];
        $data=json_decode(file_get_contents($this->path),true,32,JSON_THROW_ON_ERROR);
        if(!is_array($data)||!isset($data['allowed'])||!is_array($data['allowed']))throw new RuntimeException('access_config_invalid');
        return array_values(array_filter($data['allowed'],fn($id)=>is_string($id)&&self::validId($id)));
    }
    public function allowed(string $id): bool {return self::validId($id)&&(TelegramEnvironment::name()==='prod'||$id===self::OWNER || in_array($id,$this->read(),true));}
    public function listing(string $actor): array {if($actor!==self::OWNER)throw new InvalidArgumentException('owner_only');return array_values(array_unique(array_merge([self::OWNER],$this->read())));}
    public function change(string $actor,string $id,bool $allow): void {
        if($actor!==self::OWNER)throw new InvalidArgumentException('owner_only');
        if(!self::validId($id))throw new InvalidArgumentException('invalid_telegram_id');
        if($id===self::OWNER)throw new InvalidArgumentException('owner_is_permanent');
        $lock=fopen($this->path.'.lock','c+');if(!$lock||!flock($lock,LOCK_EX))throw new RuntimeException('access_lock_failed');
        $tmp=null;
        try{
            chmod($this->path.'.lock',0600);$ids=$this->read();$ids=array_values(array_filter($ids,fn($v)=>$v!==$id));if($allow)$ids[]=$id;
            $tmp=$this->path.'.'.bin2hex(random_bytes(8)).'.tmp';
            $json=json_encode(['allowed'=>$ids],JSON_THROW_ON_ERROR);
            if(file_put_contents($tmp,$json)!==strlen($json)||!chmod($tmp,0600)||!rename($tmp,$this->path))throw new RuntimeException('access_write_failed');
        }finally{if($tmp&&is_file($tmp))unlink($tmp);flock($lock,LOCK_UN);fclose($lock);}
    }
}
