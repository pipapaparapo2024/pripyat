<?php
final class DevPlayerReset {
 public static function apply($link,string $table,int $uid,array $defaults):array {
  if($uid<=0||!preg_match('/^[a-z_]+$/D',$table))throw new InvalidArgumentException('invalid_reset_target');
  $defaults=array_merge($defaults,['level'=>0,'weapon_machete'=>0,'weapon_pistol'=>0,'weapon_ak'=>0,'stew_spent'=>0,'pvp_wins'=>0,'gym_invites_sent'=>0,'zaruba_cooldowns'=>null,'dvor_daily_sigs'=>null,'energy'=>'50','energy_time'=>time(),'max_energy'=>'50','stash_claims'=>null,'stash_wishlist'=>null,'raznaryadka_data'=>null,'achievement_revoked'=>null,'onboarding_step'=>0,'game2048_session'=>null,'game2048_daily'=>null,'game2048_fragments'=>0,'game2048_games_completed'=>0,'game2048_games_completed_at'=>0,'game2048_lifetime'=>0]);
  $link->begin_transaction();
  try {
   $row=$link->execute_query("SELECT id FROM `$table` WHERE id=? FOR UPDATE",[$uid])->fetch_assoc();if(!$row)throw new RuntimeException('unknown_player');
   $columns=$link->query("SHOW COLUMNS FROM `$table`");$types=[];while($r=$columns->fetch_assoc())$types[$r['Field']]=$r['Type'];
   $patch=[];foreach($defaults as $key=>$value){if(!isset($types[$key])||$key==='id')continue;if(!preg_match('/^[a-z_0-9]+$/D',$key))throw new RuntimeException('invalid_field');if($value===''&&preg_match('/int|decimal|float|double/',$types[$key]))$value=0;$patch[$key]=$value;}
   if(!$patch)throw new RuntimeException('empty_reset');
   $sets=implode(',',array_map(fn($k)=>'`'.$k.'`=?',array_keys($patch)));$link->execute_query("UPDATE `$table` SET $sets WHERE id=?",[...array_values($patch),$uid]);
   foreach(['boss_damage_log'=>'uid','boss_instance_claims'=>'uid','boss_last_kill'=>'user_id'] as $name=>$field){$q=$link->execute_query('SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?',[$name])->fetch_assoc();if((int)$q['n']>0)$link->execute_query("DELETE FROM `$name` WHERE `$field`=?",[$uid]);}
   $link->commit();return $patch;
  }catch(Throwable $e){$link->rollback();throw $e;}
 }
}
