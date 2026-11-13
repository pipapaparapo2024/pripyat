<?php
final class TelegramBotClient {
    private $token,$network,$request;
    private ?int $relayPort;
    public function __construct(string $token,string $network='production',$request=null,?int $relayPort=null){
        if(!in_array($network,['production','test'],true))throw new InvalidArgumentException('invalid_bot_network');
        if($relayPort!==null&&($relayPort<1024||$relayPort>65535))throw new InvalidArgumentException('invalid_bot_relay_port');
        $this->token=$token;$this->network=$network;$this->request=$request;
        $this->relayPort=$relayPort;
    }
    private function connectionOptions(): array {
        if($this->relayPort===null)return [];
        // CONNECT_TO changes only the TCP destination. Telegram SNI and TLS validation stay intact.
        return [CURLOPT_CONNECT_TO=>['api.telegram.org:443:127.0.0.1:'.$this->relayPort],CURLOPT_PROXY=>''];
    }
    private function apiUrl(string $method): string {
        if(!preg_match('/^[A-Za-z][A-Za-z0-9]+$/D',$method))throw new InvalidArgumentException('invalid_bot_method');
        return 'https://api.telegram.org/bot'.$this->token.'/'.($this->network==='test'?'test/':'').$method;
    }
    public function downloadFile(string $path): string {
        if(!preg_match('~^[A-Za-z0-9_/-]+\.(?:jpg|jpeg|png)$~D',$path)||str_contains($path,'..'))throw new InvalidArgumentException('invalid_file_path');
        $bytes='';$ch=curl_init('https://api.telegram.org/file/bot'.$this->token.'/'.($this->network==='test'?'test/':'').$path);
        curl_setopt_array($ch,[CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>3,CURLOPT_TIMEOUT=>6,CURLOPT_WRITEFUNCTION=>function($ch,$chunk)use(&$bytes){if(strlen($bytes)+strlen($chunk)>2097152)return 0;$bytes.=$chunk;return strlen($chunk);}] + $this->connectionOptions());
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
        curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($body?:new stdClass),CURLOPT_HTTPHEADER=>['Content-Type: application/json'],CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>3,CURLOPT_TIMEOUT=>$timeout] + $this->connectionOptions());
        $raw=curl_exec($ch);$curlError=curl_errno($ch);$status=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
        $methodCode=strtolower($method);
        if($raw===false)throw new RuntimeException('bot_api_transport_'.$methodCode.'_curl_'.$curlError);
        $r=json_decode($raw,true);
        if(!is_array($r)||!($r['ok']??false)){
            $apiCode=is_array($r)&&isset($r['error_code'])?(int)$r['error_code']:0;
            throw new RuntimeException('bot_api_rejected_'.$methodCode.'_http_'.$status.'_api_'.$apiCode);
        }
        return $r['result']??null;
    }
}
