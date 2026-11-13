<?php
final class SitePaymentAccess {
 public static function allowed(string $world,string $identity,array $payments=[]):bool {
  if(!in_array($world,['site','vk','ok'],true)||$identity==='')return false;
  if(($payments['public_checkout']??false)===true
   &&($payments['require_test_payment']??null)===false
   &&($payments['receipt_mode']??'')==='npdcheck'
   &&($payments['receipt_automation_ready']??false)===true)return true;
  return in_array($identity,['site'=>['bedzanansergej5110@gmail.com','fleeexim@gmail.com','mr.vladimirkhikaev@gmail.com'],'vk'=>['382448269','438953352','184138040'],'ok'=>['587256562321']][$world]??[],true);
 }
}
