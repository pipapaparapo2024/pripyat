"""Stream over SSH; compare image names without reading player data. Optional --sync-missing."""
from pathlib import Path
import shutil
import sys

test = Path('/var/www/stalker-test/client/ver0_41/images')
prod = Path('/var/www/stalker/client/ver0_41/images')
def files(base):
    return {p.relative_to(base) for p in base.rglob('*') if p.is_file()}
a, b = files(test), files(prod)
print('test:', len(a), '| prod:', len(b), '| missing on prod:', len(a-b), '| missing on test:', len(b-a))
if '--sync-missing' in sys.argv:
    for source, target, missing in [(test, prod, a-b), (prod, test, b-a)]:
        for relative in missing:
            dest = target / relative
            dest.parent.mkdir(parents=True, exist_ok=True)
            if not dest.exists():
                shutil.copy2(source / relative, dest)
    print('after sync, missing:', len(files(test) ^ files(prod)))
