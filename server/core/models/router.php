<?php
        Class Router {
                private $registry;
                private $path;

                function __construct($registry) {
                        $this->registry = $registry;
                }

                function setPath($path) {
                        $this->path = $path;
                }

                function exec($controller, $method){
                        $file = $this->path.'/'.strtolower($controller).'.php';

                        if (!is_readable($file)) return false;

                        include ($file);

                        $controller = new $controller($this->registry);

                        if(array_search($method, $controller->permits) === false)return false;

                        if(!is_callable(array($controller, $method)))return false;

                        $controller->$method();
                }
        }
?>