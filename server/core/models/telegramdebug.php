<?php
require_once __DIR__.'/telegramenvironment.php';
final class TelegramDebug {
    public static function read(): array {
        $file='/var/log/pripyat-tg-'.TelegramEnvironment::name().'/php.log';$fp=@fopen($file,'rb');
        if(!$fp)return ['entries'=>[],'available'=>false,'truncated'=>false];
        try{
            $stat=fstat($fp);$offset=max(0,$stat['size']-65536);fseek($fp,$offset);$text=stream_get_contents($fp,65536);
            $rows=DevLogReader::project($text);
            foreach(explode("\n",$text) as $line){
                if(preg_match('/\[telegram-stars\] event=(invoice-created|credited|credit-rejected|refunded)/',$line,$m))$rows[]=['event'=>'telegram-stars','stage'=>$m[1]];
            }
            $support=[];$files=glob(TelegramEnvironment::stateDirectory().'/bot-updates/support-*.json')?:[];
            rsort($files);foreach(array_slice($files,0,30) as $path){$record=json_decode(file_get_contents($path),true);if(is_array($record))$support[]=$record;}
            return ['entries'=>array_slice($rows,-150),'support'=>$support,'available'=>true,'truncated'=>$offset>0];
        }finally{fclose($fp);}
    }
}
