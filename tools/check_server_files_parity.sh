#!/usr/bin/env bash
# Проверка расхождения PHP/JSON файлов сервера между тестом и продом — новый обязательный шаг
# "супер деплоя" (добавлен 28.10.2026, тот же класс бага, что уже ловился для картинок
# 20.10.2026, см. check_images_parity.sh, но на этот раз для server/ — registry.php classes
# whitelist и клиентский JS на проде уже считали фичи 2048/Разнарядка/Заначки задеплоенными,
# но 5 server-side файлов (controllers/game2048.php, models/raznaryadkaprogress.php,
# models/zanachkimodel.php, json/game2048_config.json, json/raznaryadka_config.json) реально
# были только на тесте — игрок (в т.ч. сам разработчик под dev-аккаунтом) получал на проде
# "Раздел временно недоступен"/фатальные "Class ... not found" при каждом открытии экрана.
#
# Прошлый супер деплой (upload.sh/deploy_vNNN_both.py) копирует JS-бандл+index.html в оба
# окружения, но НЕ server/*.php/*.json — апдейт PHP-файлов исторически делался вручную
# отдельными bash upload.sh вызовами, и легко забыть один файл из пачки (как здесь — 5 файлов
# новых фич ушли только через обычный "деплой" на тест, супер деплой на прод их не подхватил).
#
# Оба сайта на ОДНОМ физическом сервере (155.212.211.202) — сравнение идёт server-side (ssh),
# без перекачки файлов туда-обратно.
#
# Запуск (read-only, ничего не меняет сам по себе):
#   bash tools/check_server_files_parity.sh
#
# Если найдены расхождения — скрипт печатает список, но НЕ копирует ничего сам (в отличие от
# картинок, PHP/JSON на проде и тесте МОГУТ законно различаться — например registry.php, см.
# AGENTS.md — поэтому синхронизация остаётся осознанным ручным шагом, не автоматикой).
set -u

echo "Сравниваю server/core/controllers, server/core/models, server/json теста и прода..."

ssh stalker-vps "python3 -c \"
import os
def list_rel(base, exts):
    out = set()
    if not os.path.isdir(base): return out
    for root, dirs, files in os.walk(base):
        for fn in files:
            if not any(fn.endswith(e) for e in exts): continue
            rel = os.path.relpath(os.path.join(root, fn), base)
            out.add(rel)
    return out

# registry.php намеренно расходится по 3 полям (db/api_id/api_secret) — см. AGENTS.md,
# сравнивается только список ИМЁН файлов (presence), не содержимое, поэтому этот файл
# безопасно включать в проверку наравне с остальными.
# Одноразовые migrateNN.php/migrate_diag_schema.php по конвенции удаляются с серверов
# сразу после выполнения — их отсутствие на одной из сторон НЕ баг, исключаем из сравнения.
SUBDIRS = ['core/controllers', 'core/models', 'json']
test_base = '/var/www/stalker-test/server'
prod_base = '/var/www/stalker/server'

total_missing = 0
for sub in SUBDIRS:
    test = list_rel(os.path.join(test_base, sub), ('.php', '.json'))
    prod = list_rel(os.path.join(prod_base, sub), ('.php', '.json'))
    missing = sorted(test - prod)
    extra = sorted(prod - test)
    print(f'--- {sub}: test {len(test)} файлов, prod {len(prod)} файлов ---')
    if missing:
        total_missing += len(missing)
        print(f'  ❌ есть на тесте, ОТСУТСТВУЮТ на проде:')
        for m in missing: print('   -', m)
    if extra:
        print(f'  ⚠️  есть на проде, отсутствуют на тесте (обычно не проблема, но стоит знать):')
        for e in extra: print('   +', e)
    if not missing and not extra:
        print('  ✅ идентичны по списку файлов')

print()
if total_missing == 0:
    print('✅ ИТОГО: расхождений нет (по списку файлов — не по содержимому)')
else:
    print(f'❌ ИТОГО: {total_missing} файлов есть на тесте, но отсутствуют на проде — см. список выше')
\""

echo
echo "Эта проверка сравнивает только НАЛИЧИЕ файлов (список имён), не содержимое — для content-diff"
echo "конкретного файла используйте: diff <(ssh stalker-vps cat /var/www/stalker/server/ПУТЬ) <(ssh stalker-vps cat /var/www/stalker-test/server/ПУТЬ)"
echo "Синхронизация — ручной шаг (upload.sh/deploy_*.py), НЕ делается этим скриптом автоматически."
