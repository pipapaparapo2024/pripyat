"""Read-only code inventory; excludes private configuration and player data."""
from pathlib import Path
import subprocess,json,hashlib
root=Path(__file__).resolve().parents[1]
code=r"""from pathlib import Path
import hashlib,json
result={}
for contour in ['stalker-native-test','stalker-native-prod']:
 base=Path('/var/www')/contour;files={}
 for folder in ['server/core','server/json','client/ver0_41/libs']:
  p=base/folder
  for f in p.rglob('*'):
   if f.is_file() and f.suffix in ['.php','.json','.js'] and not any(x in f.name.lower() for x in ['registry','config','secret','log']):
    files[str(f.relative_to(base))]=hashlib.sha256(f.read_bytes().replace(b'\r\n',b'\n')).hexdigest()
 result[contour]=files
base=Path('/var/www');a=(base/'stalker-native-test/client/ver0_41/libs/index.js').read_text();b=(base/'stalker-native-prod/client/ver0_41/libs/index.js').read_text()
b=b.replace('e&&69===e.code&&(udata.sedoy_dmg_total="0",udata.sedoy_dmg_left="0",window.iface&&iface.updateUp()),','')
b=b.replace(',69:"Вчерашний остаток урона Седого сгорел в 00:00 по Москве"','')
result['bundle_only_difference_is_sedoy69']=a==b
result['active_bundle']={}
for contour in ['stalker-native-test','stalker-native-prod']:
 p=Path('/var/www')/contour/'client/ver0_41/libs/index.training-72a703779193.js'
 result['active_bundle'][contour]=hashlib.sha256(p.read_bytes()).hexdigest()
print(json.dumps(result))
"""
r=subprocess.run(['ssh','-o','BatchMode=yes','-i',str(Path.home()/'.ssh/id_ed25519_stalker'),'root@135.106.159.212','python3','-'],input=code,text=True,capture_output=True,encoding='utf-8');r.check_returncode();data=json.loads(r.stdout)
a=data['stalker-native-test'];b=data['stalker-native-prod'];common=set(a)&set(b)
report={'github_main':subprocess.check_output(['git','ls-remote','origin','refs/heads/main'],cwd=root,text=True).split()[0],'local_head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'active_bundle_sha256':data['active_bundle'],'active_bundle_equal':len(set(data['active_bundle'].values()))==1,'bundle_only_difference_is_sedoy69':data['bundle_only_difference_is_sedoy69'],'scope':'server/core, server/json, client/ver0_41/libs; private configuration, registry and logs excluded','test_files':len(a),'prod_files':len(b),'equal_common':sum(a[n]==b[n] for n in common),'different_common':sorted(n for n in common if a[n]!=b[n]),'only_test':sorted(set(a)-set(b)),'only_prod':sorted(set(b)-set(a)),'source_comparison':{}}
for label,files in [('test',a),('prod',b)]:
 counts={'local_equal':0,'head_equal':0,'compared':0,'local_diff':[]}
 for name,digest in files.items():
  p=root/name
  if not name.startswith('server/') or not p.is_file():continue
  counts['compared']+=1
  if hashlib.sha256(p.read_bytes().replace(b'\r\n',b'\n')).hexdigest()==digest:counts['local_equal']+=1
  else:counts['local_diff'].append(name)
  h=subprocess.run(['git','show','HEAD:'+name],cwd=root,capture_output=True)
  if h.returncode==0 and hashlib.sha256(h.stdout.replace(b'\r\n',b'\n')).hexdigest()==digest:counts['head_equal']+=1
 report['source_comparison'][label]=counts
out=root/'docs/release-version-audit-20261113.json';out.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(report,ensure_ascii=False,indent=2))
