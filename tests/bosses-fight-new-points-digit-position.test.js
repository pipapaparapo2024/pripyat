/**
 * УСТАРЕЛ (20.09.2026): проверял ручной сдвиг x счётчика "НОВЫЕ" по числу цифр
 * (NEW_PTS_X_BY_DIGITS) — этот костыль имитировал центрирование текста, когда у него ещё не
 * было настоящей подложки. Пользователь прислал реальный фон («круг под новые очки.png») —
 * текст теперь центрируется anchor(0.5,0.5) относительно центра подложки и корректно
 * выглядит при ЛЮБОМ числе цифр без ручного пересчёта x. Таблица NEW_PTS_X_BY_DIGITS удалена
 * из кода. Актуальные тесты подложек — tests/boss-fight-points-badges-centered-text.test.js.
 *
 * Run: node tests/bosses-fight-new-points-digit-position.test.js
 */
console.log('УСТАРЕЛ — механизм заменён (см. tests/boss-fight-points-badges-centered-text.test.js). Пропускаем.');
console.log(`\n${'─'.repeat(50)}`);
console.log('✅ All 0 tests passed');
