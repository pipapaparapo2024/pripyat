const statusLine = document.getElementById('receipt-status');
const list = document.getElementById('receipt-list');
const products = {stew: 'Тушёнка', coins: 'Игровые рубли', cigarettes: 'Сухари', energy: 'Энергия'};
const rubles = new Intl.NumberFormat('ru-RU', {style: 'currency', currency: 'RUB'});
let previous = '';
let timer;
let inFlight = false;

function fiscalLink(value) {
  try {
    const url = new URL(value);
    return url.origin === 'https://lknpd.nalog.ru'
      && !url.username && !url.password && url.pathname.startsWith('/api/v1/receipt/') ? url.href : null;
  } catch {
    return null;
  }
}

function render(order) {
  const entry = document.createElement('article');
  const title = document.createElement('p');
  title.textContent = `${products[order.reward_field] || 'Игровые ресурсы'} × ${order.reward_count} · ${rubles.format(order.amount_minor / 100)} · ${new Date(order.credited_at * 1000).toLocaleString('ru-RU')}`;
  entry.append(title);
  const url = fiscalLink(order.receipt_url);
  if (url && order.status === 'registered') {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Открыть чек ФНС';
    entry.append(link);
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    const image = document.createElement('img');
    image.src = qr.createDataURL(4, 16);
    image.alt = 'QR-код чека ФНС';
    image.width = 160;
    image.height = 160;
    const frame = document.createElement('p');
    frame.append(image);
    entry.append(frame);
  } else {
    const message = document.createElement('p');
    message.textContent = ['refund_review', 'partial_refund', 'canceled'].includes(order.status)
      ? 'По оплате оформлен возврат. Если нужен уточнённый чек, обратитесь в поддержку.'
      : ['failed', 'review', 'unknown'].includes(order.status)
        ? 'Чек проверяется. Если он не появится, обратитесь в поддержку.'
        : 'Чек формируется. Страница обновится автоматически.';
    entry.append(message);
  }
  return entry;
}

async function refresh() {
  clearTimeout(timer);
  if (document.hidden || inFlight) return;
  inFlight = true;
  let loggedOut = false;
  try {
    const response = await fetch('/auth/status?receipts=1', {cache: 'no-store', credentials: 'same-origin'});
    if (response.status === 401) {
      loggedOut = true;
      list.replaceChildren();
      statusLine.textContent = 'Войдите тем же способом, которым входили перед оплатой, и откройте «Чеки покупок».';
      return;
    }
    if (!response.ok) throw new Error('history_unavailable');
    const {receipts} = await response.json();
    const snapshot = JSON.stringify(receipts);
    if (snapshot !== previous || !list.childElementCount) {
      list.replaceChildren(...receipts.map(render));
      previous = snapshot;
    }
    statusLine.textContent = receipts.length ? '' : 'Новые чеки появятся здесь после подтверждения оплаты.';
  } catch {
    list.replaceChildren();
    statusLine.textContent = 'Чеки пока недоступны. Проверим снова через несколько секунд.';
  } finally {
    inFlight = false;
    if (!loggedOut) timer = setTimeout(refresh, 15000);
  }
}

document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
refresh();
