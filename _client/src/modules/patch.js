export function applyPatch(patch){
  if(!patch || !window.udata) return;
  Object.assign(udata, patch);
  // max_energy обновляется ПЕРЕД energy — syncFromPatch() ниже считает регенерацию с
  // клэмпом по TIMERS.ENERGY_MAX, и если патч одновременно меняет потолок (например,
  // апгрейд здания), расчёт должен использовать уже новый потолок, а не старый.
  if(patch.max_energy !== undefined && window.TIMERS){
    TIMERS.ENERGY_MAX = parseInt(patch.max_energy) || TIMERS.ENERGY_MAX;
  }
  // 28.09.2026 (репорт — "энергия не восстанавливается/не сохраняется"): раньше здесь
  // просто присваивалось TIMERS.current_energy = patch.energy, не трогая
  // energy_base/energy_base_time — на следующем тике startEnergyTimer() пересчитывал
  // энергию от СТАРОЙ базы (сессии/предыдущего patch) и мог тут же откатить HUD обратно
  // вверх, либо таймер "+1 через N:NN" показывал неверный отсчёт. syncFromPatch()
  // (modules/timers.js) пересчитывает базу по той же формуле, что сервер
  // (Gameops::energySnapshot()), используя patch.energy_time.
  if(patch.energy !== undefined && window.TIMERS){
    TIMERS.syncFromPatch(patch.energy, patch.energy_time);
  }
  if(window.iface){
    if(typeof iface.updateUp === 'function') iface.updateUp();
    if(typeof iface.updateEnergy === 'function') iface.updateEnergy();
    if(typeof iface.updateNick === 'function') iface.updateNick();
  }
}
