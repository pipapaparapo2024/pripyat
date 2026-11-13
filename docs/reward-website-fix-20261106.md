# Наградные ссылки сайта — 06.11.2026

Проверка реального сервера выявила: генератор писал в stalker_test/stalker_ok_test, социальный сайт входил в stalker/stalker_ok. Код не сохранялся social OAuth, email login и bootstrap; site runtime возвращал getRewardCode=null. В проверенных пяти БД было 0 reward_link_claims; в текущих трёх игровых мирах 0 активных хабаров. Ложное впечатление получения не подтверждено ledger.

Исправлено: RewardIntent хранит код/платформу/expiry3600 в серверной сессии, сверяет формат и соответствие платформы. Social start и email actions сохраняют intent, bootstrap отдаёт только код своей платформы. SiteRuntime и reward-link читают его. Ссылка страницы уже вошедшего пользователя сохраняет query. Страница reward принимает test/prod коды, не утверждает, что вход не реализован.

Генератор теперь использует явно заданное окружение website: VK->stalker/prod, OK->stalker_ok/prod, email->stalker_site_test/test, TG->stalker_telegram_test/test. Данные кампаний/получений не переносились, старые TEST ссылки остаются своими TEST ссылками. Для выдачи текущим социальным персонажам нужны новые ссылки. Admin config резервирован в /var/backups/reward-world-fix-20261106T090147Z, публикация сайта /var/backups/site-auth-20261106T090150Z. Схемы и native bundle не менялись.

Целевые тесты reward-intent и reward-platform-isolation (дополнен текущим website mapping) прошли. Webpack успешно. Полный прогон см. временный pripyat-rewards-fix-tests.log.

Открыто: ошибка сохранения прогресса со скриншота не воспроизведена, пользовательский сценарий уточняется. Журналы содержат DomainException social gateway без секретов, конкретная причина снимка пока не установлена. Нельзя объявлять это исправленным или считать реальную выдачу подтверждённой до входа и claim через свежую ссылку. Старый sidebar/admin status «активна» означает активность ссылки, не получение игроком.
