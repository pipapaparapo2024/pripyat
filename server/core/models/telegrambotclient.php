<?php
final class TelegramBotClient {
    private $token,$network,$request;
    public function __construct(string $token,string $network='production',$request=null){
        if(!in_array($network,['production','test'],true))throw new InvalidArgumentException('invalid_bot_network');
        $this->token=$token;$this->network=$network;$this->request=$request;
    }
    private function apiUrl(string $method): string {
        if(!preg_match('/^[A-Za-z][A-Za-z0-9]+$/D',$method))throw new InvalidArgumentException('invalid_bot_method');
        return 'https://api.telegram.org/bot'.$this->token.'/'.($this->network==='test'?'test/':'').$method;
    }
    public function downloadFile(string $path): string {
        if(!preg_match('~^[A-Za-z0-9_/-]+\.(?:jpg|jpeg|png)$~D',$path)||str_contains($path,'..'))throw new InvalidArgumentException('invalid_file_path');
        $bytes='';$ch=curl_init('https://api.telegram.org/file/bot'.$this->token.'/'.($this->network==='test'?'test/':'').$path);
        curl_setopt_array($ch,[CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>3,CURLOPT_TIMEOUT=>6,CURLOPT_WRITEFUNCTION=>function($ch,$chunk)use(&$bytes){if(strlen($bytes)+strlen($chunk)>2097152)return 0;$bytes.=$chunk;return strlen($chunk);}]);
        $ok=curl_exec($ch);$status=curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
        if($ok===false||$status!==200)throw new RuntimeException('photo_download_failed');return $bytes;
    }
    public function call(string $method,array $body) {
        $url=$this->apiUrl($method);
        if($this->request){
            $r=($this->request)($url,$body);
            if(!is_array($r)||($r['ok']??false)!==true)throw new RuntimeException('bot_request_failed');
            return $r['result']??null;
        }
        $timeout=in_array($method,['getUserProfilePhotos','getFile'],true)?4:($method==='answerPreCheckoutQuery'?7:15);
        $ch=curl_init($url);
        curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($body?:new stdClass),CURLOPT_HTTPHEADER=>['Content-Type: application/json'],CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>3,CURLOPT_TIMEOUT=>$timeout]);
        $raw=curl_exec($ch);curl_close($ch);$r=json_decode($raw?:'',true);
        if(!($r['ok']??false))throw new RuntimeException('bot_request_failed');
        return $r['result']??null;
    }
}
