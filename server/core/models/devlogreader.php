<?php
// Raw messages and payloads never leave the server.
class DevLogReader {
    public static function project($text) {
        $rows = [];
        $files = array_map('basename', array_merge(glob(dirname(__DIR__,2).'/*.php'), glob(dirname(__DIR__).'/controllers/*.php'), glob(__DIR__.'/*.php')));
        foreach (explode("\n", $text) as $line) {
            if (trim($line) === '') continue;
            $row = ['event' => 'application'];
            if (preg_match('/^\[(\d{2}-[A-Za-z]{3}-\d{4} \d{2}:\d{2}:\d{2})(?: [A-Za-z_\/]+)?\]/', $line, $m)) $row['time'] = $m[1];
            foreach (['PHP Fatal error'=>'fatal', 'PHP Warning'=>'warning', 'PHP Parse error'=>'parse', 'PHP Notice'=>'notice', '[ok_pay_callback'=>'ok-payment', '[universal_pay'=>'payment', '[universal.execute]'=>'request', '[universal.checkToken]'=>'authorization'] as $marker=>$event) {
                if (strpos($line, $marker) !== false) { $row['event'] = $event; break; }
            }
            if (in_array($row['event'], ['request','authorization'], true) && preg_match('/код ([0-8])\b/u', $line, $code)) $row['code'] = intval($code[1]);
            if(strpos($line,'[native-prod-pay]')!==false){
                $row['event']='payment';
                foreach(['platform'=>['vk','ok'],'stage'=>['catalog','rejected','credited','duplicate'],'mode'=>['real','sandbox'],'reason'=>['invalid_signature','wrong_app','production_notifications_only','developer_required','unknown_product','invalid_order','price_mismatch','transaction_conflict','unknown_player','temporarily_unavailable','account_mapping_missing','product_or_price_mismatch']] as $key=>$allowed){
                    if(preg_match('/\b'.$key.'=([a-z_]+)\b/',$line,$m)&&in_array($m[1],$allowed,true))$row[$key]=$m[1];
                }
                foreach(['product','price'] as $key)if(preg_match('/\b'.$key.'=([0-9]{1,7})\b/',$line,$m))$row[$key]=(int)$m[1];
            }
            if ($row['event'] === 'application') continue;
            foreach (['mysqli_sql_exception'=>'database_error', 'Too many connections'=>'database_connections', 'Connection refused'=>'connection_refused', 'Unknown column'=>'database_column', 'Undefined array key'=>'array_key', 'Call to undefined function'=>'undefined_function', 'Call to a member function'=>'undefined_object', 'TypeError'=>'type_error', 'Failed opening required'=>'missing_file', 'Permission denied'=>'permission_denied', 'syntax error'=>'syntax_error', 'invalid sig'=>'signature_rejected', 'НЕ СОВПАЛО'=>'signature_rejected'] as $needle=>$reason) {
                if (strpos($line,$needle)!==false) { $row['reason']=$reason; break; }
            }
            if (preg_match('/\b([a-zA-Z0-9_-]+\.php)(?::| on line )(\d{1,6})/', $line, $source) && in_array($source[1],$files,true)) {
                $row['file']=$source[1]; $row['line']=intval($source[2]);
            }
            $rows[] = $row;
        }
        return array_slice($rows, -150);
    }
    public static function read() {
        $fp = @fopen(dirname(__DIR__, 2) . '/php_errors.log', 'rb');
        if (!$fp) return ['entries'=>[], 'available'=>false, 'truncated'=>false];
        try {
            return self::tail($fp);
        } finally { fclose($fp); }
    }
    public static function tail($fp) {
            $stat = fstat($fp); $offset = max(0, $stat['size'] - 65536);
            fseek($fp, $offset); $text = stream_get_contents($fp, 65536);
            if ($offset > 0) { $pos = strpos($text, "\n"); $text = $pos === false ? '' : substr($text, $pos + 1); }
            return ['entries'=>self::project($text), 'available'=>true, 'truncated'=>$offset > 0];
    }
}
