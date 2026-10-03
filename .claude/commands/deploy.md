# Скилл: deploy — полный деплой проекта

Выполняется только когда пользователь явно написал «деплой».

## Шаги по порядку:

1. **Сборка** (из директории `_client`):
```bash
cd C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/_client && npm run build
```
Если ошибка `ERROR in` — остановиться, показать ошибку пользователю.
Предупреждения `WARNING` — игнорировать.

2. **Версия** — поднять счётчик в `_client/development/index.html`:
`index.js?v=N` → `index.js?v=N+1`

3. **FTP upload** — ОБЯЗАТЕЛЬНО оба места:
```bash
cd C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat

bash upload.sh "_client/development/libs/index.js" "ftp://45.159.208.173/client/ver0_41/development/libs/index.js"
bash upload.sh "_client/development/libs/index.js" "ftp://45.159.208.173/client/ver0_41/libs/index.js"
bash upload.sh "_client/development/index.html" "ftp://45.159.208.173/client/ver0_41/development/index.html"
bash upload.sh "_client/development/index.html" "ftp://45.159.208.173/client/ver0_41/index.html"
```

4. **Если в деплой входят новые изображения с кириллицей** — использовать URL-кодирование:
```bash
for f in "файл.png"; do
  ENCODED=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1]))" "$f")
  curl --user "ftp_stalker:4cAEjHfC3dHYsf5b" -T "_client/development/images/$f" "ftp://45.159.208.173/client/ver0_41/images/$ENCODED" -s && echo "OK: $f"
done
```

5. **Итог**: сообщить новую версию и список загруженных файлов.
