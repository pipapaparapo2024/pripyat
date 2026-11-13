"""Start a disposable socket-only MySQL instance; never connects to the platform database."""
from pathlib import Path
import base64,subprocess
root=Path(__file__).resolve().parents[1]
files=['website/app/sitepayments.php','website/app/siteyookassa.php','website/app/sitesessions.php','server/core/models/erasedaccounts.php','tests/_php_fixtures/payment-concurrency.php']
data={f:base64.b64encode((root/f).read_bytes()).decode() for f in files}
code=r"""from pathlib import Path
import subprocess,tempfile,shutil,time,base64,os
base=Path(tempfile.mkdtemp(prefix='pripyat-concurrency-',dir='/var/tmp'));daemon=None
try:
 for f,v in FILES.items():
  p=base/f;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(base64.b64decode(v))
 data=base/'data';data.mkdir();sock=base/'mysql.sock'
 init=subprocess.run(['/usr/sbin/mysqld','--no-defaults','--initialize-insecure','--user=root','--datadir='+str(data)],capture_output=True,text=True)
 assert init.returncode==0,'Private MySQL initialization failed'
 daemon=subprocess.Popen(['/usr/sbin/mysqld','--no-defaults','--user=root','--datadir='+str(data),'--socket='+str(sock),'--pid-file='+str(base/'mysql.pid'),'--skip-networking','--mysqlx=OFF','--innodb-buffer-pool-size=128M','--log-error='+str(base/'mysql.log')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 deadline=time.monotonic()+30
 while not sock.exists():
  assert daemon.poll() is None and time.monotonic()<deadline,'Private MySQL startup failed'
  time.sleep(.1)
 subprocess.run(['mysql','--no-defaults','--socket='+str(sock),'-uroot','-e','CREATE DATABASE fixture'],check=True,capture_output=True)
 fixture=str(base/'tests/_php_fixtures/payment-concurrency.php')
 def args(mode,world='site',test='1',barrier=base,worker='0'):return ['php',fixture,mode,str(sock),world,test,str(barrier),worker]
 subprocess.run(args('setup'),check=True,capture_output=True)
 count=0
 for world,test in [('site','1'),('site','0'),('vk','1'),('vk','0'),('ok','1'),('ok','0'),('telegram','0')]:
  for mode in ['same','different']:
   subprocess.run(args('reset'),check=True,capture_output=True)
   barrier=base/('barrier-'+str(count));barrier.mkdir()
   workers=[subprocess.Popen(args(mode,world,test,barrier,str(i)),stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True) for i in [1,2]]
   deadline=time.monotonic()+20
   while not all((barrier/('ready-'+str(i))).exists() for i in [1,2]):
    assert time.monotonic()<deadline and all(p.poll() is None for p in workers),'Workers did not overlap'
    time.sleep(.01)
   (barrier/'release').touch()
   results=[]
   for p in workers:
    out,err=p.communicate(timeout=25);assert p.returncode==0,err;results.append(out)
   assert sorted(results)==(['already_credited','credited'] if mode=='same' else ['credited','credited']),results
   subprocess.run(args('check',worker='1' if mode=='same' else '2'),check=True,capture_output=True)
   count+=1;print(world,test,mode,'two overlapping processes: passed')
 print(str(count)+' concurrency scenarios passed on disposable MySQL; production socket never used')
finally:
 if daemon is not None:
  daemon.terminate()
  try:daemon.wait(timeout=20)
  except subprocess.TimeoutExpired:daemon.kill();daemon.wait()
 assert str(base).startswith('/var/tmp/pripyat-concurrency-')
 shutil.rmtree(base)
""".replace('FILES',repr(data))
r=subprocess.run(['ssh','-o','BatchMode=yes','-i',str(Path.home()/'.ssh/id_ed25519_stalker'),'root@135.106.159.212','python3','-'],input=code,text=True,capture_output=True)
print(r.stdout,r.stderr);raise SystemExit(r.returncode)
