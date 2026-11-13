<?php
require __DIR__.'/../../website/app/rewardstotp.php';
$key = '12345678901234567890';
$cases = [
    RewardsTotp::base32('f') === 'MY',
    RewardsTotp::base32('foo') === 'MZXW6',
    RewardsTotp::base32('foobar') === 'MZXW6YTBOI',
    RewardsTotp::code($key, 1, 8) === '94287082',
    RewardsTotp::code($key, intdiv(1111111109, 30), 8) === '07081804',
    RewardsTotp::match($key, '287082', 59, -1) === 1,
    RewardsTotp::match($key, '287082', 60, -1) === 1,
    RewardsTotp::match($key, '287082', 90, -1) === null,
    RewardsTotp::match($key, '287082', 59, 1) === null,
    RewardsTotp::match($key, '28708', 59, -1) === null,
];
if (in_array(false, $cases, true)) exit(1);
echo "TOTP: OK\n";
