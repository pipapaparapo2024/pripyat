"""Per-vhost PHP logging, with backups and nginx validation; never expose a global log."""
import sys
import release
if sys.argv[1:] not in ([],['--apply']):raise SystemExit('Use --apply or no arguments')
source=r'''
from pathlib import Path
import subprocess,shutil,datetime
targets={'stalker':'/var/www/stalker','test-pripyat-game.ru':'/var/www/stalker-test'}
original={};updated={}
anchor='    location ~ \\.php$ {\n        include snippets/fastcgi-php.conf;\n'
for name,root in targets.items():
    p=Path('/etc/nginx/sites-available')/name
    text=p.read_text(); original[p]=text
    assert '    root '+root+';' in text
    assert text.count(anchor)==1
    directive='        fastcgi_param PHP_ADMIN_VALUE "error_log='+root+'/server/php_errors.log";\n'
    updated[p]=text if directive in text else text.replace(anchor,anchor+directive)
print('Per-environment PHP logs: '+str(sum(original[p]!=updated[p] for p in original))+' configurations')
if APPLY:
    backup=Path('/var/backups/pripyat-scoped-logs-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M%S'));backup.mkdir()
    try:
        for p in original:
            shutil.copy2(p,backup/p.name);p.write_text(updated[p])
        subprocess.run(['nginx','-t'],check=True)
        subprocess.run(['systemctl','reload','nginx'],check=True)
    except Exception:
        for p,text in original.items():p.write_text(text)
        subprocess.run(['nginx','-t'],check=True);subprocess.run(['systemctl','reload','nginx'],check=True)
        raise
    print('backup: '+str(backup))
'''
c=release.connect()
try:print(release.run_remote_python(c,'APPLY='+repr(sys.argv[1:]==['--apply'])+'\n'+source))
finally:c.close()
