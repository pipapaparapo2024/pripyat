# Закрытая публикация: сайт ОК и левая рука — 06.11.2026

Пользователь явно разрешил закрытый PROD, без публичного допуска.

- index.resize: okBannerViewport enabled только isOk() && !window.__siteRuntime. На сайте через ОК используется вся область браузера (вписывание16:9), внутри nativeOK компактная геометрия сохранена. Это не принудительный браузерный Fullscreen API.
- assets/images/левая рука.png заменён точной копией предоставленного файла242x162, webp пересоздан lossless. Источник не уменьшался. В home/hata/player_profile/shmot_shop заданы фиксированные width54,height36 — прежний отображаемый размер, без жёсткого scale.set. Позиции/слои прежние. Manifest изменяет только4 значения hashes/bytes.
- Проверка дружбы VPS: connection-local TEMPORARY tables fixture прошла для site иTG, без изменения реальных пользователей. Проверены pending, recipient-only acceptance, дубликаты, mutual/canonicalTG, decline/self/missing/replay. Кнопки на сайте VK/OK по-прежнему скрыты, социальные списки не менялись.
- Обе сборки успешны (native3size warnings, website1). Полный прогон:784 passed/1failed из785; единственный failure — историческая source-проверка compactOK безwebsite исключения. После обновления ожидаемого gate повторно выполнен весь mobile-viewport-adaptive-hygiene.test.js:48проверок прошли. Новый website-ok-full-viewport и website-friends-button прошли. Остальных падений нет.
- Native client-only PRODv779 backup /var/backups/closed-native-hand-20261106T103603Z; website backup /var/backups/site-auth-20261106T103606Z. Access config byte-identical, allowlist ограничены прежними ID. Первая guarded попытка остановилась до изменения файлов из-за nativeOK whitelist в native_ids при пустом ids, guard исправлен по фактическому контракту. SQL/PHP/payment handlers не публиковались native, службы не перезапускались.
- Визуальная приёмка в авторизованной сессии OK пользователем ещё не выполнена; математические/source регрессии не заменяют её.
