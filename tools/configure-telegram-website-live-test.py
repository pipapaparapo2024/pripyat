"""Enable a live YooKassa charge only for the owner in the isolated Telegram TEST world."""
from pathlib import Path
import importlib.util

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('provision', ROOT / 'tools/provision-new-server.py')
provision = importlib.util.module_from_spec(spec)
spec.loader.exec_module(provision)

REMOTE = r'''
from pathlib import Path
import datetime,grp,json,os,pwd,shutil,subprocess,tempfile

OWNER='1355806786'
target=Path('/etc/pripyat/website-auth-test.json')
assert target.is_file()
site=json.loads(target.read_text())
tg=site.get('telegram',{})
assert site.get('origin')=='https://pripyat-game-site.ru'
assert tg.get('enabled') is True
assert site.get('access',{}).get('telegram')=={'mode':'allowlist','ids':[OWNER]}
assert (tg.get('website_rub_payments') or {}).get('require_test_payment') is True

php="<?php\n$c=require '/etc/pripyat/telegram-prod.php';\necho json_encode(['database'=>$c['database']??null,'payments'=>$c['website_rub_payments']??[]],JSON_UNESCAPED_SLASHES);\n"
result=subprocess.run(['php'],input=php,text=True,capture_output=True,check=True)
prod=json.loads(result.stdout)
assert prod.get('database')=='stalker_telegram'
live=prod.get('payments') or {}
assert live.get('enabled') is True and live.get('require_test_payment') is False
assert live.get('live_checkout_enabled') is True
assert live.get('receipt_mode')=='npdcheck' and live.get('receipt_automation_ready') is True
assert str(live.get('shop_id','')).isdigit() and str(live['shop_id']).startswith(tuple('123456789'))
assert str(live.get('secret_key','')).startswith('live_')
source=json.loads(Path('/etc/pripyat/yookassa-live.json').read_text())
assert str(source.get('shop_id'))==str(live['shop_id']) and source.get('secret_key')==live['secret_key']

test_live=dict(live)
# Telegram TEST is not yet included in the NPD receipt worker's world list.
# Trial live charges therefore use the already approved manual developer-receipt flow.
test_live.update(receipt_mode='manual',receipt_automation_ready=False,manual_receipts_acknowledged=True)
tg['live_payments_owner_test_enabled']=True
tg['website_rub_payments_live_test_owner']=test_live
backup=Path('/var/backups')/('telegram-website-live-test-config-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
backup.mkdir(mode=0o700)
shutil.copy2(target,backup/'website-auth-test.json')
(backup/'website-auth-test.json').chmod(0o600)
uid=pwd.getpwnam('root').pw_uid;gid=grp.getgrnam('pripyat-site-test').gr_gid
fd,tmp=tempfile.mkstemp(prefix='.website-auth-test-',dir=target.parent)
try:
    os.fchmod(fd,0o640);os.fchown(fd,uid,gid)
    with os.fdopen(fd,'w') as stream:json.dump(site,stream,ensure_ascii=False,separators=(',',':'))
    os.replace(tmp,target)
finally:
    if os.path.exists(tmp):os.unlink(tmp)
print(json.dumps({'environment':'telegram_test','payment_mode':'live','owner_only':True,'telegram_id':OWNER,'receipt_mode':'manual','manual_receipt_acknowledged':True,'automatic_receipts':False,'game_database_unchanged':True,'backup':str(backup)}))
'''

provision.remote('root', REMOTE)
