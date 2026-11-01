"""Read-only payment investigation. Never print launch credentials or raw log lines."""
import release
code = r'''
from pathlib import Path
import re,json,collections,urllib.parse
for path in ['/var/log/nginx/access.log','/var/log/php_errors.log']:
    p=Path(path)
    with p.open('rb') as f:
        f.seek(max(0,p.stat().st_size-4000000)); text=f.read().decode('utf-8','replace')
    if path.endswith('access.log'):
        counts=collections.Counter(); refs=set(); launch=[]
        for line in text.splitlines():
            parts=line.split('"')
            if len(parts)<4: continue
            req=parts[1].split(' ')
            if len(req)<2:continue
            url=urllib.parse.urlsplit(req[1]); q=urllib.parse.parse_qs(url.query)
            if 'pay' in url.path:counts[(url.path,parts[2].strip().split(' ')[0])]+=1
            if q.get('vk_client')==['ok']:
                refs.add(urllib.parse.urlsplit(parts[3])._replace(query='',fragment='').geturl())
                launch.append({k:bool(q.get(k)) for k in ['api_server','apiconnection','web_server','application_key','vk_client']})
        print(json.dumps({'payment_requests':[(k,v) for k,v in counts.items()],'launcher_referrers':sorted(refs),'last_ok_launch_keys':launch[-1:]},ensure_ascii=False))
    else:
        events=collections.Counter(re.findall(r'\[(ok_pay_callback[^\]]*|universal_pay[^\]]*)\]',text))
        print(json.dumps({'recent_payment_event_counts':dict(events)}))
        for line in text.splitlines():
            if '[universal_pay]' in line and 'raw_post=' in line:
                try:
                    data=json.loads(line.split('raw_post=',1)[1])
                    print(json.dumps({'payment_post_keys':sorted(data), 'notification_type':data.get('notification_type'), 'platform':data.get('platform'), 'currency':data.get('currency'), 'is_ok':data.get('is_ok')}))
                except ValueError:pass
'''
c=release.connect()
try: print(release.run_remote_python(c,code))
finally:c.close()
