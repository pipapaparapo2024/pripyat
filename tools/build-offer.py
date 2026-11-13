"""Render the supplied, preserved Markdown offer without external scripts."""
from pathlib import Path
import html,re,shutil
ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'docs/legal/Pripyat_oferta_draft.md'
def inline(text):
 text=html.escape(text)
 return re.sub(r'https://[^\s<]+',lambda m:'<a href="'+m[0].rstrip('.')+'">'+m[0].rstrip('.')+'</a>'+('.' if m[0].endswith('.') else ''),text)
def render(text):
 out=[];table=False
 for line in text.splitlines():
  line=line.strip()
  if line.startswith('|'):
   cells=[c.strip() for c in line.strip('|').split('|')]
   if all(re.fullmatch(r':?-+:?',c) for c in cells):continue
   if not table:out.append('<div class="table-scroll"><table>');table=True;tag='th'
   else:tag='td'
   out.append('<tr>'+''.join('<'+tag+'>'+inline(c)+'</'+tag+'>' for c in cells)+'</tr>');continue
  if table:out.append('</table></div>');table=False
  if not line:continue
  m=re.match(r'^(#{1,3}) (.+)',line)
  if m:out.append('<h'+str(len(m[1]))+'>'+inline(m[2])+'</h'+str(len(m[1]))+'>')
  else:out.append('<p>'+inline(line)+'</p>')
 if table:out.append('</table></div>')
 return '\n'.join(out)
if __name__=='__main__':
 target=ROOT/'website/offer/index.html';target.parent.mkdir(exist_ok=True)
 target.write_text('''<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Публичная оферта — Припять</title><link rel="stylesheet" href="/style.css"><style>main{text-align:left}h1{font-size:34px;letter-spacing:-1px}h2{margin-top:30px}h3{font-size:20px}p,td{overflow-wrap:anywhere}.table-scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;margin:16px 0}td,th{border:1px solid #716746;padding:10px;text-align:left}th{background:#303a30}nav{display:flex;gap:20px;flex-wrap:wrap}.notice{border:1px solid #b69a55;border-radius:12px;padding:16px}</style><main><header>☢ ПРИПЯТЬ</header><p class="notice">Реальные платежи на сайте пока не принимаются. Тестовые платежи доступны только допущенным проверяющим и не списывают настоящие деньги.</p>'''+render(source.read_text(encoding='utf-8'))+'''<nav><a href="/">На главную</a><a href="/requisites/">Реквизиты</a><a href="/data/">Хранение и удаление данных</a></nav></main></html>''',encoding='utf-8')
