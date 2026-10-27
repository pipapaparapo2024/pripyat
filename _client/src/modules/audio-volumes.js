// Keep the PIXI master gain neutral: music and effects have independent gains.
export function applyAudioVolumes(){
    if(!window.PIXI || !PIXI.sound) return;
    PIXI.sound.volumeAll = 1;
    const sndVol = window._sndVol !== undefined ? window._sndVol : 0.7;
    const groups = [
        ['bg_music_', 2, window._musVol !== undefined ? window._musVol : 0.5],
        ['dvor_music_', 3, sndVol],
        ['zone_ambient_', 5, sndVol],
    ];
    groups.forEach(([prefix, count, volume]) => {
        for(let i = 0; i < count; i++){
            const alias = prefix + i;
            if(PIXI.sound.exists(alias)) PIXI.sound.find(alias).volume = volume;
        }
    });
    // 24.10.2026 (баг найден по прямому указанию — "регулирую громкость, не работает", репро
    // оказался в озвучке обучения): onboarding.js регистрирует озвучку под динамическими alias'ами
    // ('onboarding_' + url файла) — их нельзя перечислить заранее фиксированным count, как 3
    // группы выше, поэтому они были вообще не покрыты этой функцией и всегда играли на
    // захардкоженной volume:1 (см. onboarding.js._playNarration). Проходим по уже
    // зарегистрированным в PIXI.sound alias'ам (PIXI.sound._sounds — внутренняя карта библиотеки,
    // публичного метода перечисления в ней нет) и применяем тот же sndVol — тьюториал логически
    // "звук", не "музыка", та же группа, что dvor/zone.
    if(PIXI.sound._sounds){
        Object.keys(PIXI.sound._sounds).forEach((alias) => {
            if(alias.indexOf('onboarding_') === 0) PIXI.sound.find(alias).volume = sndVol;
        });
    }
    console.log('[audio-volumes.applyAudioVolumes]', {sound: window._sndVol, music: window._musVol});
}
