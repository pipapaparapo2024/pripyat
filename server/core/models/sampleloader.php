<?php

        Class SampleLoader {

                function load($name){
                    $file = 'core/samples/tables/'.strtolower($name).'.php';

                	if (!is_readable($file)) return false;

                	if(!class_exists(($name . '_tbsample')))include ($file);

                    return new ($name.'_tbsample')();
                }
	}

?>