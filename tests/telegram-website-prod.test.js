const {execFileSync}=require('node:child_process');
const {findPhpBin}=require('./_php_bin.js');
const php=findPhpBin();
if(!php)throw new Error('Для проверки PROD Telegram website требуется PHP');
process.stdout.write(execFileSync(php,['tests/_php_fixtures/telegram-website-prod.php'],{encoding:'utf8'}));

const fs=require('node:fs');
const websiteEntry=fs.readFileSync('_client/src/website-entry.js','utf8');
if(!websiteEntry.includes("authMode==='telegram-prod'?'/auth/telegram-prod'"))throw new Error('Веб-клиент не выбирает изолированный PROD Telegram auth');
if(!websiteEntry.includes("authMode==='telegram-prod'?'/telegram/server':'/server'"))throw new Error('PROD Telegram runtime должен использовать PROD API');
const login=fs.readFileSync('website/login.js','utf8');
if(!login.includes("'/auth/telegram-prod/status'"))throw new Error('Главная сайта не проверяет готовность PROD Telegram входа');
if(!login.includes("'/auth/telegram-prod/start'"))throw new Error('Кнопка Telegram должна запускать PROD OAuth flow');
process.stdout.write('Telegram website PROD client routing: OK\n');
