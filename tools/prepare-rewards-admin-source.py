"""Import public legacy form/catalogs only. Never copy config, passwords, or TOTP secrets."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
source=Path.home()/'Desktop/vk_game/сайт';out=ROOT/'rewards-admin';out.mkdir(exist_ok=True)
text=(source/'index.php').read_text(encoding='utf-8-sig')
start=text.index('// 27.09.2026');end=text.index('const ROW_COUNT',start)
text=text[:start]+text[end:]
start=text.index('// 25.09.2026');end=text.index('$link = db();',start)
text=text[:start]+text[end:]
text=text.replace('$generatedUrl = null;','$generatedUrls = [];')
start=text.index('        $code = gen_code();');end=text.index('\n}\n\nfunction render_reward_summary',start)
text=text[:start]+'''        try {
            if(!hash_equals($_SESSION['create_nonce'],strval($_POST['create_nonce']??'')))throw new InvalidArgumentException('duplicate_create');
            unset($_SESSION['create_nonce']);
            $platforms=$_POST['platforms']??[];
            if(!is_array($platforms))throw new InvalidArgumentException('invalid_targets');
            $_SESSION['reward_links_generated']=reward_publisher()->create($platforms,$reward,$label,$ttlSec,time());
            header('Location: index.php?platform='.urlencode(reward_platform()));exit;
        } catch(Throwable $e){$formError='Не удалось создать ссылки. Проверьте площадки и награды; повторите с обновлённой страницы.';}
    }
}

if(isset($_SESSION['reward_links_generated'])){
    $generatedUrls=$_SESSION['reward_links_generated'];unset($_SESSION['reward_links_generated']);
''' +text[end:]
start=text.index('        <?php if($generatedUrl): ?>');end=text.index('        <?php if($formError): ?>',start)
text=text[:start]+'''        <?php foreach($generatedUrls as $platform=>$result): ?>
        <div class="generated">
          <div><?= htmlspecialchars(reward_platform_names()[$platform]) ?>: <?= $result['created']?'ссылка создана':'ошибка — ссылка не создана, другие площадки независимы' ?></div>
          <?php if($result['created']): ?><input type="text" readonly value="<?= htmlspecialchars($result['url']) ?>" onclick="this.select()"><?php endif; ?>
        </div>
        <?php endforeach; ?>
''' +text[end:]
text=text.replace('            <h2>Новая ссылка</h2>','''            <h2>Новые ссылки · TEST</h2>
            <input type="hidden" name="create_nonce" value="<?= htmlspecialchars($_SESSION['create_nonce']) ?>">
            <fieldset><legend>Создать отдельную ссылку для каждой выбранной площадки</legend>
            <?php foreach(reward_platform_names() as $key=>$name): ?>
              <label><input type="checkbox" name="platforms[]" value="<?= $key ?>"> <?= htmlspecialchars($name) ?></label>
            <?php endforeach; ?></fieldset>''')
text=text.replace("$url = VK_APP_LINK . '#reward=' . urlencode($r['code']);","$url = reward_url($r['code']);")
text=text.replace('        <h2>Последние ссылки</h2>','''        <h2>Последние ссылки: <?= htmlspecialchars(reward_platform_names()[reward_platform()]) ?></h2>
        <form method="get"><label>Площадка <select name="platform" onchange="this.form.submit()">
          <?php foreach(reward_platform_names() as $key=>$name): ?><option value="<?= $key ?>" <?= $key===reward_platform()?'selected':'' ?>><?= htmlspecialchars($name) ?></option><?php endforeach; ?>
        </select></label><button>Показать</button></form>''')
text=text.replace('href="logs.php"','href="logs.php?platform=<?= urlencode(reward_platform()) ?>"').replace(' · <a href="logout.php">Выйти</a>','')
text=text.replace("header('Location: index.php');","header('Location: index.php?platform='.urlencode(reward_platform()));")
(out/'index.php').write_text(text,encoding='utf-8')
for name in ['style.css','shmot_catalog.php','logs.php']:(out/name).write_bytes((source/name).read_bytes())
logs=(out/'logs.php').read_text(encoding='utf-8-sig')
logs=logs.replace("const VK_APP_LINK = 'https://vk.com/app54574178';",'').replace("VK_APP_LINK . '#reward=' . urlencode($r['code'])","reward_url($r['code'])")
logs=logs.replace('href="index.php"','href="index.php?platform=<?= urlencode(reward_platform()) ?>"').replace(' · <a href="logout.php">Выйти</a>','').replace('Игрок (VK id)','Игровой ID')
logs=logs.replace('<a href="https://vk.com/id<?= intval($r[\'user_id\']) ?>" target="_blank"><?= intval($r[\'user_id\']) ?></a>','<?= intval($r[\'user_id\']) ?>')
(out/'logs.php').write_text(logs,encoding='utf-8')
config=(source/'config.php').read_text(encoding='utf-8-sig')
catalog=config[config.index('function shmot_catalog()'):config.index('function gen_code()')]
(out/'catalog.php').write_text('<?php\n'+catalog,encoding='utf-8')
print('Imported public reward form, style, logs and catalogs; private legacy config excluded.')
