# -*- coding: utf-8 -*-
"""Генерация .webp рядом с каждым PNG, который реально используется игрой.

28.09.2026 (оптимизация под мобильные). Зачем: арт игры лежит в PNG, а PNG для такой графики
весит в 5-7 раз больше необходимого. Замер по выборке из списка прелоада: 12.3 МБ PNG -> 1.7 МБ
WebP q=90 (-86%). Весь стартовый прелоад — 109 МБ PNG, это ~15 МБ в WebP.

ВАЖНО: скрипт НИЧЕГО не удаляет и не переименовывает. Он кладёт "файл.png.webp" рядом с
"файл.png". Имена картинок в коде не меняются вообще — подмену делает nginx по заголовку
Accept браузера (см. tools/nginx_images.conf): поддерживает WebP — отдаём .webp, не
поддерживает (старый клиент) — тот же PNG, что и раньше. Поэтому откат = убрать location-блок
из nginx, файлы можно даже не трогать.

Используется только там, где картинка ДЕЙСТВИТЕЛЬНО грузится в рантайме: имя файла ищется в
исходниках `_client/src`, в скомпилированных FLA-библиотеках `_client/development/libs/*.js`,
в `server/json/*.json` и в `server/**/*.php`. Исходники для Animate (images/layers/, 1580
файлов, 169 МБ) рантайм не запрашивает — для них .webp не создаётся.

Запуск: python tools/make_webp.py [--force]
"""
import os, sys, io, glob
from PIL import Image

ROOT   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGES = os.path.join(ROOT, '_client', 'development', 'images')
# Мелкие элементы интерфейса (тонкие рамки, текст в картинке) кодируем без потерь — экономия
# там меньше, зато нет шанса получить артефакты на чётких краях. Крупный арт — q=90.
LOSSLESS_UNDER = 64 * 1024
QUALITY        = 90

def used_names():
    blob = []
    for root, _, files in os.walk(os.path.join(ROOT, '_client', 'src')):
        for f in files:
            if f.endswith('.js'):
                blob.append(io.open(os.path.join(root, f), encoding='utf-8', errors='ignore').read())
    for pat in ('_client/development/libs/*.js', 'server/json/*.json', 'server/**/*.php'):
        for p in glob.glob(os.path.join(ROOT, pat), recursive=True):
            blob.append(io.open(p, encoding='utf-8', errors='ignore').read())
    return '\n'.join(blob)

def main():
    force = '--force' in sys.argv
    text  = used_names()
    made = skipped = 0
    png_b = webp_b = 0
    for root, _, files in os.walk(IMAGES):
        for f in files:
            if not f.lower().endswith('.png'):
                continue
            if f not in text:
                continue
            src = os.path.join(root, f)
            dst = src + '.webp'
            png_b += os.path.getsize(src)
            if os.path.exists(dst) and not force and os.path.getmtime(dst) >= os.path.getmtime(src):
                webp_b += os.path.getsize(dst); skipped += 1; continue
            im = Image.open(src).convert('RGBA')
            if os.path.getsize(src) < LOSSLESS_UNDER:
                im.save(dst, 'WEBP', lossless=True, method=4)
            else:
                im.save(dst, 'WEBP', quality=QUALITY, method=4)
            webp_b += os.path.getsize(dst); made += 1
    print('создано: %d, пропущено (уже свежие): %d' % (made, skipped))
    print('PNG:  %8.1f МБ' % (png_b / 1048576))
    print('WebP: %8.1f МБ  (-%.0f%%)' % (webp_b / 1048576, 100 * (1 - webp_b / png_b) if png_b else 0))

if __name__ == '__main__':
    main()
