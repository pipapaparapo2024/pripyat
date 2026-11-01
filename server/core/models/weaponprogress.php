<?php
class WeaponProgress {
    static function total($slot, $minimum = 0){
        if(!is_array($slot)) $slot=[];
        return max(0, intval($minimum), intval($slot['qty'] ?? 0), intval($slot['acquired_total'] ?? 0));
    }
    static function acquire(&$slot, $amount, $stockBefore = 0){
        $slot['acquired_total'] = self::total($slot,$stockBefore) + max(0,intval($amount));
    }
    static function seed(&$slot, $stockBefore = 0){
        $slot['acquired_total'] = self::total($slot,$stockBefore);
    }
}
