"""Close raw log downloads on both environments, preserving logs and backing up nginx."""
import sys
import release

if sys.argv[1:] not in ([], ['--apply']):
    raise SystemExit('Use --apply or no arguments')
source = r'''
import pathlib, shutil, subprocess, datetime
paths = [pathlib.Path('/etc/nginx/sites-available/stalker'), pathlib.Path('/etc/nginx/sites-available/test-pripyat-game.ru')]
rule = '    # Private application logs: use authenticated Dev viewer.\n    location ~* \\.log(?:[./_-]|$) { return 403; }\n'
original = {p:p.read_text() for p in paths}
updated = {}
for p, text in original.items():
    anchor = '    location / {'
    assert text.count(anchor) == 1
    updated[p] = text if rule in text else text.replace(anchor, rule + '\n' + anchor)
print('nginx log guard: ' + str(sum(updated[p] != original[p] for p in paths)) + ' configurations')
if APPLY:
    backup = pathlib.Path('/var/backups/pripyat-log-guard-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M%S'))
    backup.mkdir()
    try:
        for p in paths:
            shutil.copy2(p, backup/p.name)
            p.write_text(updated[p])
        subprocess.run(['nginx','-t'],check=True)
        subprocess.run(['systemctl','reload','nginx'],check=True)
    except Exception:
        for p in paths: p.write_text(original[p])
        subprocess.run(['nginx','-t'],check=True)
        subprocess.run(['systemctl','reload','nginx'],check=True)
        raise
    print('backup: ' + str(backup))
'''
client = release.connect()
try:
    print(release.run_remote_python(client, 'APPLY=' + repr(sys.argv[1:] == ['--apply']) + '\n' + source))
finally:
    client.close()
