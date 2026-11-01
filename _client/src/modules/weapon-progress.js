export function weaponAcquiredTotal(user, index, legacyKey){
    let slots=user.weapons || [];
    if(typeof slots==='string'){try{slots=JSON.parse(slots);}catch(e){slots=[];}}
    const slot=Array.isArray(slots)?slots[index] || {}:{};
    return Math.max(0,Number(slot.acquired_total)||0,Number(slot.qty)||0,Number(user[legacyKey])||0);
}
