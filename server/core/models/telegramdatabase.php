<?php
/** Legacy game persistence with TG-only protection of canonical friendship projections. */
class TelegramDatabase extends Database {
    public function saveData($table,$data){
        if($table==='users')unset($data['friends'],$data['friends_since'],$data['friends_scope_granted']);
        return parent::saveData($table,$data);
    }
}
