"""VK production gift-date repair. Default: read-only plan. --apply: locked, backed-up repair."""
import sys
from pathlib import Path
import release
if sys.argv[1:] not in ([],['--apply']):raise SystemExit('Use --apply or no arguments')
source=Path(__file__).with_suffix('.php').read_text(encoding='utf-8')
source=source.replace('<?php','<?php\ndefine("HABAR_RESTORE_APPLY",'+('true' if sys.argv[1:] else 'false')+');',1)
c=release.connect()
try:
    stdin,out,err=c.exec_command('php',timeout=60);stdin.write(source);stdin.flush();stdin.channel.shutdown_write()
    result=out.read().decode('utf-8');error=err.read().decode('utf-8')
    if out.channel.recv_exit_status()!=0:raise RuntimeError(error)
    print(result)
finally:c.close()
