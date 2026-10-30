// Local checks for fixes from the 30 October session. No deployment or live DB access.
const {spawnSync}=require('child_process');
const path=require('path');
const root=path.resolve(__dirname,'..');
const checks=[
    'run_tests.js',
    'tests/security-oct30-regression.test.js',
    'tests/security-request-key.test.js',
    'tests/dev-access-approved-players.test.js',
    'tests/music-resume-single-playback.test.js',
    'tests/game2048-top-avatars.test.js',
    'tests/users-php-real-exec-save-whitelist-holes-closed.test.js',
    'tests/ok-banner-viewport.test.js',
    'tests/energy-stash-release.test.js',
    'tests/stash-transfer-atomic.test.js',
    'tests/collection-achievements-client.test.js',
    'tests/friend-wishlist-modal.test.js',
    'tests/stash-count-layout.test.js',
    'tests/right-menu-daily-hitarea.test.js',
    'tests/right-menu-native-pixi-hitarea.test.js',
    'tests/ok-feature-schema.test.js',
    'tests/mobile-viewport-adaptive-hygiene.test.js',
    'tests/forced-landscape-rotation-math-roundtrip.test.js',
    'tests/ok-currency-platform-detection.test.js',
    'tests/iap-platform-dispatch-04-10.test.js',
    'tests/game2048-php-real-exec-core.test.js',
    'tests/raznaryadka-php-real-exec.test.js',
    'tests/zanachki-php-real-exec.test.js',
];
let failed=0;
for(const check of checks){
    const result=spawnSync(process.execPath,[check],{cwd:root,encoding:'utf8',timeout:60000});
    const ok=result.status===0;
    console.log(`${ok?'OK':'FAIL'} ${check}`);
    if(!ok){failed++;console.error(result.error||'',result.stdout,result.stderr);}
}
console.log(`Проверки исправлений: ${checks.length-failed}/${checks.length} успешно`);
process.exitCode=failed?1:0;
