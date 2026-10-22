# -*- coding: utf-8 -*-
"""Аудит имён используемых файлов-ассетов (images/) — поиск кандидатов на переименование.

НИЧЕГО не меняет и не переименовывает — только анализирует и печатает отчёт.
Запуск: python tools/audit_image_naming.py
"""
import os, io, glob, re, json

ROOT   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGES = os.path.join(ROOT, '_client', 'development', 'images')

# Папки-исключения — не часть обычного namespace-соглашения, у них своя система имён,
# либо это заведомо неиспользуемый в рантайме экспорт для Adobe Animate.
SKIP_DIRS = {'layers'}

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

# Известные namespace-префиксы фич/экранов (см. AGENTS.md — "Коллизии имён файлов-ассетов").
KNOWN_PREFIXES = [
    'боевка', 'верхний худ', 'нижний худ', 'двор', 'рюкзак', 'покер', 'зарики', 'рулетка',
    'блэкджек', 'хабар', 'сидорович', 'магазин', 'сет ', 'попап', 'ключ', 'боссы', 'босс ',
    'зарики фон', 'карточка', 'заруба', 'свод', 'топ ', 'группировк', 'хата', 'база',
    'визитка', 'достижен', 'задани', 'свиток', 'ящик', 'кейс', 'бизнес', 'локац',
    'редактор', 'подарок', 'уровень', 'профиль', 'друг', 'рейтинг', 'спички', 'фишки',
]

GENERIC_WORDS = {
    'фон', 'иконка', 'кнопка', 'рамка', 'плюс', 'фон1', 'фон2', 'шмотка', 'картинка',
    'плашка', 'текст', 'стрелка', 'галочка', 'чек', 'слой', 'image', 'img', 'icon',
    'button', 'bg', 'frame', 'layer', 'untitled', 'new', 'new1', 'copy',
}

RAW_EXPORT_RE = re.compile(
    r'^(слой|layer|снимок экрана|screenshot|image|img|untitled|без имени|new|copy of)\s*[\d_\-\s]*$',
    re.IGNORECASE,
)
PURE_NUMBER_RE = re.compile(r'^\d+$')
WEIRD_SPACING_RE = re.compile(r'  +|^\s|\s$|_ | _')
MIXED_LANG_RE = re.compile(r'[a-zA-Z].*[а-яА-ЯёЁ]|[а-яА-ЯёЁ].*[a-zA-Z]')

def classify(rel_path, basename_noext):
    name = basename_noext.strip()
    lname = name.lower()
    reasons = []

    if PURE_NUMBER_RE.match(name):
        return 'RAW_EXPORT', ['чистое число без контекста — похоже на несохранённое имя из экспорта']
    if RAW_EXPORT_RE.match(name):
        return 'RAW_EXPORT', ['похоже на автоимя экспортёра (Слой N / Screenshot / Untitled и т.п.)']

    has_prefix = any(lname.startswith(p.lower()) for p in KNOWN_PREFIXES)
    word_count = len(re.split(r'[ _]+', name.strip()))

    if lname in GENERIC_WORDS or (word_count == 1 and lname in GENERIC_WORDS):
        reasons.append('generic однословное имя без привязки к фиче/экрану — высокий риск коллизии')
        return 'GENERIC', reasons

    if word_count == 1 and not has_prefix and len(name) <= 12:
        reasons.append('короткое однословное имя без namespace-префикса фичи')
        return 'SHORT_NO_PREFIX', reasons

    if WEIRD_SPACING_RE.search(name):
        reasons.append('двойные пробелы / пробел в начале-конце / смешение _ и пробела')

    if MIXED_LANG_RE.search(name) and not re.search(r'\bactiv\b', lname):
        reasons.append('смешение кириллицы и латиницы в одном имени')

    if reasons:
        return 'STYLE_ISSUE', reasons

    if has_prefix or word_count >= 2:
        return 'GOOD', []

    return 'REVIEW', ['не попало ни в одну чёткую категорию — стоит посмотреть вручную']

def main():
    text = used_names()
    results = {'RAW_EXPORT': [], 'GENERIC': [], 'SHORT_NO_PREFIX': [], 'STYLE_ISSUE': [], 'REVIEW': [], 'GOOD': []}
    total_used = 0
    for root, dirs, files in os.walk(IMAGES):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        rel_dir = os.path.relpath(root, IMAGES)
        for f in files:
            if not f.lower().endswith(('.png', '.jpg', '.jpeg')):
                continue
            if f not in text:
                continue
            total_used += 1
            noext = os.path.splitext(f)[0]
            rel_path = f if rel_dir == '.' else (rel_dir + '/' + f)
            cat, reasons = classify(rel_path, noext)
            results[cat].append((rel_path, reasons))

    print(f'Всего используемых файлов (PNG/JPG, вне images/layers/): {total_used}\n')
    order = ['RAW_EXPORT', 'GENERIC', 'SHORT_NO_PREFIX', 'STYLE_ISSUE', 'REVIEW', 'GOOD']
    for cat in order:
        print(f'{cat}: {len(results[cat])}')
    print()

    out_path = os.path.join(ROOT, 'IMAGE_NAMING_AUDIT.md')
    with io.open(out_path, 'w', encoding='utf-8') as out:
        out.write('# Аудит имён используемых файлов-ассетов\n\n')
        out.write(f'Всего используемых файлов: {total_used}\n\n')
        labels = {
            'RAW_EXPORT': 'Сырые имена экспорта (Слой N, Screenshot, числа и т.п.) — переименовать в первую очередь',
            'GENERIC': 'Generic-имена без привязки к фиче (фон.png, иконка.png и т.п.) — риск коллизии, переименовать',
            'SHORT_NO_PREFIX': 'Короткие имена без namespace-префикса — стоит переименовать',
            'STYLE_ISSUE': 'Проблемы стиля (пробелы, смешение языков/разделителей)',
            'REVIEW': 'Не попало в чёткую категорию — посмотреть вручную',
            'GOOD': 'Уже хорошо названы (namespaced, многословные) — не трогать',
        }
        for cat in order:
            items = results[cat]
            out.write(f'## {labels[cat]} ({len(items)})\n\n')
            if cat == 'GOOD':
                out.write('_Список не печатается (слишком длинный) — все остальные файлы, не попавшие в категории выше._\n\n')
                continue
            for rel_path, reasons in sorted(items):
                r = '; '.join(reasons)
                out.write(f'- `{rel_path}` — {r}\n')
            out.write('\n')
    print('Полный отчёт записан в', out_path)

if __name__ == '__main__':
    main()
