#!/usr/bin/env bash
# Проверка, что правка nginx (tools/nginx_images.conf) реально применилась.
# Запуск: bash tools/check_images_headers.sh
set -u
HOST="https://pripyat-game.ru/client/ver0_41/images"
FILE="layers/popups/location/cp_art/cp_art_k1.png"

echo "— браузер С поддержкой WebP:"
curl -sI -H 'Accept: image/avif,image/webp,*/*' "$HOST/$FILE" \
  | grep -iE '^(HTTP|content-type|content-length|cache-control|vary)' || echo "  запрос не прошёл"

echo
echo "— браузер БЕЗ поддержки WebP (должен получить прежний PNG):"
curl -sI -H 'Accept: image/png,*/*' "$HOST/$FILE" \
  | grep -iE '^(HTTP|content-type|content-length|cache-control)' || echo "  запрос не прошёл"

echo
echo "Ожидаемо: в первом случае content-type: image/webp и заметно меньший content-length;"
echo "во втором — image/png. В обоих — cache-control: public, max-age=31536000, immutable."
