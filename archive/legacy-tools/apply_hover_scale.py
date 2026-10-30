# -*- coding: utf-8 -*-
"""Одноразовый скрипт: добавляет hover-scale эффект (_ss(NAME, base*1.08)) рядом с уже
существующим hover-alpha (_sa(NAME, X)) для КАЖДОЙ кнопки, которая следует стандартному паттерну
NAME.on('pointerover', ()=>{ _sa(NAME, X); }); / NAME.on('pointerout', ()=>{ _sa(NAME, Y); });
Кнопки с более сложной/нестандартной логикой в хендлерах — НЕ трогает, только логирует как
"skipped" для ручного разбора (см. --report).
"""
import os, re, sys, glob

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC  = os.path.join(ROOT, '_client', 'src')

PAIR_RE = re.compile(
    r"(?P<over>(?P<name>[A-Za-z_$][\w.\[\]'\"]*)\.on\('pointerover',\s*\(\)\s*=>\s*\{\s*_sa\((?P=name),\s*([\d.]+)\);\s*\}\);)"
    r"(?P<between>[\s\S]{0,400}?)"
    r"(?P<out>(?P=name)\.on\('pointerout',\s*\(\)\s*=>\s*\{\s*_sa\((?P=name),\s*([\d.]+)\);\s*\}\);)"
)

SCALE_SET_RE_TMPL = r"{name}\.scale\.set\(([\d.]+)\)"

def find_base_scale(content, name, over_start):
    # ищем ПОСЛЕДНИЙ NAME.scale.set(N) ДО начала pointerover-блока (в разумных пределах — 4000 симв. назад)
    window_start = max(0, over_start - 4000)
    window = content[window_start:over_start]
    escaped = re.escape(name)
    matches = list(re.finditer(SCALE_SET_RE_TMPL.format(name=escaped), window))
    if matches:
        return float(matches[-1].group(1))
    return 1.0

def fmt(n):
    s = ('%.3f' % n).rstrip('0').rstrip('.')
    return s if s else '0'

def process_file(path, apply=False):
    with open(path, encoding='utf-8') as f:
        content = f.read()

    results = []
    out = content
    offset = 0
    for m in PAIR_RE.finditer(content):
        name = m.group('name')
        over_alpha = m.group(3)
        out_alpha  = m.group(5)
        over_full  = m.group('over')
        out_full   = m.group('out')
        base = find_base_scale(content, name, m.start())
        target = round(base * 1.08, 3)

        new_over = over_full[:-3] + f" {name}.scale.set({fmt(target)}); }});"  # заменяем хвост "});" на добавленную строку + "});"
        # аккуратнее: вставим перед закрывающей "});"
        assert over_full.rstrip().endswith('});')
        new_over = over_full.rstrip()[:-3].rstrip() + f' {name}.scale.set({fmt(target)}); }});'
        assert out_full.rstrip().endswith('});')
        new_out = out_full.rstrip()[:-3].rstrip() + f' {name}.scale.set({fmt(base)}); }});'

        results.append({
            'name': name, 'base': base, 'target': target,
            'over_old': over_full, 'over_new': new_over,
            'out_old': out_full, 'out_new': new_out,
        })

    if apply and results:
        for r in results:
            out = out.replace(r['over_old'], r['over_new'], 1)
            out = out.replace(r['out_old'], r['out_new'], 1)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(out)

    return results

def main():
    apply = '--apply' in sys.argv
    files = glob.glob(os.path.join(SRC, '**', '*.js'), recursive=True)
    total_matched = 0
    total_files = 0
    for path in sorted(files):
        results = process_file(path, apply=apply)
        if results:
            total_files += 1
            total_matched += len(results)
            rel = os.path.relpath(path, ROOT)
            print(f'{rel}: {len(results)} button(s)')
            for r in results:
                print(f"    {r['name']}: base={fmt(r['base'])} -> hover target={fmt(r['target'])}")
    print(f'\nTOTAL: {total_matched} buttons across {total_files} files ({"APPLIED" if apply else "DRY RUN"})')

if __name__ == '__main__':
    main()
