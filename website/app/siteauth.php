<?php
require_once __DIR__.'/siteaccounts.php';require_once __DIR__.'/sitemailer.php';
/** Отдельные HTTP-действия email; вызываются после инициализации защищённой PHP-сессии. */
final class SiteEmailActions {
 public function __construct(private SiteAccounts $accounts,private SiteMailer $mail) {}
 public function handle(string $action,array $input,int $now): array {
  $email=is_string($input['email']??null)?$input['email']:'';
  $password=is_string($input['password']??null)?$input['password']:'';
  if(!in_array($action,['register','login','verify','resend','forgot','reset','set-password'],true))throw new InvalidArgumentException('invalid_action');
  if($action==='set-password'){
   $pending=$_SESSION['site_registration']??null;if(!is_array($pending)||($pending['expires_at']??0)<=$now)throw new DomainException('login_required');
   $a=$this->accounts->completeRegistration((int)$pending['player_id'],$password);unset($_SESSION['site_registration']);
   $_SESSION['site_pending']=['player_id'=>(int)$a['player_id'],'email'=>$a['email'],'auth_version'=>(int)$a['auth_version'],'expires_at'=>$now+900];
   return ['phone_step'=>true,'text'=>'Пароль сохранён. Теперь подтвердите номер телефона.'];
  }
  if($action==='verify'){
   $id=$this->accounts->consumeEmailToken((string)($input['token']??''),'verify_email',$now);
   $a=$this->accounts->verifiedAccount($id);session_regenerate_id(true);
   if((int)$a['password_required']===1){unset($_SESSION['site_pending']);$_SESSION['site_registration']=['player_id'=>$id,'expires_at'=>$now+900];return ['password_step'=>true,'text'=>'Почта подтверждена. Придумайте пароль для аккаунта.'];}
   unset($_SESSION['site_pending'],$_SESSION['site_registration']);
   return ['email_verified'=>true,'login_required'=>true,'text'=>'Почта подтверждена. Войдите с вашим паролем.'];
  }
  if($action==='reset'){
   $this->accounts->consumeEmailToken((string)($input['token']??''),'reset_password',$now,$password);
   return ['password_reset'=>true,'text'=>'Пароль изменён. Войдите заново.'];
  }
  if($action==='register'){
   $a=$this->accounts->beginRegistration($email,$now);$_SESSION['site_registered']=['player_id'=>(int)$a['player_id'],'expires_at'=>$now+1800];$this->send($a['player_id'],$a['email'],'verify_email',$now);
   return ['verification_sent'=>true,'text'=>'Письмо подтверждения отправлено. Проверьте почту.'];
  }
  if($action==='forgot'){
   $a=$this->accounts->recoveryAccount($email);
   if($a)$this->send((int)$a['player_id'],$a['email'],'reset_password',$now);
   return ['text'=>'Если аккаунт зарегистрирован, письмо для смены пароля отправлено.'];
  }
  $a=$this->accounts->verifyPassword($email,$password);
  if($action==='resend'||$a['email_verified_at']===null){
   $this->send((int)$a['player_id'],$a['email'],'verify_email',$now);
   return ['verification_sent'=>true,'text'=>'Подтвердите почту по отправленному письму.'];
  }
  session_regenerate_id(true);
  $_SESSION['site_pending']=['player_id'=>(int)$a['player_id'],'email'=>$a['email'],'auth_version'=>(int)$a['auth_version'],'expires_at'=>$now+900];
  return ['email_verified'=>true,'phone_step'=>true,'text'=>'Теперь подтвердите номер телефона.'];
 }
 private function send(int $id,string $email,string $purpose,int $now): void {
  $token=$this->accounts->issueEmailToken($id,$purpose,$now);
  $url='https://pripyat-game-site.ru/account/?'.http_build_query(['action'=>$purpose==='verify_email'?'verify':'reset','token'=>$token]);
  $reset=$purpose==='reset_password';
  $this->mail->send($email,$reset?'Припять: восстановление доступа':'Припять: подтверждение почты',($reset?'Для смены пароля':'Для подтверждения почты')." откройте ссылку:\n".$url."\n\nСсылка действует 30 минут и используется один раз. Если вы не запрашивали письмо, ничего делать не нужно.");
 }
}
