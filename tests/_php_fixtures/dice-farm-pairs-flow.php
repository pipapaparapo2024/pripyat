<?php
namespace DiceRewardTest;

function mt_rand(int $min, int $max): int {
    if (!isset($GLOBALS['diceFlowRolls'])) return \mt_rand($min, $max);
    $next = array_shift($GLOBALS['diceFlowRolls']);
    if (!is_int($next) || $next < $min || $next > $max) throw new \RuntimeException('Unexpected RNG request');
    return $next;
}

require __DIR__.'/dice-single-shmot.php';

function assertFlow(bool $passed, string $message): void {
    if (!$passed) throw new \RuntimeException($message);
}

foreach ([0, 1] as $removePair) {
    $ops->user = ['id' => 987654, 'dice_points' => 0];
    $GLOBALS['diceFlowRolls'] = [80, 80, 1, 20, $removePair];
    $dice->start();
    $rolls = $ops->result['rolls'];
    assertFlow(count(array_keys($rolls, 5, true)) === 2 - $removePair, 'Initial roll did not apply the pair filter');
    $dice->start();
    assertFlow($ops->result['resumed'] && $ops->result['rolls'] === $rolls, 'Active roll changed on reconnect');
    $dice->resolve();
    assertFlow((int)$ops->user['dice_points'] === (1 - $removePair) * 2, 'Points disagree with displayed dice');
}

$ops->user = ['id' => 987654, 'coins' => 0, 'exp' => 0, 'dice_session' => json_encode(['active' => [
    'rolls' => [3, 3, 1, 2], 'swapsAllowed' => 1, 'swapsUsed' => 0, 'forced' => false,
]])];
$registry = new \ReflectionProperty(Dice::class, 'registry');
$registry->setValue($dice, $registry->getValue($dice) + ['user_params' => ['idx' => 2]]);
$GLOBALS['diceFlowRolls'] = [60, 100, 1];
$dice->reroll();
assertFlow($ops->result['rolls'] === [3, 3, 3, 2] && $ops->result['swapsUsed'] === 1, 'Reroll did not promote only the selected die');
$dice->reroll();
assertFlow($ops->error === 69, 'Exhausted reroll limit was bypassed');
$dice->resolve();
assertFlow((int)$ops->user['exp'] === 1000 && (int)$ops->user['coins'] === 0, 'Triple paid the wrong reward');
$saved = $ops->user;
$dice->resolve();
assertFlow($ops->error === 68 && $ops->user === $saved, 'Reward could be replayed');

foreach ([3, 5] as $face) {
    for ($chance = 1; $chance <= 10; $chance++) {
        $rolls = [$face, $face, $face, 2];
        $ops->user = ['id' => 987654, 'dice_session' => json_encode(['active' => [
            'rolls' => $rolls, 'swapsAllowed' => 1, 'swapsUsed' => 0, 'forced' => false,
        ]])];
        $GLOBALS['diceFlowRolls'] = $chance === 1 ? [1, 1] : [$chance];
        $dice->reroll();
        $rolls[2] = $chance === 1 ? 1 : $face;
        assertFlow($ops->result['rolls'] === $rolls, 'Triple protection changed the wrong face');
        assertFlow($ops->result['swapsUsed'] === 1 && !$GLOBALS['diceFlowRolls'], 'Triple reroll consumed the wrong draws or swaps');
        $dice->start();
        assertFlow($ops->result['resumed'] && $ops->result['rolls'] === $rolls, 'Protected reroll changed on reconnect');
    }
}
echo "PASS: initial roll, reconnect, reroll limit and server rewards\n";
