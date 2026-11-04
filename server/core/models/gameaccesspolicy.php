<?php
/** Gate for already verified external identities. Never authenticates posted IDs or usernames. */
final class GameAccessPolicy {
    private $platforms;
    public function __construct(array $config){
        $this->platforms=[];
        foreach(['vk','ok','telegram'] as $platform){
            $entry=$config[$platform]??null;
            if(!is_array($entry)||!in_array($entry['mode']??null,['open','allowlist'],true)||!is_array($entry['ids']??null))throw new InvalidArgumentException('invalid_access_policy');
            foreach($entry['ids'] as $id)if(!is_string($id)||!self::validId($id))throw new InvalidArgumentException('invalid_access_identity');
            $this->platforms[$platform]=['mode'=>$entry['mode'],'ids'=>array_values(array_unique($entry['ids']))];
        }
    }
    private static function validId(string $id): bool {return preg_match('/^[1-9][0-9]{0,19}$/D',$id)===1;}
    public function allowed(string $platform,string $verifiedExternalId): bool {
        if(!isset($this->platforms[$platform])||!self::validId($verifiedExternalId))return false;
        $entry=$this->platforms[$platform];return $entry['mode']==='open'||in_array($verifiedExternalId,$entry['ids'],true);
    }
}
