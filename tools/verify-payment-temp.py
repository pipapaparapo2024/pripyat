"""Read-only to persistent data: mock provider and connection-local MySQL temporary tables."""
from pathlib import Path
import subprocess,base64
root=Path(__file__).resolve().parents[1]
files=['website/app/sitepayments.php','website/app/siteyookassa.php','website/app/sitesessions.php','server/core/models/erasedaccounts.php','server/json/site_prices.json','tests/_php_fixtures/site-payment-mysql.php','tools/site-payment-reconcile.php']
data={f:base64.b64encode((root/f).read_bytes()).decode() for f in files}
code="""from pathlib import Path
import base64,subprocess,tempfile,shutil
base=Path(tempfile.mkdtemp(prefix='pripyat-payment-check-',dir='/var/tmp'))
try:
 for f,v in FILES.items():
  p=base/f;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(base64.b64decode(v))
 r=subprocess.run(['php',str(base/'tests/_php_fixtures/site-payment-mysql.php'),str(base/'website/app/sitepayments.php')],capture_output=True,text=True)
 print(r.stdout);print(r.stderr);result=r.returncode
finally:shutil.rmtree(base)
raise SystemExit(result)
""".replace('FILES',repr(data))
r=subprocess.run(['ssh','-o','BatchMode=yes','-i',str(Path.home()/'.ssh/id_ed25519_stalker'),'root@135.106.159.212','python3','-'],input=code,text=True,capture_output=True)
print(r.stdout,r.stderr)
raise SystemExit(r.returncode)
