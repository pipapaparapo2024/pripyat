<?php

	Class Database {
		private $link; //коннект к MySQL
		private $permis;
		private $results;
		private $sample;
		private $registry;
		
		function __construct($registry){
			// Порт 3306 — реальный порт MySQL на новом сервере (155.212.211.202); старый
			// хостинг слушал на 6033, отсюда этот "магический" номер был везде в коде.
			$this->link = mysqli_connect($registry['server'], $registry['user'], $registry['pass'], $registry['db'], 3306);
			$this->registry = $registry;

			$this->permis = ['wid', 'id', 'did'];

			$this->results = [];
			$this->sample = false;
		}

		function getData($table, $fields, $where = 1, $as_array = false){ //table[String], fields[Array], where[String], as_array[Boolean]
			$response = $this->link->query("SELECT ".implode(",", $fields)." FROM ".$table." WHERE ".$where); //спрашиваем у БД такие данные

			$data = [];

			// error logged server-side

			$this->sample = $this->registry['db_sampler']->load($table);

			if(!isset($response->num_rows) || $response->num_rows < 1){
				$data = array('error' => true); //если не нашлось данных
			}else if($response->num_rows > 1 || $as_array){ //ЕСЛИ ДЕЛАЕМ ВЫБОРКУ ТОПА НАПРИМЕР
				while($row = mysqli_fetch_array($response, MYSQLI_ASSOC))array_push($data, $this->trueJSON($row)); //закидываем в пронумерованный массив
			}else{
				$data = $this->trueJSON(mysqli_fetch_array($response, MYSQLI_ASSOC));//ЕСЛИ 1 результат

				$data['req_counter'] = count($this->results);
				array_push($this->results, json_encode($data));
			}

			return $data;
		}

		function deleteData($table, $where){
			if(!$where)return;

			$this->link->query("DELETE IGNORE FROM ".$table." WHERE ".$where); //Удалить строку обязательно, без вывода данных
		}

		function trueSQL($query, $as_array = false){
			$data = $this->link->query($query);

			$this->sample = false;

			if(!isset($data->num_rows) || $data->num_rows < 1){
				$data = array('error' => true); //если не нашлось данных
			}else if($data->num_rows > 1 || $as_array){ //ЕСЛИ ДЕЛАЕМ ВЫБОРКУ ТОПА НАПРИМЕР
				while($row = mysqli_fetch_array($data, MYSQLI_ASSOC))array_push($data, $this->trueJSON($row)); //закидываем в пронумерованный массив
			}else{
				$data = $this->trueJSON(mysqli_fetch_array($data, MYSQLI_ASSOC));//ЕСЛИ 1 результат

				$data['req_counter'] = count($this->results);
				array_push($this->results, json_encode($data));
			}

			return $data;
		}

		function saveData($table, $data){
			/*if($table == 'users'){
				print_r($data);
			}*/


			$sqlSet = $this->toSQL($data); //делаем правильную SQL-строку
			$this->link->query("INSERT INTO ".$table." SET ".$sqlSet." ON DUPLICATE KEY UPDATE ".$sqlSet); //если id-а еще нет, то вставляем, а если есть - обновляем

			// 29.09.2026 (СРОЧНО, по прямому указанию — репорт "связка ключей не выдалась",
			// найдено по ходу дела: claimKeyring() исторически проваливался в 13 из 14 живых
			// попыток по error_log, но РЕАЛЬНАЯ причина SQL-отказа нигде не логировалась — этот
			// комментарий ("error logged server-side") годами утверждал обратное. $this->link->error
			// реально проверялся строкой ниже, но само сообщение об ошибке никогда никуда не
			// писалось — диагностировать конкретный отказ задним числом было physически
			// невозможно. Теперь при реальной ошибке SQL пишем её текст + затронутую таблицу в
			// error_log сразу же, до возврата результата вызывающему коду.
			if($this->link->error){
				error_log('[Database.saveData] SQL error table=' . $table . ' error=' . $this->link->error . ' sql=' . substr($sqlSet, 0, 500));
			}

			$data = array('error' => false);

			$this->link->error?$data['error'] = true:$data['id'] = $this->link->insert_id; //если не нашлось данных выдаем ошибку. если нашли - выдаем id (если явно индекс не задали)

			$this->sample = false;


			return $data;
		}

		function toSQL($array){
			$array = $this->trueStrings($this->validateChanges($array));

			$sql="";
	   		$keys  = array_keys($array);
	    	$values =  array_values($array);
	    
	    	for($i = 0; $i < count($keys); $i++){
	        	if(count(explode("`", $values[$i])) > 1){
	        		$sql .= "`".implode('', (array)$keys[$i])."`=".$values[$i]; //если делаем что-то вроде `gold`=`gold`+1
	        	}else{
	        		// mysqli_real_escape_string, а не голая конкатенация: без этого json_encode()
	        		// (напр. без JSON_UNESCAPED_UNICODE) может записать в литерал буквальный `\`,
	        		// который MySQL молча отбрасывает при чтении — так пропадали экранированные
	        		// символы (нашли на кириллице в poker_session/blackjack_session, но баг общий
	        		// для любого `\`/`'` в значении, не только для JSON_UNESCAPED_UNICODE-кейса).
	        		$escaped = mysqli_real_escape_string($this->link, implode('', (array)$values[$i]));
	        		$sql .= "`".implode('', (array)$keys[$i])."`='".$escaped."'"; //если нужно просто сохранить данные
	        	}
	        	if($i < count($keys)-1)$sql.=",";
	    	}

	   		return $sql;
		}

		function trueJSON($array){
			$keys  = array_keys($array);
	    	$values =  array_values($array);

	    	for($i = 0; $i < count($keys); $i++){
				$value = [];

				if($this->sample){	

					switch ($this->sample->table[$keys[$i]]['php_type']) {
						case 'gmp':
							$array[$keys[$i]] = gmp_init($array[$keys[$i]]);
							break;
						
						case 'json':
							$array[$keys[$i]] = $array[$keys[$i]] !== null?json_decode($array[$keys[$i]], true): json_decode($this->sample->table[$keys[$i]]['default'], true);
							break;

						case 'int':
							$array[$keys[$i]] = intval($array[$keys[$i]]);
							break;
						
						default:
							# code...
							break;
					}

				}else{
					if ($array[$keys[$i]] !== null) $value = json_decode($array[$keys[$i]], true);

					// Баг найден 18.09.2026 ("ник в рейтинге показывает ARRAY"): 'nick'/'nickname' —
					// обычные строковые поля (игровой позывной), а не JSON-блобы, но не были в этом
					// исключении рядом с 'name'/'balabol'. Пустая строка (значение по умолчанию,
					// напр. после сброса аккаунта или у нового игрока) проходила `'' == null` (true
					// в PHP) и подменялась на пустой МАССИВ []. Дальше PHP-код вроде
					// strval($row['nick'] ?? '') получал непустой (!) массив [] и strval() от
					// массива в PHP буквально возвращает строку "Array" — она и показывалась в UI.
					// 25.09.2026 (тот же класс бага — "ник победителя рулетки показывается
					// повреждённым/СТАЛКЕР"): roulette_winner хранит JSON-строку {"name":...,
					// "amount":...} — json_decode() выше успешно парсил её в массив (это ПОХОЖЕ
					// на JSON-блоб, но по факту строковое поле, как nick/nickname), после чего
					// trueStrings() (см. ниже) перекодировал её обратно БЕЗ JSON_UNESCAPED_UNICODE
					// при следующем saveUser() — кириллица в имени превращалась в \uXXXX-escape.
					// 26.09.2026 (найдено по репорту "PHP Warning: Array to string conversion
					// ... roulette.php on line 186" на КАЖДОМ спине uid=657771445, живые логи
					// подтвердили — slotResult всегда {"slotIdx":0,"reward":null}, т.е. rulette
					// была ЗАФОРСЕНА на пустой слот, а не просто шумела в лог): ТОТ ЖЕ класс
					// бага задевает ВСЕ 4 личных одноразовых dev-force флага
					// (dev_force_dice/dev_force_poker/dev_force_blackjack/dev_force_roulette,
					// см. users.php.setDevCombo()) — обычные строковые поля, дефолт ''. '' ==
					// null здесь тоже true → подменялись на [] → каждый контроллер читал их
					// через strval($user['dev_force_X'] ?? ''), strval([]) в PHP молча
					// возвращает буквально "Array" (это НЕ пустая строка!) → код думал, что
					// форс АКТИВЕН, и делал intval("Array")=0 — то есть КАЖДЫЙ спин рулетки
					// форсился на idx=0 (пустой слот), КАЖДАЯ раздача блэкджека молча
					// ЗАТИРАЛА настоящий pity-forcedRank (AA/KK/QQ) значением "Array" (спасало
					// только отдельное совпадающее исправление в blackjack.php._dealRealPair,
					// добавленное чуть раньше в тот же день), а покер жёг 200 попыток на
					// невозможный comboKey="Array" и падал в честную раздачу мимо весового
					// _rollCombo(). Т.е. это не косметический лог-шум, а реальная порча RNG
					// для всех 4 казино-игр у ЛЮБОГО игрока с дефолтным (неиспользованным)
					// dev-force флагом — фикс здесь закрывает баг в источнике сразу для всех.
					// 27.09.2026 (репорт — "энергия визуально копится до 50, но потратить нельзя,
					// после перезагрузки снова 50"): ТОТ ЖЕ класс бага, что dev_force_*/nick выше,
					// но для ЧИСЛОВЫХ полей — 'energy'/'max_energy'/'energy_time'/'energy_spent'
					// хранятся как VARCHAR (см. карту udata в CLAUDE.md), и когда игрок реально
					// тратит всю энергию в ноль, в БД лежит буквально строка "0". `"0" == null`
					// в PHP истинно (bool/null-сравнение приводит ОБЕ стороны к bool — "0" и null
					// оба false), значит без исключения ниже `$array['energy']` подменялся бы на
					// пустой массив [] РОВНО в тот момент, когда энергия становится 0 — то есть
					// именно тогда, когда точность этого поля важнее всего. Дальше по цепочке:
					// клиент получает udata.energy=[] вместо "0", JS `parseInt([])` = NaN,
					// timers.js.updateFromUdata() видит `isNaN(saved)` и молча пропускает синхронизацию
					// energy с сервером — TIMERS.current_energy остаётся на дефолте конструктора
					// (ENERGY_MAX=50), поэтому HUD показывает полную энергию. Сервер же читает то
					// же поле через Gameops::i()=intval([])=0 и ЗАКОНОМЕРНО отклоняет fillCheckpoint
					// (fail(56), см. zone.php) — отсюда расхождение "визуально 50, потратить нельзя",
					// воспроизводящееся на каждой перезагрузке, пока баланс энергии не отойдёт от 0.
					$isStringField = $keys[$i] === 'name' || $keys[$i] === 'balabol'
						|| $keys[$i] === 'nick' || $keys[$i] === 'nickname' || $keys[$i] === 'roulette_winner'
						|| $keys[$i] === 'dev_force_dice' || $keys[$i] === 'dev_force_poker'
						|| $keys[$i] === 'dev_force_blackjack' || $keys[$i] === 'dev_force_roulette'
						|| $keys[$i] === 'energy' || $keys[$i] === 'max_energy'
						|| $keys[$i] === 'energy_time' || $keys[$i] === 'energy_spent';
					if ($array[$keys[$i]] == null and !$isStringField) $array[$keys[$i]] = [];

					// Аудит 18.09.2026 (продолжение того же бага): исключение выше защищало
					// только NULL/пустую строку — но nick.js не ограничивает символы ника
					// (только maxLength=15), значит игрок мог легитимно назвать себя буквально
					// "[]"/"{}"/"[1,2]" и т.п. — валидный JSON-массив/объект. Эта ветка ниже
					// решала, что раз json_decode() успешно распарсил строку в массив — значит
					// поле "на самом деле" JSON-блоб, и подменяла $array['nick'] на этот массив
					// БЕЗ проверки имени поля вообще. Тот же strval($row['nick']) снова получал
					// массив и снова печатал "Array" — теперь уже для строк, похожих на JSON, а
					// не только для null/пустых. Строковые поля (nick/nickname/name/balabol)
					// исключены и здесь — их сырое строковое значение никогда не подменяется.
					if (is_array($value) and !$isStringField) {
						ksort($value);
						$array[$keys[$i]] = $value;
					}
				}
	    		
	    	}

	    	return $array;
		}

		function trueStrings($array){
			$keys  = array_keys($array);
	    	//$values =  array_values($array);

	    	for($i = 0; $i < count($keys); $i++){

	    		if(!is_array($array[$keys[$i]]))continue; //чтобы не гонять зря цикл
	    		unset($array[$keys[$i]][-1]); //убираем из массива любое значение с индексом -1. Отлов бага, так сказать

	    		ksort($array[$keys[$i]]);

	    		$array[$keys[$i]] = json_encode($array[$keys[$i]]);
	    	}

	    	return $array;
		}

		function validateChanges($data){
			if(!isset($data['req_counter']))return $data;

			$start_array = json_decode($this->results[$data['req_counter']], true);

			$keys  = array_keys($data);
	    	$values =  array_values($data);

	    	for($i = 0; $i < count($keys); $i++){
				if($values[$i] instanceof GMP) $values[$i] = $data[$keys[$i]] = gmp_strval($data[$keys[$i]]);
	    		if($values[$i] == $start_array[$keys[$i]] && !in_array($keys[$i], $this->permis))unset($data[$keys[$i]]);
	    	}

	    	return $data;
		}
	}
?>