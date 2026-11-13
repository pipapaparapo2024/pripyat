"""Run actual published controller with connection-local temporary users, never real players."""
from pathlib import Path
import subprocess
root=Path(__file__).resolve().parents[1]
s=(root/'tests/_php_fixtures/dev-energy-persistence.php').read_text(encoding='utf-8')
s=s.replace("__DIR__.'/../../server/", "'/var/www/stalker-tg-test/public/server/")
a=s.index('class DevMemoryDB');b=s.index('class DevTools',a)
adapter=r'''class DevMemoryDB {
 public $row,$writes=0;private $db;
 function __construct(){
 $this->db=new PDO('mysql:unix_socket=/var/run/mysqld/mysqld.sock;dbname=stalker_telegram_test','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
 $this->db->exec("CREATE TEMPORARY TABLE users(id INT PRIMARY KEY,energy INT,energy_time BIGINT,max_energy INT,exp INT,level INT DEFAULT 0,bosses_data TEXT,poker_spichki INT DEFAULT 0,roulette_spichki INT DEFAULT 0) ENGINE=InnoDB");
 $this->db->exec("INSERT INTO users(id,energy,energy_time,max_energy,exp,bosses_data) VALUES(20,10,0,50,0,'{}')");$this->getData();
 }
 function getData(...$args){return $this->row=$this->db->query('SELECT * FROM users WHERE id=20')->fetch(PDO::FETCH_ASSOC);}
 function saveData($table,$data){$this->writes++;unset($data['id']);foreach(array_keys($data) as $key)if(!preg_match('/^[a-z_]+$/D',$key))throw new RuntimeException('Bad column');$q=$this->db->prepare('UPDATE users SET '.implode(',',array_map(fn($k)=>'`'.$k.'`=?',array_keys($data))).' WHERE id=20');$q->execute(array_values($data));$this->getData();return ['error'=>false];}
}
'''
s=s[:a]+adapter+s[b:]
r=subprocess.run(['ssh','-o','BatchMode=yes','-i',str(Path.home()/'.ssh/id_ed25519_stalker'),'root@135.106.159.212','php'],input=s,text=True,encoding='utf-8',capture_output=True)
if r.returncode:raise SystemExit(r.stderr)
print(r.stdout)
