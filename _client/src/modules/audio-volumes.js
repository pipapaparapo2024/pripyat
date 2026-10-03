// Keep the PIXI master gain neutral: music and effects have independent gains.
export function applyAudioVolumes(){
    if(!window.PIXI || !PIXI.sound) return;
    PIXI.sound.volumeAll = 1;
    const groups = [
        ['bg_music_', 2, window._musVol !== undefined ? window._musVol : 0.5],
        ['dvor_music_', 3, window._sndVol !== undefined ? window._sndVol : 0.7],
        ['zone_ambient_', 5, window._sndVol !== undefined ? window._sndVol : 0.7],
    ];
    groups.forEach(([prefix, count, volume]) => {
        for(let i = 0; i < count; i++){
            const alias = prefix + i;
            if(PIXI.sound.exists(alias)) PIXI.sound.find(alias).volume = volume;
        }
    });
    console.log('[audio-volumes.applyAudioVolumes]', {sound: window._sndVol, music: window._musVol});
}
