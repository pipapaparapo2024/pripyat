<?php
    Class Tools {
 
        private $registry;
         
        function __construct($registry) {
            $this->registry = $registry;

        }

        function output($data){
            $data['current_time'] = time();
            $data['req_key'] = $this->registry['req_key'];
            if(isset($data['randoms']))unset($data['randoms']);
            if(isset($data['udata']['randoms']))unset($data['udata']['randoms']);

            $keys = array_keys($data);
            $values = array_values($data);

            for($i = 0; $i < count($keys); $i++){
                if($values[$i] instanceof GMP) $data[$keys[$i]] = gmp_strval($data[$keys[$i]]);
            }

            if(isset($data['udata'])){
                $keys = array_keys($data['udata']);
                $values = array_values($data['udata']);

                for($i = 0; $i < count($keys); $i++){
                    if($values[$i] instanceof GMP) $data['udata'][$keys[$i]] = gmp_strval($data['udata'][$keys[$i]]);
                }
            }

            if(isset($data['boss'])){
                $keys = array_keys($data['boss']);
                $values = array_values($data['boss']);

                for($i = 0; $i < count($keys); $i++){
                    if($values[$i] instanceof GMP) $data['boss'][$keys[$i]] = gmp_strval($data['boss'][$keys[$i]]);
                }
            }

            echo json_encode($data, JSON_UNESCAPED_UNICODE);  
        }

        function refresh($user, $names, $save = false){
            if(!$user)$user = $this->registry['udb']->getData($this->registry['utb'], array('*'), 'id='.$this->registry['uid']);

            if(isset($user['error']))return $user;

            for($i = 0; $i < count($names); $i++){
                $name = 'refresh'.ucfirst(strtolower($names[$i]));
                $user = $this->$name($user);
            }

            if($save)$this->registry['udb']->saveData($this->registry['utb'], $user);

            return $user;
        }
 
        function error($code){
            $list = $this->registry['json']->get('errors', true);
            $entry = null;
            if(is_array($list) && isset($list[$code]) && is_array($list[$code])){
                $entry = $list[$code];
            } else if(is_array($list)){
                foreach($list as $e){
                    if(is_array($e) && isset($e['code']) && intval($e['code']) === intval($code)){
                        $entry = $e;
                        break;
                    }
                }
            }
            if(!$entry) $entry = ['text' => 'Ошибка '.$code, 'code' => intval($code)];
            $this->output(array('status'=>'error', 'text'=>$entry['text'], 'code'=>$entry['code'], 'req_key'=>$this->registry['req_key']));
        }

        //SERVICE MICROFUNCTIONS

        function summ($v1, $v2){//Суммирует любые числа или массивы. Массивы по ключам (прим. [1,5,6]+[3,2,2]=[4,7,8])
            $value1 = []; $value2 = [];
            is_array($v1) ? $value1 = $v1 : array_push($value1,$v1);
            is_array($v2) ? $value2 = $v2 : array_push($value2,$v2);
            foreach($value1 as $k => $v)array_key_exists($k,$value2) ? $value2[$k] += $v : $value2[$k] = $v;

            if(count($value2) < 2)$value2 = $value2[0];
 
            return $value2;
        }

        function getLevelPlus($exp, $levels){
            $level = 0;
            if($exp < $levels[0])return $level;

            list($start, $plus) = $levels;

            $level = 1;
            
            $add = $start;

            while(true){
                if($start + $plus + $add > $exp)return $level;
                $level++;
                $start += $plus;
                $add += $start;
            }
            
            return $level;
        }

        function getExpPlus($level, $levels){
            list($start, $plus) = $levels;
	
            $exp = $add = $start;

            if($level < 2)return $level * $start;
            
            for($i = 1; $i < $level; $i++){
                $exp += $plus + $add;
                $add += $plus;
            }
            
            return $exp;
        }

        function getLevel($exp){ //считает любой уровень
            return floor(1 + log(1 + intval($exp)/10) / log(2));     
        }
 
        function winRandom($min, $max){
            $rand1 = rand($min, $max);
            $rand2 = rand($min, $max);
            if($rand1 == $rand2)return true;
                 
            return false;
        }
		
		function random($num){
			$rnd = (floor(4294967296 * sin($num)) & 65535) / 65536;
			
			return $rnd;
		}

        function isComplete($code, $learn){//возвращает true для битовой маски, которая содержит число кратное 2 (прим. learn 11 = 1+2+8 вернет true при code = 1,2 или 8)
            $res = $learn & $code;
            if($res !== $code)return false;
            return true;
        }

        function toKeyVals($data){
			if(!is_array($data))return array('keys' => 'key', 'values' => $data);

			return array('keys' => array_keys($data), 'values' => array_values($data));
		}
 
        function __autoload($class_name) {
            $filename = strtolower($class_name).'.php';
 
            $file = 'core/models/'.$filename;
 
            if (!file_exists($file)) return false;
 
            include ($file);
        }
    }
?>