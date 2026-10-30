"""One-time local layout migration. Never deletes files or touches servers."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
records = []

def move(source, destination):
    src, dst = ROOT / source, ROOT / destination
    if not src.exists():
        return
    if not src.resolve().is_relative_to(ROOT) or not dst.resolve().is_relative_to(ROOT):
        raise RuntimeError('Path outside workspace')
    if dst.exists():
        raise RuntimeError('Destination already exists: ' + destination)
    dst.parent.mkdir(parents=True, exist_ok=True)
    src.rename(dst)
    records.append({'from': source, 'to': destination})

if __name__ == '__main__':
    manifest = ROOT / 'archive/local/layout-migration.json'
    if manifest.exists():
        raise RuntimeError('Migration already performed')
    move('img', 'assets/source/img')
    move('content', 'assets/source/content')
    move('server_semyorka.png', 'assets/source/references/server_semyorka.png')
    for name in ['apply_hover_scale.py', 'patch_cards_and_bag.py']:
        move(name, 'archive/legacy-tools/' + name)
    for p in sorted(ROOT.glob('*.py')):
        move(p.name, 'archive/local/scripts/' + p.name)
    for p in sorted(ROOT.glob('*')):
        if p.is_file() and (p.name.endswith('_output.txt') or p.suffix == '.log' or p.name in ['coins_now.txt', 'save_trace.txt']):
            move(p.name, 'archive/local/logs/' + p.name)
        elif p.is_file() and ('HANDOFF' in p.name or p.name.startswith('SESSION_HANDOFF')):
            move(p.name, 'archive/local/notes/' + p.name)
    for name in ['_archive_unused_images_29_09_2026', '_originals_before_downscale_27_09_2026', '_security_history_scrub.git']:
        move(name, 'archive/local/' + name)
    for p in sorted(ROOT.glob('*.md')):
        if p.name not in ['AGENTS.md', 'CLAUDE.md', 'SECRETS_LOCAL.md', 'README.md']:
            move(p.name, 'docs/history/' + p.name)
    for pattern in ['*.pdf', '*.docx']:
        for p in sorted(ROOT.glob(pattern)):
            move(p.name, 'docs/specifications/' + p.name)
    manifest.parent.mkdir(parents=True, exist_ok=True)
    manifest.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')
    print('Moved entries:', len(records))
