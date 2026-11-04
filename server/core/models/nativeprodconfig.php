<?php
final class NativeProdConfig {
    public static function load(): array {
        $path=getenv('PRIPYAT_NATIVE_PROD_CONFIG');
        if(!$path||!is_file($path))throw new RuntimeException('maintenance');
        $c=json_decode(file_get_contents($path),true,32,JSON_THROW_ON_ERROR);
        if(!is_array($c)||($c['environment']??'')!=='prod')throw new RuntimeException('maintenance');
        return $c;
    }
}
