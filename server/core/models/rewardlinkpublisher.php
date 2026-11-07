<?php
require_once __DIR__.'/rewardlinktargets.php';
/** Each selected world gets an independent definition, receipt ledger, and opaque code. */
final class RewardLinkPublisher {
    private $environment,$connect;
    public function __construct(string $environment,callable $connect){
        if($environment!=='website')RewardLinkTargets::database($environment,'vk');$this->environment=$environment;$this->connect=$connect;
    }
    private function targetEnvironment(string $platform):string{return $this->environment==='website'?(in_array($platform,['vk','ok'],true)?'prod':'test'):$this->environment;}
    public function create(array $platforms,array $reward,string $label,int $ttl,int $now): array {
        if(!$platforms||count($platforms)>4||count(array_unique($platforms,SORT_REGULAR))!==count($platforms)||!$reward||count($reward)>6||$ttl<0||$ttl>604800||strlen($label)>255)throw new InvalidArgumentException('invalid_reward');
        // Validate the entire selection before opening any database connection.
        foreach($platforms as $platform){if(!is_string($platform))throw new InvalidArgumentException('invalid_reward_target');RewardLinkTargets::database($this->targetEnvironment($platform),$platform);}
        foreach($reward as $entry){
            if(!is_array($entry))throw new InvalidArgumentException('invalid_reward_entry');
            $kind=$entry['kind']??'';
            if($kind==='currency')$valid=in_array($entry['field']??'', ['coins','cigarettes','stew','respect','exp','energy','ammo_auto','ammo_gun','ammo_machete'],true)&&is_int($entry['amount']??null)&&$entry['amount']>0&&$entry['amount']<=2147483647;
            elseif($kind==='shmot')$valid=is_int($entry['itemId']??null)&&$entry['itemId']>=0&&$entry['itemId']<=10000;
            elseif($kind==='key')$valid=is_int($entry['bossId']??null)&&$entry['bossId']>=0&&$entry['bossId']<=7&&is_int($entry['amount']??null)&&$entry['amount']>0&&$entry['amount']<=2147483647;
            elseif($kind==='habar')$valid=is_int($entry['containerId']??null)&&$entry['containerId']>=0&&$entry['containerId']<=3;
            else $valid=false;
            if(!$valid)throw new InvalidArgumentException('invalid_reward_entry');
        }
        $json=json_encode($reward,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);$result=[];
        foreach($platforms as $platform){
            $database=RewardLinkTargets::database($this->targetEnvironment($platform),$platform);$code=RewardLinkTargets::code($this->targetEnvironment($platform),$platform);
            try{
                $db=($this->connect)($database);
                if($db->query('SELECT DATABASE()')->fetchColumn()!==$database)throw new RuntimeException('reward_database_mismatch');
                $q=$db->prepare('INSERT INTO reward_links (code,reward,label,created_at,expires_at,active) VALUES (?,?,?,?,?,1)');
                $q->execute([$code,$json,$label,$now,$ttl>0?$now+$ttl:null]);
                $result[$platform]=['created'=>true,'code'=>$code,'url'=>RewardLinkTargets::url($this->targetEnvironment($platform),$platform,$code)];
            }catch(Throwable $e){
                // Other worlds are independent; report partial creation explicitly.
                $result[$platform]=['created'=>false,'error'=>'reward_creation_failed'];
            }
        }
        return $result;
    }
}
