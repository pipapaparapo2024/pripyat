<?php
require __DIR__.'/habar-lifecycle747.php';
$source=file_get_contents(__DIR__.'/../../server/core/controllers/weapons.php');$source=preg_replace('/^require_once __DIR__.*weaponprogress.php.*$/m','',$source);eval(str_replace(['<?php','new mysqli('],['','new HabarSql747('],$source));
fresh747();$slots=array_fill(0,6,[]);$slots[3]=['qty'=>10,'acquired_total'=>100];HabarSql747::$row['weapons']=json_encode($slots);$registry['user_params']=['weapon_id'=>3,'mult'=>10];
(new Weapons($registry))->buy();$slots=json_decode(HabarSql747::$row['weapons'],true);verify747($slots[3]['qty']===20 && $slots[3]['acquired_total']===110,'weapon purchase not counted exactly once');verify747(intval(HabarSql747::$row['coins'])===60,'weapon price changed');
echo "Weapon shop: x10 adds exactly ten lifetime weapons and preserves the purchased inventory\n";
