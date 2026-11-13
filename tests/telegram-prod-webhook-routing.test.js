const fs=require('node:fs');
const handler=fs.readFileSync('server/site-payments-webhook.php','utf8');
const release=fs.readFileSync('tools/deploy-telegram-website-prod.py','utf8');
const worker=fs.readFileSync('tools/site-npd-receipts.php','utf8');
const auth=fs.readFileSync('website/app/telegramprodhttp.php','utf8');
const receiptPath='/var/lib/pripyat-telegram-website/receipts';
if(!worker.includes(receiptPath)||!auth.includes(receiptPath)||!release.includes('ReadWritePaths='+receiptPath))
    throw new Error('Хранилище чеков Telegram должно совпадать в PHP, worker и systemd');
if(handler.includes('../website/app/'))
    throw new Error('Общий webhook не должен загружать файлы из локальной структуры репозитория');
if(!handler.includes("if($world==='telegram')"))throw new Error('Live YooKassa webhook must route Telegram PROD payments');
if(!handler.includes("$provider->isTest()"))throw new Error('Telegram PROD webhook must reject test-shop payments');
if(!handler.includes("'stalker_telegram'"))throw new Error('Telegram callback must be pinned to the PROD database');
if(!handler.includes('PRIPYAT_TELEGRAM_WEBSITE_PAYMENT_CONFIG'))throw new Error('Telegram DB access must use a separate private config');
if(!handler.includes("in_array($world,['site','vk','ok'],true)"))throw new Error('Existing site/VK/OK callback routing must remain intact');
process.stdout.write('Telegram PROD YooKassa webhook routing: OK\n');
