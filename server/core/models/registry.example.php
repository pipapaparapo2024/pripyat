<?php
// Шаблон локальной конфигурации.
// Скопируйте этот файл как registry.php ТОЛЬКО на сервере или в локальной рабочей копии.
// registry.php намеренно находится в .gitignore и никогда не коммитится.

Class Registry Implements ArrayAccess {
    private $vars = array(
        'classes' => array('users','security','event','vassilich','habar','hapuga','shmot','base','gangs','bp','tasks','top','bosses','roulette','zone','dice','yashik','weapons','skills','poker','blackjack','zaruba','ryukzak','hata','achievements','rewardlinks','dvor'),
        'balabols' => array(),
        'names' => array(),
        'api_service' => 'SET_ON_SERVER',
        'api_secret' => 'SET_ON_SERVER',
        'api_id' => 0,
        'server' => '127.0.0.1',
        'user' => 'SET_ON_SERVER',
        'pass' => 'SET_ON_SERVER',
        'db' => 'stalker',
        'utb' => 'users'
    );

    function __construct(){
        if(($_POST['platform'] ?? '') === 'ok') $this->vars['db'] = 'stalker_ok';
    }
    function set($key, $var) { if(isset($this->vars[$key])) return false; $this->vars[$key] = $var; return true; }
    function offsetSet($key, $var): void { $this->vars[$key] = $var; }
    function offsetExists($key): bool { return isset($this->vars[$key]); }
    function offsetUnset($key): void { unset($this->vars[$key]); }
    function offsetGet($key): mixed { return $this->vars[$key] ?? null; }
}
