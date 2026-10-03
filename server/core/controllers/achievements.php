<?php
    // ── SERVER-AUTHORITATIVE ДОСТИЖЕНИЯ (23.09.2026) ── см. подробный разбор в
    // server/core/models/achievement_engine.php. Единственный эндпоинт — sync(): клиент НЕ
    // присылает никаких данных, сервер сам читает актуальную строку игрока и сверяет её со
    // всем каталогом достижений — никакого доверия к клиентским числам.
    Class Achievements {
        private $registry, $ops;

        public $permits;

        function __construct($registry){
            $this->registry = $registry;
            $this->ops = new Gameops($registry);
            $this->permits = ['sync'];
        }

        private function _catalog(){
            return $this->ops->catalog('achievements_config');
        }

        function sync(){
            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            $catalog = $this->_catalog();
            if(!is_array($catalog)) return $this->ops->fail(99);

            list($user, $newlyEarned) = AchievementEngine::checkAll($this->ops, $user, $catalog);

            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);

            $patch = $this->ops->patchCurrencies($user, ['achievement_stars', 'ach_score', 'bullets', 'achievements']);
            $this->ops->ok(['patch' => $patch, 'newly_earned' => $newlyEarned]);
        }
    }
?>
