# Контекст для продолжения работы

Дата: 13 ноября 2026
Репозиторий: C:\Users\HONOR\Downloads\pripyat-main\pripyat-main

## Цель владельца

Завершить пакет по оплатам и админке наградных ссылок: подробная история платежей, фоновая сверка заказов ЮKassa со статусом pending, обязательный Google Authenticator TOTP для сайта админки и первичная привязка приложения, тесты и выкладка на TEST, PROD и GitHub.

Не выполнять миграции и произвольные изменения данных игроков. Успешное зачисление только после проверки succeeded через API ЮKassa и штатный идемпотентный SitePayments::settle() является ожидаемой функцией сверки.

## Git и проверки

Локальный HEAD и origin/main: 0ee6654 «Исправить регрессию Windows и добавить недостающие зависимости оплаты». Предыдущие коммиты пакета: 00c2ba9 и 93efdc9.

В чистой копии 0ee6654 полный прогон прошёл: 97 базовых проверок и 814 тестовых файлов. Это не покрывает живую фоновую сверку и вход TOTP через PHP-FPM.

Важные незакоммиченные изменения:
- docs/CONTINUE_HERE.md — добавлена запись о незавершённом пакете.
- rewards-admin/config.php — меняет website/test конфигурацию и VK/OK reward targets на PROD. Это чувствительное изменение, нельзя включать в релиз без отдельного аудита.
- website/app/rewardstotp.php — добавлена Base32-функция, после добавления отдельно не тестировалась.
- website/app/rewardstotp-gate.php — fail-closed и экран enrollment. Последняя редакция не проверена lint/test.

Рабочая папка содержит много чужих незакоммиченных правок. Не выполнять git add ., не затирать изменения, коммитить файлы точечно.

## Что уже опубликовано

Нативный клиент TEST и PROD ранее сверены на bundle 72a703779193, одинаковый SHA256. Изменение рейтинга 2048 опубликовано на обеих площадках и в GitHub.

Диагностика заказов ранее выкладывалась на сайт PROD. Страница покупок закрыта Basic Auth, без авторизации отвечает 401. В ней показываются заказы и детали, но будущая история попыток сверки/доставки уведомлений ещё не реализована полностью.

Таймер reconcile не установлен. TOTP gate не подключён и не проверен в изолированном rewards-admin PHP-FPM. Не заявлять пакет готовым.

## Контуры сервера

VPS: 135.106.159.212.
- Нативный TEST: /var/www/stalker-native-test
- Нативный PROD: /var/www/stalker-native-prod
- Сайт: /var/www/pripyat-site
- Изолированная TEST-админка наград: /var/www/pripyat-rewards-test
- Rewards FPM pool: /etc/php/8.5/fpm/pool.d/pripyat-rewards-test.conf
- Rewards config: /etc/pripyat/rewards-admin-test.json
- История покупок: /var/www/pripyat-site/app/rewardspurchases.php, маршрут /rewards-admin/purchases.php направлен в сайт-test FPM.
- Генератор наград /rewards-admin/index.php и журнал /logs.php направлены в отдельный rewards-test FPM.
- В rewards FPM включён ограниченный open_basedir. Для секретного state TOTP потребуется проверить путь и права доступа.
- Systemd timer сверки не найден.
- Config Telegram payments существует в /etc/pripyat/telegram-website-payment-prod.json. Секреты не выводить.

## Исходники функций

- website/app/sitedonations.php — формирует список покупок.
- website/app/rewardspurchases.php — показывает детали заказа.
- website/app/sitepayments.php — штатная транзакционная и идемпотентная выдача.
- server/site-payments-webhook.php — webhook перепроверяет статус платежа через API.
- tools/site-payment-reconcile.php и tools/run-site-payment-reconcile.php — основа выборки pending и CLI запуска, но timer отсутствует.
- website/app/rewardstotp.php, website/app/rewardstotp-gate.php — логика TOTP, незавершённая и не подключена к действующему FPM.
- tests/_php_fixtures/rewards-totp.php — тест-векторы.

## Порядок продолжения

Сверить локальные файлы с текущими TEST/PROD и прочитать AGENTS.md, docs/BACKUP_REMINDER.md, docs/CONTINUE_HERE.md. Сначала закончить и протестировать enrollment, обязательный challenge, replay guard, ограничение повторов, сессию и прямые входы во все admin routes. TOTP не включать fail-closed до provisioned state и проверенной процедуры восстановления.

Довести reconcile runner с жёстким allowlist миров/БД, журналированием результата каждой попытки без секретов и systemd timer. Не использовать живых игроков для smoke-тестов. Интеграционные тесты проводить на mock provider и временных таблицах, проверить succeeded/canceled/pending/error/replay/concurrency.

Затем прогнать целевые тесты, полный npm test, сборку, PHP lint и nginx -t. Проверить TEST по HTTPS и через соответствующий FPM. После успешной проверки опубликовать на TEST, PROD и GitHub согласно разрешению владельца. Точечно коммитить файлы. Не менять структуру или данные игроков вручную.

## Текущий честный статус

Пакет незавершён. Таймер не включён. TOTP provisioning и веб-вход не завершены. Незакоммиченные изменения gate и MD ещё не прошли повторные проверки. Не утверждать, что полный пакет выложен.
