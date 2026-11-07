<?php
/** Транзакционная почта сайта; без SMTP-реквизитов в ошибках/логах. */
final class SiteMailer {
 public function __construct(private array $config) {}
 public function send(string $recipient,string $subject,string $text): void {
  $c=$this->config;
  if(($c['enabled']??false)!==true||($c['host']??'')!=='smtp.mail.selcloud.ru'||($c['port']??0)!==1127||($c['encryption']??'')!=='tls')throw new RuntimeException('mail_disabled');
  foreach([$recipient,$c['from_email']??''] as $email)if(!filter_var($email,FILTER_VALIDATE_EMAIL)||strpbrk($email,"\r\n")!==false)throw new InvalidArgumentException('invalid_email');
  if(!str_ends_with(strtolower($c['from_email']),'@pripyat-game-site.ru')||strpbrk($subject,"\r\n")!==false)throw new InvalidArgumentException('invalid_mail_headers');
  $boundary='pripyat_'.bin2hex(random_bytes(18));
  $html=self::html($subject,$text);
  $message='From: =?UTF-8?B?'.base64_encode('Припять').'?= <'.$c['from_email'].">\r\nTo: <".$recipient.">\r\nSubject: =?UTF-8?B?".base64_encode($subject)."?=\r\nMIME-Version: 1.0\r\nContent-Type: multipart/alternative; boundary=\"".$boundary."\"\r\nDate: ".gmdate('D, d M Y H:i:s +0000')."\r\nMessage-ID: <".bin2hex(random_bytes(16))."@pripyat-game-site.ru>\r\n\r\n";
  foreach(['text/plain'=>$text,'text/html'=>$html] as $type=>$body)$message.='--'.$boundary."\r\nContent-Type: ".$type."; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n".chunk_split(base64_encode($body),76,"\r\n");
  $message.='--'.$boundary."--\r\n";
  $stream=fopen('php://temp','w+');fwrite($stream,$message);rewind($stream);
  $ch=curl_init('smtps://smtp.mail.selcloud.ru:1127');
  curl_setopt_array($ch,[CURLOPT_USERNAME=>$c['username'],CURLOPT_PASSWORD=>$c['password'],CURLOPT_MAIL_FROM=>$c['from_email'],CURLOPT_MAIL_RCPT=>[$recipient],CURLOPT_UPLOAD=>true,CURLOPT_INFILE=>$stream,CURLOPT_INFILESIZE=>strlen($message),CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>15,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2]);
  try{if(curl_exec($ch)===false)throw new RuntimeException('mail_delivery_failed');}finally{curl_close($ch);fclose($stream);}
 }
 public static function html(string $subject,string $text): string {
  $escape=fn($s)=>htmlspecialchars($s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
  preg_match('~https://pripyat-game-site\.ru/account/\?[^\s]+~',$text,$match);
  $url=$match[0]??'https://pripyat-game-site.ru/account/';
  $button=str_contains($url,'action=reset')?'Изменить пароль':'Подтвердить почту';
  return '<!doctype html><html lang="ru"><meta charset="utf-8"><body style="margin:0;padding:24px;background:#171d1d;color:#eee6cf;font:16px/1.6 Arial,sans-serif"><table role="presentation" style="max-width:600px;width:100%;margin:auto;background:#252c29;border:1px solid #8c7951;border-radius:18px;overflow:hidden"><tr><td><img src="https://pripyat-game-site.ru/assets/mail-zone.jpg" width="600" alt="Припять — выживание в Зоне" style="display:block;width:100%;height:auto"></td></tr><tr><td style="padding:32px;text-align:center"><p style="letter-spacing:5px;color:#d3b56b">☢ ПРИПЯТЬ</p><h1 style="font-size:25px">'.$escape($subject).'</h1><p>Остался один шаг, чтобы продолжить путь в Зоне.</p><p style="margin:30px 0"><a href="'.$escape($url).'" style="display:inline-block;padding:14px 26px;background:#c6a561;color:#171d1d;text-decoration:none;font-weight:bold;border-radius:9px">'.$button.'</a></p><p>Ссылка действует 30 минут и используется один раз.</p><p style="font-size:13px;color:#bdbba9">Если вы не запрашивали это письмо, ничего делать не нужно.</p><p style="font-size:12px;overflow-wrap:anywhere">Если кнопка не работает:<br><a style="color:#d3b56b" href="'.$escape($url).'">'.$escape($url).'</a></p></td></tr></table></body></html>';
 }
}
