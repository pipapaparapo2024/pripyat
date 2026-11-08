<?php
require __DIR__.'/../../server/core/models/gameops.php';
class BagOpsFixture extends Gameops {
    function catalog($name) { return json_decode(file_get_contents(__DIR__.'/../../server/json/'.$name.'.json'), true, 512, JSON_THROW_ON_ERROR); }
}
function expectBag(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}
$ops = new BagOpsFixture([]);
$catalog = $ops->catalog('shmot_items');
$client = file_get_contents(__DIR__.'/../../_client/src/game/shmot.js');
foreach (['sidorovich_bag'=>[101,105], 'poker_bag'=>[106,110], 'roulette_bag'=>[111,115]] as $pool => [$first,$last]) {
    $ids = array_column(array_filter($catalog, fn($item)=>($item['source']??null)===$pool), 'id');
    expectBag($ids===range($first,$last), 'Catalog source mismatch');
    foreach ($ids as $id) expectBag(preg_match('/\bid:'.$id.',[^\r\n]*\bfragments:40\b/', $client)===1, 'Client threshold mismatch');
    $user = ['shmot'=>'[]', 'shmot_fragments'=>'{"41":9}', 'max_energy'=>50];
    $drop = $ops->grantBagFragment($user, $pool);
    expectBag(in_array($drop['id'],$ids,true) && $drop['have']===1 && $drop['need']===40 && !$drop['completed'], 'Expected one fragment of a pool item');
    $progress=json_decode($user['shmot_fragments'],true);
    expectBag($progress[41]===9 && $progress[$drop['id']]===1 && count($progress)===2 && $user['shmot']==='[]', 'Other progress or ownership changed');
}
$state=array_fill(0,116,['owned'=>false,'equipped'=>false]);
foreach ([111,112,114,115] as $id) $state[$id]['owned']=true;
$user=['shmot'=>json_encode($state),'shmot_fragments'=>'{"113":38,"41":9}','max_energy'=>50];
$drop=$ops->grantBagFragment($user,'roulette_bag');
expectBag($drop['have']===39 && !$drop['completed'] && $user['max_energy']===50, '39 fragments must not grant an item or energy');
$drop=$ops->grantBagFragment($user,'roulette_bag');
$state=json_decode($user['shmot'],true);
expectBag($drop['id']===113 && $drop['have']===40 && $drop['completed'] && $state[113]['owned'] && $user['max_energy']===80, '40th fragment must finish the item and apply the bonus once');
expectBag(json_decode($user['shmot_fragments'],true)===[41=>9], 'Completed progress or unrelated fragments were not preserved correctly');
$before=$user;
expectBag($ops->grantBagFragment($user,'roulette_bag')===null && $user===$before, 'Full set must not grant duplicates');
expectBag($ops->grantBagFragment($user,'dice')===null && $user===$before, 'Unmarked pool must not issue fragments');
$whole=$ops->grantShmotFromSource($user,'dice');
expectBag($whole!==null && json_decode($user['shmot'],true)[$whole]['owned'], 'Ordinary clothing rewards must remain whole');
echo "PASS: separate fragment pools, 40-part completion, energy bonus once, no duplicates, normal drops unchanged\n";
