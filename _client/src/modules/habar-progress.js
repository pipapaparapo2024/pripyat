// Номер календарного дня подписки по Москве; пропуски не продлевают срок.
export function habarElapsedDay(boughtTs, now){
    if(!Number.isFinite(boughtTs) || boughtTs <= 0) return 1;
    const day = ts => Math.floor((ts + 10800000) / 86400000);
    return Math.min(30, Math.max(1, day(now) - day(boughtTs) + 1));
}
