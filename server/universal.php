<?php
	ini_set('error_reporting', E_ALL);
    ini_set('display_errors', 0);
    ini_set('display_startup_errors', 0);
    ini_set('log_errors', 1);
    ini_set('error_log', __DIR__ . '/php_errors.log');

    header('Access-Control-Allow-Origin: *');

    set_time_limit(0);

    ini_set('memory_limit', '1024M');
    
    spl_autoload_register(function($class_name) {
        $file = 'core/models/'.strtolower($class_name).'.php';
        if(!file_exists($file))return false;

        include ($file);
    });

	$registry = new Registry();
	$router = new Router($registry);

    $registry['tools'] = new Tools($registry);
	$router->setPath('core/controllers');
    $registry['router'] = $router;
	$registry['json'] = new Jsonloader;
    $registry['db_sampler'] = new SampleLoader;
    isset($_POST['uid'])?$registry['uid'] = intval($_POST['uid']):$registry['uid'] = 1;
    isset($_POST['ref_uid'])?$registry['ref_uid'] = intval($_POST['user_id']):$registry['ref_uid'] = 1;

    //$testers = ['112354918', '657771445', '184138040', '78167493', '838275098', '605395851', '341365959', '438953352'];
    //if(array_search($registry['uid'], $testers) === false)return $registry['tools']->error(47);

    //$blacklist = [114447244, 547781752, 169804839, 185501163];
    //if(array_search($registry['uid'], $blacklist) !== false)return $registry['tools']->error(47);

    //$auth = md5($registry['api_id'].'_'. $registry['uid'].'_'.$registry['api_secret']);

    //if($_POST['auth'] !== $auth)return $registry['tools']->error(3);

    $registry['user_params'] = json_decode(base64_decode(base64_decode(spec_decode($_POST['params']))), true);

    if(!is_array($registry['user_params']))return $registry['tools']->error(1);
	
    $registry['udb'] = new Database($GLOBALS['registry']);

    execute();

    function execute(){
        $sequreToken = checkToken();

        if(!$sequreToken[0] and $_POST['method'] !== 'security.getToken')return $GLOBALS['registry']['tools']->error($sequreToken[1]);

        $input = explode('.', $_POST['method']);

        // 26.09.2026 (по прямому репорту — "не могу надеть шмотку", код 3 "Истекло время жизни
        // токена", хотя secure-таблица показала токен свежим, до истечения ещё ~30 дней, и
        // checkToken() (уже подробно залогирован ранее в этом же файле) НИ РАЗУ не сработал):
        // выяснилось, что error(3) здесь используется ЕЩЁ в 3 местах ниже — отсев невалидного
        // метода/класса/permit'а — и делит один и тот же код с "токен истёк" из checkToken().
        // Оба источника показывают игроку ОДИНАКОВЫЙ текст "Истекло время жизни токена",
        // хотя реальная причина может быть совершенно другой (опечатка в методе, класс не в
        // whitelist, метод не в permits контроллера). Раньше НИ ОДНА из этих 3 веток не
        // логировала вообще ничего — расследовать было буквально не по чему. Теперь каждая
        // пишет точный снимок того, что реально пришло и что реально не совпало.
        if(!isset($input[1])){
            error_log('[universal.execute] код 3 (метод без точки — "' . strval($_POST['method'] ?? '') . '") | uid=' . $GLOBALS['registry']['uid']);
            return $GLOBALS['registry']['tools']->error(3);//отсеиваем не валидные функции
        }

        $class_name = ucfirst($input[0]);//имя класса с большой буквы
        $method_name = $input[1];//имя метода

        if(validateClass($input[0]) === false){
            error_log('[universal.execute] код 3 (класс "' . $input[0] . '" не в whitelist registry.classes) | uid=' . $GLOBALS['registry']['uid'] . ' | method=' . strval($_POST['method'] ?? ''));
            return $GLOBALS['registry']['tools']->error(3);//если класс не валидный
        }

        if($GLOBALS['registry']['router']->exec($class_name, $method_name) === false){
            error_log('[universal.execute] код 3 (Router::exec вернул false — файл контроллера/permit/callable, см. [Router.exec] выше) | uid=' . $GLOBALS['registry']['uid'] . ' | class=' . $class_name . ' | method_name=' . $method_name);
            return $GLOBALS['registry']['tools']->error(3);//если функция запрещена или не существует
        }
    }

    function validateClass($name){
        return array_search($name, $GLOBALS['registry']['classes']);
    }

    function checkToken(){
        $secure = $GLOBALS['registry']['udb']->getData('secure', array('*'), 'id='.$GLOBALS['registry']['uid']);

        createReqKey();

        // 26.09.2026 (по прямому указанию — "истекло время жизни токена" повторяется без
        // видимой причины, разбор по живой БД в прошлый раз ничего не показал, потому что
        // здесь вообще не было ни одного error_log()): раньше эта функция молча возвращала
        // код ошибки, не оставляя НИКАКОГО следа в php_errors.log — если проблема повторится,
        // расследовать было буквально не по чему, кроме самой БД в текущий момент (который
        // уже мог отличаться от момента сбоя). Теперь каждая ветка отказа логирует полный
        // снимок сравниваемых значений — при повторном сбое будет видно РОВНО ту секунду,
        // когда он произошёл, а не только текущее (уже, возможно, здоровое) состояние.
        $uid = $GLOBALS['registry']['uid'];
        $method = $_POST['method'] ?? '?';

        if(isset($secure['error'])){
            error_log('[universal.checkToken] код 2 (Токен не найден — строки secure нет вообще) | uid=' . $uid . ' | method=' . $method);
            return [false, 2];
        }

        if($_POST['token'] !== $secure['token']){
            error_log('[universal.checkToken] код 5 (несовпадение токена — вероятно открыта вторая вкладка/устройство) | uid=' . $uid
                . ' | method=' . $method
                . ' | postToken=' . substr(strval($_POST['token'] ?? ''), 0, 12) . '…'
                . ' | dbToken=' . substr(strval($secure['token'] ?? ''), 0, 12) . '…');
            return [false, 5];
        }

        if(time() > $secure['time']+$secure['lifetime']){
            error_log('[universal.checkToken] код 3 (истёк токен) | uid=' . $uid . ' | method=' . $method
                . ' | now=' . time() . ' | secure.time=' . $secure['time'] . ' | secure.lifetime=' . $secure['lifetime']
                . ' | tokenAgeSec=' . (time() - intval($secure['time']))
                . ' | expiredAgoSec=' . (time() - (intval($secure['time']) + intval($secure['lifetime']))));
            return [false, 3];
        }

        if($_POST['req_key'] != $secure['req_key']){
            error_log('[universal.checkToken] код 4 (несовпадение req_key — гонка параллельных запросов или сбойный предыдущий ответ) | uid=' . $uid
                . ' | method=' . $method
                . ' | postReqKey=' . strval($_POST['req_key'] ?? '') . ' | dbReqKey=' . strval($secure['req_key'] ?? ''));
            return [false, 4];
        }

        if(intval(date('G')) == 0 && intval(date('i')) < 4)return [false, 6];

        return [true];
    }

    function createReqKey(){
        $GLOBALS['registry']['req_key'] = uniqid();
        $GLOBALS['registry']['udb']->saveData('secure', array('id'=>$GLOBALS['registry']['uid'], 'req_key'=>$GLOBALS['registry']['req_key']));
    }

    function spec_decode($text){
		$a = json_decode('["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z","A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","0","1","2","3","4","5","6","7","8","9"]',true);
		
		$b = json_decode('{"0":"2","1":"5","2":"0","3":"8","4":"6","5":"4","6":"1","7":"3","8":"7","9":"9","b":"a","h":"b","k":"c","d":"d","u":"e","g":"f","t":"g","i":"h","l":"i","a":"j","e":"k","w":"l","r":"m","p":"n","x":"o","y":"p","m":"q","z":"r","c":"s","v":"t","j":"u","s":"v","f":"w","o":"x","q":"y","n":"z","E":"A","G":"B","J":"C","P":"D","L":"E","U":"F","W":"G","S":"H","V":"I","A":"J","N":"K","R":"L","C":"M","Z":"N","X":"O","M":"P","Y":"Q","B":"R","I":"S","H":"T","F":"U","K":"V","Q":"W","O":"X","D":"Y","T":"Z"}',true);
		
		$c = '';
		
		for($i = 0; $i < strlen($text); $i++){
			if(in_array($text[$i],$a)){
				$c = $c.$b[$text[$i]];
			} else {
				$c = $c.$text[$i];
			}
		}
		
		return $c;
	}

?>