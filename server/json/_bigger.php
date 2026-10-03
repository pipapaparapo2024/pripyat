<?php
	$names = [
		'donuts'
	];

	$output = [];

	for($i = 0; $i < count($names); $i++)$output[$names[$i]] = json_decode(file_get_contents($names[$i].'.json'), true);

	$f = fopen('_bigger.json', 'w');
    fputs($f, json_encode($output, JSON_UNESCAPED_UNICODE));
    fclose($f);
?>