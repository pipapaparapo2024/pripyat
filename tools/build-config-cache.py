"""Regenerate the legacy cache using the same one-item list as server/json/_bigger.php."""
from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]/'server/json'
data={'donuts':json.loads((root/'donuts.json').read_text(encoding='utf-8-sig'))}
(root/'_bigger.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('Generated _bigger.json from donuts.json')
