# Вход через Telegram на сайте — TEST

## Состояние на 09.11.2026

Подготовлен и опубликован закрытый экран ручной проверки: `https://pripyat-game-site.ru/telegram-login-test.html`. Обычная главная страница сайта и её VK/OK/email-вход не изменялись.

Маршруты Telegram status, test-access, start, callback, bootstrap и logout обслуживает отдельный обработчик сайта. Telegram OIDC использует TLS-маршрут через Амстердам на порту `10444`; JWKS Telegram получен через этот маршрут. Token endpoint и реальную авторизацию проверит владелец во время входа.

TEST-флаги website Telegram-входа включены, но OAuth не доступен без персонального тестового пропуска. Ссылка несёт пропуск только во фрагменте URL; скрипт удаляет его из адресной строки и отправляет по HTTPS в POST. В PHP-сессии доступ живёт до часа, пропуск — меньше суток. Без сессии пропуска status сообщает `providers.telegram=false`, а прямой `/auth/telegram/start` отвечает 403. Маршруты OIDC отключены из access log, ответы имеют `Referrer-Policy: no-referrer`.

На сайте TEST Telegram allowlist содержит только ID владельца `1355806786`; Mini App TEST и его собственный список участников не менялись. Используется тот же персонаж и `stalker_telegram_test`. SQL/DDL не запускался. PROD, GitHub и главная форма входа не менялись.

## Проверки

- `npm test`: базовые 97 проверок и все 811 тестовых файлов прошли.
- OIDC unit tests: RS256/JWKS, claims, точный Telegram ID, PKCE, state, nonce и защита повторного callback.
- Live smoke: `/auth/telegram/status` — 200, без пропуска провайдер скрыт; прямой старт — 403. С пропуском статус включает вход, `/auth/telegram/start` отвечает 302 на `oauth.telegram.org` с правильным callback и PKCE S256.
- Проверены действительность JWKS через relay, PHP syntax, `php-fpm8.5 -t`, `nginx -t`; сервисы перечитали конфигурацию.
- Резервная копия последней публикации: `/var/backups/pripyat-telegram-website-login-test-20261109T113642Z`.

Проверка авторизационного кода Telegram и итогового запуска игры требуют ручного шага владельца по выданной в чате персональной ссылке. При входе веб-игра обновит активную сессию Telegram-персонажа; по текущему правилу одна новая сессия отзывает предыдущую сессию этого персонажа в Telegram Mini App.

## TEST-выпуск поддержки и живой оплаты владельца — 10.11.2026

- Веб-обработчики и сборка TEST опубликованы в `/var/www/pripyat-site`; Telegram OIDC, страница игры, checkout и уведомления обслуживает отдельный `php8.5-fpm-site-test` и `stalker_telegram_test`. Доступ закрыт персональным временным пропуском и allowlist Telegram ID владельца `1355806786`.
- Путь до игрового магазина и YooKassa проверен без создания заказа: действующий боевой магазин доступен только владельцу в preview, TEST-ключ остаётся отдельным. Живая покупка, если её совершит владелец, реально спишет деньги и зачислит товар персонажу Telegram TEST. Перед покупкой владелец должен понимать, что это не тестовая транзакция YooKassa.
- Для живого Telegram TEST-заказа установлен `receipt_mode=manual`, `manual_receipts_acknowledged=true`, `receipt_automation_ready=false`: текущая служба НПД Чек охватывает сайт/ВК/ОК и пока не обрабатывает Telegram TEST. Владелец вручную оформляет чек для пробной покупки согласно ранее согласованному режиму; расширение службы чеков — отдельная работа.
- В TEST runtime опубликованы обработчик поддержки и `telegramenvironment.php`. `/start` показывает кнопку поддержки; `/support` и `/paysupport` открывают меню категорий. Пользовательские обращения хранятся в закрытом каталоге окружения; `/supportlist` скрыт из общей команды и доступен владельцу в персональной команде. Telegram TEST webhook на `tg-test-pripyat-game.ru:8443` оставлен без изменений.
- Команда `/start` и отправка фото ещё требуют повторной проверки владельцем непосредственно в чате. Публичная картинка отвечает HTTP 200 (`image/jpeg`, 953603 байта).
- До и после настройки TEST payment ledger содержал 4 заказа и 1 receipt; новые строки не добавлялись. Нет DDL, операций над прогрессом игроков, PROD runtime/config, GitHub публикаций или создания оплаты агентом.
- Проверки: `npm test` — 97 базовых и 814 файлов, без падений; `npm run build:website` успешен с advisory по размеру одного JS-файла; checkout readiness — live/ready только в owner preview и с БД `stalker_telegram_test`; PHP lint, nginx/FPM конфигурации и HTTP smoke проходят.
- Резервные копии: `/var/backups/pripyat-telegram-website-login-test-20261110T104057Z`, `/var/backups/telegram-support-welcome-test-20261110T104212Z`, `/var/backups/telegram-website-live-test-config-20261110T105328Z`. Персональный тестовый URL выдан владельцу в чате и истекает в течение суток.

10.11.2026 повторная правка TEST inbox: после получения жалобы или ответа сотрудника бот удаляет соответствующее Force Reply сообщение. `/supportread` и `/supportreply` больше не являются командами бота: сотрудник выбирает обращение и отвечает кнопками из `/supportlist`. `/refund` убран из меню, но owner-only обработчик возврата Stars сохранён. TEST опубликован с backup `/var/backups/telegram-support-welcome-test-20261110T111618Z`; обновлено меню команд без изменения webhook. Проверен доступ команд, `npm test` — 97 базовых и 814 файлов, 0 падений.

## Повтор callback после первой попытки

09.11.2026 владелец прошёл подтверждение в Telegram, после чего callback сайта вернул 401 `authentication_rejected`. Nginx access log для OIDC отключён; старый обработчик намеренно не журналировал тип и стадию отказа, поэтому точная причина не сохранилась. Скриншот подтверждает возврат на callback, но не позволяет определить, отказал ли session/state или проверка id_token.

Добавлено безопасное журналирование в закрытый файл `/var/lib/pripyat-site-test/website-auth-diagnostics.log`: стадия, класс исключения и только код причины из фиксированного allowlist. Значения code/state/token/claims и текст произвольных исключений не записываются. Файл доступен только root и пользователю PHP пула `pripyat-site-test`. Перед публикацией файл включается в backup/rollback. После следующего входа проверить этот журнал и исправить причину; старый callback повторно не принимать.

09.11.2026: диагностика опубликована только на TEST. Резервная копия: `/var/backups/pripyat-telegram-website-login-test-20261109T133427Z`. Проверены права журнала `0660 root:pripyat-site-test`, status/preview gate, новый OAuth start и PKCE; SQL, PROD и GitHub не менялись. Владельцу выдан новый временный TEST URL в чате. После ручного входа проверить закрытый журнал, затем по зафиксированным стадии/reason устранить сам 401.

09.11.2026: журнал подтвердил отказ после проверки подписи JWT (`invalid_jwt_claims`). Новый запрос соответствует серверному Authorization Code Flow из документации Telegram: одноразовый state, PKCE S256 и серверный обмен кода без запроса nonce. Для прежних запросов с nonce его сравнение обязательно. Telegram ID по-прежнему берётся из подписанного `id`. Отдельная страница `/game/telegram-test.html` подключает сборку с Telegram bootstrap. Проверены OIDC и закрытый доступ, сборка и хеши опубликованных JS. Резервная копия TEST: `/var/backups/pripyat-telegram-website-login-test-20261109T140133Z`. Живой вход проверяется по событиям `accepted stage=callback` и `accepted stage=game_session`.

09.11.2026 владелец подтвердил успешный вход и разрешил две таблицы для рублёвых покупок Telegram TEST. Созданы site_payment_orders/site_payment_receipts по database/telegram-website-rub-test.proposed.sql. Перед DDL сохранён полный dump stalker_telegram_test в закрытой /var/backups/telegram-rub-prepare-20261109T160508Z; определения прежних таблиц сверены без изменений.

Исправление 401 покупки 09.11.2026. Подтверждено по закрытой серверной сессии без вывода токена: реальный JWT Telegram имеет exp-iat=30 секунд. Сайт ошибочно ограничивал собственную сессию этим exp. Теперь callback проверяет JWT и сохраняет проверенную личность на сервере на 3600 секунд. Bootstrap и оплата используют эту личность после проверки срока сессии, preview/allowlist и CSRF, а оплата дополнительно сверяет действующий игровой token_hash с той же Telegram ID. Токен провайдера в новой сессии не хранится. Старой сессии требуется новый вход. Отказы website_session_expired, website_session_relogin_required, website_game_token_missing и website_game_session_revoked получают reference и пишутся в закрытый журнал. OIDC regression и TEST smoke прошли. Backup /var/backups/pripyat-telegram-website-login-test-20261109T164309Z. Ручная покупка после нового входа ожидается.

Владелец провёл тестовую покупку. 09.11.2026 API ЮKassa повторно подтвердил succeeded, paid=true, test=true, RUB 7.00, game_world=telegram_test. В заказе игрока 20 начислено 4 stew, одна квитанция, текущая stew=1000008. Два других заказа pending, начисления нет. Дополнительных начислений при аудите не выполнялось.

Аватар на сайте при Telegram-входе исправлен через telegramavatars.get для своего и других профилей. Кешированное фото игрока 20 существует, HTTPS отвечает 200. up.ava для website Telegram установлен x=12,y=10 по скриншоту пользователя. Регрессии аватаров, сборка и HTTPS-хеши прошли; TEST backup /var/backups/pripyat-telegram-website-login-test-20261109T164833Z. Визуальный результат в браузере владельца ещё не подтверждён.

На TEST опубликована рублёвая оплата через тестовый магазин ЮKassa. Резервная копия файлов /var/backups/pripyat-telegram-website-login-test-20261109T160511Z. Конфигурация website_rub_payments находится внутри telegram в /etc/pripyat/website-auth-test.json, только test=true. POST payment-create/payment-status требуют preview, CSRF, проверенный JWT и действующую игровую сессию соответствующего Telegram ID. Платёжный мир telegram_test проверяется по ответу API провайдера. Начисление использует mutex Telegram и транзакцию с однократной квитанцией.

Создание настоящего тестового счёта ЮKassa и статус pending проверены tools/smoke-telegram-website-rub.php. Начисление и повтор проверены с имитацией succeeded на TEMPORARY таблицах, без записи балансов игроков. Права PHP-пула и enabled=true проверены отдельно. Соответствующие тесты оплаты/OIDC/Stars и сборка сайта прошли. В persistent таблицах после smoke 0 заказов. Оплата в браузере владельцем ещё требуется. Проверка status при возвращении в игровую вкладку начисляет подтверждённую покупку. Endpoint /auth/telegram/payment-notification реализован, его регистрация в кабинете тестового магазина не подтверждена; API управления webhooks с текущим ключом отвечает 401. Полный успешный платёж и доставка уведомления пока не подтверждены.
