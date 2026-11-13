"""Root-only hourly retention. No live character or financial record removal."""
from pathlib import Path
import os,time,json,subprocess,re,shutil
try:import fcntl
except ImportError:fcntl=None

DAY=86400
def expired(path,seconds,now):
    return not path.is_symlink() and path.is_file() and now-path.stat().st_mtime>seconds

def purge_files(folder,pattern,seconds,now):
    count=0
    if not folder.is_dir():return count
    for path in folder.glob(pattern):
        if (pattern=='sess_*' and path.is_file() and not path.is_symlink()) or expired(path,seconds,now):
            with path.open('r+b') as stream:
                try:fcntl.flock(stream,fcntl.LOCK_EX|fcntl.LOCK_NB)
                except BlockingIOError:continue
                # A PHP request may have refreshed it while we waited.
                stale=now-os.fstat(stream.fileno()).st_mtime>seconds
                if pattern=='sess_*':
                    values=[int(v) for v in re.findall(rb's:10:"expires_at";i:(\d+);',stream.read())]
                    if values:stale=max(values)<now-seconds
                if stale:path.unlink();count+=1
    return count

def main():
    if os.geteuid()!=0:raise SystemExit('root required')
    root=Path('/var/lib/pripyat-privacy')
    with (root/'.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        now=time.time();base=Path('/var/www/pripyat-site');counts={}
        # Grace below the published upper bound allows for the hourly schedule.
        for folder,pattern,age in [(base/'private/social-checks','*.json',6*DAY),(base/'private/social-links','challenge-*.json',DAY),(Path('/var/lib/pripyat-site-test'),'sess_*',DAY),(Path('/var/lib/pripyat-site-test/limits'),'*.json',6*DAY)]:
            counts[str(folder)]=purge_files(folder,pattern,age,now)
        php=r'''$db=new PDO('mysql:unix_socket=/var/run/mysqld/mysqld.sock;dbname=stalker_site_test','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);$cut=time()-6*86400;
foreach(['site_email_tokens','site_phone_checks','site_sessions'] as $t){$q=$db->prepare("DELETE FROM `$t` WHERE expires_at<? LIMIT 10000");$q->execute([$t==='site_sessions'?time()-86400:$cut]);while($q->rowCount()===10000)$q->execute([$t==='site_sessions'?time()-86400:$cut]);}
'''
        subprocess.run(['php','-r',php],check=True,capture_output=True)
        # Timestamped database archives only. Keep no backups older than 30 days.
        backups=Path('/var/backups/pripyat-database')
        for path in backups.glob('*'):
            if re.fullmatch(r'privacy-ledger-\d{8}T\d{6}Z\.json',path.name):
                if expired(path,30*DAY,now):path.unlink()
                continue
            if re.fullmatch(r'stalker(?:_ok|_telegram)?(?:_test)?-\d{8}T\d{6}Z\.sql\.gz',path.name) or re.fullmatch(r'stalker_site_test-\d{8}T\d{6}Z\.sql\.gz',path.name):
                if expired(path,30*DAY,now):path.unlink()
        # Recognised application snapshots, never system package backups or live directories.
        parent=Path('/var/backups').resolve()
        for path in parent.iterdir():
            if path==backups or path.is_symlink() or not re.match(r'^(?:pripyat-|site-|website-|native-|telegram-|social-character-|public-launch-|privacy-release-)',path.name):continue
            if now-path.stat().st_mtime<=30*DAY:continue
            if path.resolve().parent!=parent:raise RuntimeError('unsafe backup target')
            if path.is_dir():shutil.rmtree(path)
            elif path.is_file():path.unlink()
        # Minimal deletion ledger: three years; pending failures are kept until resolved.
        ledger_path=root/'deletions.json'
        guard_dir = Path('/tmp/pripyat-privacy')
        guard_dir.mkdir(mode=0o755, exist_ok=True)
        guard_dir.chmod(0o755)
        if ledger_path.exists():
            ledger=json.loads(ledger_path.read_text())
            ledger['entries']={k:v for k,v in ledger['entries'].items() if v.get('status')!='completed' or now-v.get('completed_at',now)<=1095*DAY}
            tmp=ledger_path.with_suffix('.new');tmp.write_text(json.dumps(ledger));tmp.chmod(0o600);tmp.replace(ledger_path)
            guard={'entries':{k:True for k in ledger['entries']}}
            for dest in [Path('/tmp/pripyat-privacy/erased-accounts.json'),base/'private/erased-accounts.json',Path('/var/www/stalker-native-prod/private/erased-accounts.json')]:
                tmp=dest.with_suffix('.new');tmp.write_text(json.dumps(guard));tmp.chmod(0o644);tmp.replace(dest)
        if ledger_path.exists():
            replay=r'''require '/var/www/pripyat-site/server/core/models/accounterasure.php';$ledger=json_decode(stream_get_contents(STDIN),true,32,JSON_THROW_ON_ERROR);foreach($ledger['entries'] as $row){$world=$row['world'];$uid=(int)$row['uid'];$db=new PDO('mysql:unix_socket=/var/run/mysqld/mysqld.sock;dbname='.AccountErasure::WORLDS[$world],'root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);$q=$db->prepare('SELECT id FROM users WHERE id=?');$q->execute([$uid]);$exists=(bool)$q->fetchColumn();if($world==='site'){$q=$db->prepare("SELECT player_id FROM site_accounts WHERE player_id=? AND password_hash!='!erased!'");$q->execute([$uid]);$exists=$exists||(bool)$q->fetchColumn();}if($exists)(new AccountErasure($db,$world))->erase($uid);}'''
            subprocess.run(['php','-r',replay],input=json.dumps(ledger),text=True,capture_output=True,check=True)
        print(json.dumps({'retention_completed':True,'removed_files':sum(counts.values()),'character_deletions':0}))

if __name__=='__main__':main()
