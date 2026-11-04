// Only explicit, non-identifying fields may reach the production console.
export function logOkPayment(stage, details = {}, scope = window){
    if(!scope.ok_payment_safe_diagnostics && scope.__nativeProdDevDiagnostics!==true) return;
    const safe={stage};
    if(stage==='callback'){
        let data=details.callbackData;
        safe.dataType=data===null?'null':Array.isArray(data)?'array':typeof data;
        if(typeof data==='string' && data.length<=4096){try{data=JSON.parse(data);}catch(e){}}
        const categories=['cancel','cancelled','canceled','not_supported','unsupported','invalid_params','access_denied','permission_denied','unavailable','error','ok','phone','card'];
        const rawCategory=typeof data==='string'?data:(data && typeof data==='object'?(data.error_type || data.type || data.status):null);
        safe.category=typeof rawCategory==='string' && categories.includes(rawCategory.toLowerCase())?rawCategory.toLowerCase():'unknown';
        if(data && typeof data==='object' && !Array.isArray(data)){
            const nested=data.error_data && typeof data.error_data==='object'?data.error_data:{};
            const code=data.error_code ?? data.errorCode ?? data.code ?? nested.error_code;
            if((typeof code==='number' || typeof code==='string') && /^-?\d{1,6}$/.test(String(code)))safe.errorCode=Number(code);
            const message=data.error_message || data.error_msg || data.error_reason || data.message || nested.error_reason || nested.error_message;
            if(typeof message==='string'){
                if(message.includes('UI methods are available only for apps running on OK portal'))safe.reason='sdk_not_initialized';
                else if(/cancel/i.test(message))safe.reason='cancelled';
                else if(/not supported|unsupported|handler.*(?:not.*exist|not.*provided)/i.test(message))safe.reason='unsupported';
                else if(/invalid.*param/i.test(message))safe.reason='invalid_params';
            }
        }
    }
    for(const key of ['item','price','fapi','ui','showPayment','util','init','hasApiServer','hasConnection','ready','method','result']){
        const value=details[key];
        if(typeof value==='boolean' || (typeof value==='number' && Number.isFinite(value))) safe[key]=value;
        else if(['method','result'].includes(key) && typeof value==='string' && /^[a-zA-Z_]{1,40}$/.test(value)) safe[key]=value;
    }
    if(scope.ok_payment_safe_diagnostics) scope.console.log('[ok-payment]',safe);
    const history=scope.ok_payment_safe_history || (scope.ok_payment_safe_history=[]);
    history.push({time:new Date().toISOString(),...safe});
    if(history.length>100)history.splice(0,history.length-100);
}
