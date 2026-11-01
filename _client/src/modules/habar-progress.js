// Прошедшие календарные дни по Москве: 7 октября -> 1 ноября = 25/30.
export function habarElapsedDay(boughtTs, now){
    if(!Number.isFinite(boughtTs) || boughtTs <= 0 || !Number.isFinite(now)) return 0;
    const day = ts => Math.floor((ts + 10800000) / 86400000);
    return Math.min(30, Math.max(0, day(now) - day(boughtTs)));
}

// Midnight Moscow on the calendar date of receipt + totalDays; receipt stays intact.
export function habarExpiresAtMs(boughtTs, totalDays = 30){
    if(!Number.isFinite(boughtTs) || boughtTs <= 0 || !Number.isInteger(totalDays) || totalDays < 1) return 0;
    return (Math.floor((boughtTs + 10800000) / 86400000) + totalDays) * 86400000 - 10800000;
}
