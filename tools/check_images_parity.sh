#!/usr/bin/env bash
# Проверка расхождения картинок между тестом и продом — обязательный шаг "супер деплоя"
# (добавлен 20.10.2026, после того как код задеплоился на прод, а новые ассеты 18-20.10
# остались только на тесте — игрок на проде получил ~330 текстур 404 после деплоя, в котором
# код ссылался на файлы, которых физически не было на диске прода).
#
# Оба сайта живут на ОДНОМ физическом сервере (155.212.211.202) — test-pripyat-game.ru и
# pripyat-game.ru это просто разные папки (/var/www/stalker-test и /var/www/stalker). Поэтому
# синхронизация делается НАПРЯМУЮ на сервере (server-side copy), а не перекачкой туда-обратно —
# так надёжнее для кириллических имён файлов (см. AGENTS.md ПРАВИЛО №5) и быстрее.
#
# Запуск (read-only, ничего не меняет сам по себе):
#   bash tools/check_images_parity.sh
#
# Если найдены расхождения — скрипт печатает список и команду для синхронизации, но НЕ копирует
# ничего сам (супер деплой — явное действие, не побочный эффект проверки).
set -u

echo "Сравниваю images/ (рекурсивно, с подпапками shmot/spine/layers/achievements) теста и прода..."

ssh stalker-vps "python3 -c \"
import os
def list_rel(base):
    out = set()
    for root, dirs, files in os.walk(base):
        for fn in files:
            rel = os.path.relpath(os.path.join(root, fn), base)
            out.add(rel)
    return out
test = list_rel('/var/www/stalker-test/client/ver0_41/images')
prod = list_rel('/var/www/stalker/client/ver0_41/images')
missing = sorted(test - prod)
extra = sorted(prod - test)
print(f'test: {len(test)} файлов, prod: {len(prod)} файлов')
if not missing and not extra:
    print('✅ ИДЕНТИЧНЫ — расхождений нет')
else:
    if missing:
        print(f'\n❌ {len(missing)} файлов есть на тесте, но ОТСУТСТВУЮТ на проде:')
        for m in missing[:50]: print(' -', m)
        if len(missing) > 50: print(f'   ... и ещё {len(missing)-50}')
        with open('/tmp/images_missing_on_prod.txt', 'w') as f:
            for m in missing: f.write(m + chr(10))
        print('\nСписок сохранён на сервере: /tmp/images_missing_on_prod.txt')
    if extra:
        print(f'\n⚠️  {len(extra)} файлов есть на проде, но отсутствуют на тесте (обычно не проблема, но стоит знать):')
        for e in extra[:20]: print(' +', e)
\""

echo
echo "Если есть расхождения — синхронизировать так (server-side copy, безопасно для кириллицы):"
echo '  ssh stalker-vps "python3 -c \"'
echo "import os, shutil"
echo "src = '/var/www/stalker-test/client/ver0_41/images'"
echo "dst = '/var/www/stalker/client/ver0_41/images'"
echo "with open('/tmp/images_missing_on_prod.txt') as f: files = [l.rstrip(chr(10)) for l in f if l.strip()]"
echo "for rel in files:"
echo "    d = os.path.join(dst, rel)"
echo "    os.makedirs(os.path.dirname(d), exist_ok=True)"
echo "    shutil.copy2(os.path.join(src, rel), d)"
echo 'print(\"done\")\""'
