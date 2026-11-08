<?php
require __DIR__.'/../../server/core/controllers/dice.php';
$dice = (new ReflectionClass(Dice::class))->newInstanceWithoutConstructor();
$reduce = new ReflectionMethod(Dice::class, '_reduceFarmPairs');
function check($condition, $reason) {
    if (!$condition) throw new RuntimeException($reason);
}
mt_srand(93628);
$pairSurvives = [3 => 0, 5 => 0];
$rerollSurvives = [3 => 0, 5 => 0];
for ($trial = 0; $trial < 4000; $trial++) {
    $both = $reduce->invoke($dice, [3, 3, 5, 5]);
    foreach ([3, 5] as $face) {
        $pairSurvives[$face] += count(array_keys($both, $face, true)) === 2 ? 1 : 0;
        $reroll = $reduce->invoke($dice, [4, $face, $face, 4], 1);
        check($reroll[0] === 4 && $reroll[2] === $face && $reroll[3] === 4, 'Reroll changed a kept die');
        check($reroll[1] === $face || !in_array($reroll[1], [3, 4, 5], true), 'Replacement created another pair');
        $rerollSurvives[$face] += $reroll[1] === $face ? 1 : 0;
        $held = [$face, $face, 1, 2];
        check($reduce->invoke($dice, $held, 3) === $held, 'Kept pair was broken');
    }
    foreach ([[3, 3, 3, 1], [5, 5, 5, 5], [6, 6, 6, 6], [3, 4, 4, 5]] as $untouched) {
        check($reduce->invoke($dice, $untouched) === $untouched, 'Unrelated outcome changed');
    }
}
foreach (array_merge(array_values($pairSurvives), array_values($rerollSurvives)) as $count) {
    check(abs($count - 2000) < 120, 'Expected roughly half of eligible pairs to remain');
}
echo "PASS: both pairs halved, kept dice and higher combinations preserved\n";

$boost = new ReflectionMethod(Dice::class, '_boostThirdThree');
$weightedDie = new ReflectionMethod(Dice::class, '_weightedDie');
$premium = new ReflectionMethod(Dice::class, '_reducePremiumRoll');
$catalog = json_decode(file_get_contents(__DIR__.'/../../server/json/dice_config.json'), true, 512, JSON_THROW_ON_ERROR);
$baseThrees = $boostedThrees = 0;
$trials = 30000;
mt_srand(17028);
for ($i = 0; $i < $trials; $i++) {
    $trace = [];
    $face = $weightedDie->invokeArgs($dice, [$catalog, &$trace]);
    $roll = $premium->invokeArgs($dice, [[3, 3, $face, 2], $catalog, &$trace, 2]);
    $result = $boost->invoke($dice, $reduce->invoke($dice, $roll, 2), 2);
    $baseThrees += $roll[2] === 3 ? 1 : 0;
    $boostedThrees += $result[2] === 3 ? 1 : 0;
    check($result[0] === 3 && $result[1] === 3 && $result[3] === 2, 'Boost changed a kept die');
    foreach ([[3, 4, 3, 2], [3, 3, 1, 3], [5, 5, 1, 2]] as $untouched) {
        check($boost->invoke($dice, $untouched, 2) === $untouched, 'Boost applied without exactly two kept threes');
    }
}
check(abs($baseThrees / $trials - 0.19) < 0.008, 'Unexpected base rate');
check(abs($boostedThrees / $trials - 0.22) < 0.008, 'Third three should have roughly 22% chance');
echo sprintf("PASS: third three increased from %.2f%% to %.2f%%\n", 100 * $baseThrees / $trials, 100 * $boostedThrees / $trials);
