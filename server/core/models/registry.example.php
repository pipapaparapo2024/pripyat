<?php
// Example only. Configure private values locally; never commit registry.php.

	Class Registry Implements ArrayAccess {
    	private $vars = array('classes'=>array('users','security','event','vassilich','habar','hapuga','shmot','base','gangs','bp','tasks','top','bosses','roulette','zone','dice','yashik','weapons','skills','poker','blackjack','zaruba','ryukzak','hata','achievements','rewardlinks','dvor','raznaryadka','game2048','zanachki'),
							  'balabols'=>array(),
							  'names'=>array(),
							  'api_service'=>'SET_ON_SERVER',
							  'api_secret'=>'SET_ON_SERVER',
							  'api_id'=>0,
							  // Новый сервер (155.212.211.202) — локальный MySQL на 127.0.0.1:3306,
							  // база/юзер называются просто "stalker" (без _test). Старые значения
							  // (192.168.0.172, stalker_test) остались от прежнего хостинга и были
							  // недостижимы отсюда — это и вызвало 504 у реальных игроков.
							  'server'=>'127.0.0.1',
							  'user'=>'SET_ON_SERVER',
							  'pass'=>'SET_ON_SERVER',
							  'db'=>'stalker',
							  'utb'=>'users');

        // 05.10.2026 (платежи ОК через FAPI.UI.showPayment — уточнение по прямому вопросу
        // пользователя "можно ли найти application_secret_key, если кабинета ОК отдельно нет"):
        // ПРОВЕРЕНО дословной цитатой apiok.ru/apps/vk — "Секретный ключ остаётся идентичным
        // приложению в ВКонтакте" (отличается только app_id, не секрет). Отдельного ok_api_secret
        // для кросспостинг-приложений НЕ существует — server/ok_pay_callback.php использует
        // api_secret выше напрямую, отдельный ключ заводить не нужно и неоткуда.

        // Модерация ОК (02.10.2026, п.6 отказа: прогресс не должен синхронизироваться между
        // ОК и VK) — на Пути A (см. memory project_stalker_ok_audit) ОК рендерит ТОТ ЖЕ бандл
        // через ТОТ ЖЕ VK Bridge с ТЕМИ ЖЕ api_id/api_secret, поэтому единственный способ
        // развести игроков по разным БД — явный параметр 'platform', который клиент шлёт с
        // каждым запросом (modules/server.js.loadReq(), определяется в modules/platform.js по
        // referrer/ancestorOrigins встраивающей страницы). Это НЕ ослабляет проверку подписи в
        // security.php.getToken() — она по-прежнему идёт по общему api_secret, читать/писать
        // чужой прогресс так нельзя; клиент лишь выбирает, в какую ИЗ ДВУХ пустых песочниц
        // писать СВОЙ собственный прогресс. Любое отсутствующее/незнакомое значение (старые
        // клиенты без этого поля, прямой заход в браузере, VK) — безопасный дефолт 'stalker',
        // поведение для всех текущих игроков не меняется.
        function __construct(){
            if(($_POST['platform'] ?? '') === 'ok'){
                $this->vars['db'] = 'stalker_ok';
            }
        }

        function set($key, $var) {
	        if (isset($this->vars[$key]) == true) return false;

	        $this->vars[$key] = $var;

	        return true;
		}

	     function get($key) {
		   	  if (isset($this->vars[$key]) == false) return null;

		      return $this->vars[$key];
	     }

      	function remove($key) {
      		unset($this->vars[$key]);
      	}


		function offsetExists($offset): bool
		{
			return isset($this->vars[$offset]);
		}

		function offsetGet($offset): mixed
		{
			return $this->get($offset);
		}

		function offsetSet($offset, $value): void
		{
			$this->set($offset, $value);
		}

		function offsetUnset($offset): void
		{
			unset($this->vars[$offset]);
		}
	}
?>