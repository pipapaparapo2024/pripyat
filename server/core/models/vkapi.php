<?php
require_once '../../vkapi/vendor/autoload.php';
use \VK\Client\VKApiClient;
use \VK\Client\Enums\VKLanguage;
 
Class VKapi {
	var $api_secret;
	var $app_id;
	
	function __construct($registry) {
		$this->app_id = $registry['app_id'];
		$this->api_secret = $registry['api_secret'];
	}
	
	function api($method, $params) {
		//$resp = [];

		$vk = new VKApiClient('5.199', VKLanguage::RUSSIAN);

		$func = explode('.', $method)[0];
		$meto = explode('.', $method)[1];

		$resp = array('error' => true);

		try{
			$resp = $vk->$func()->$meto($this->api_secret, $params);
		}catch(Exception $e){
			
		}

		return $resp;
	}
}
?>