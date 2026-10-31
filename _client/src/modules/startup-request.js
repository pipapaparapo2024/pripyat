// Optional platform metadata must not hold the game loader forever.
// Authentication remains a separate mandatory server request.
export function startupRequest(request, timeoutMs = 10000){
    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (callback, value) => {
            if(settled) return;
            settled = true;
            clearTimeout(timer);
            callback(value);
        };
        const timer = setTimeout(() => finish(reject, new Error('Platform startup response timed out')), timeoutMs);
        Promise.resolve().then(request).then(value => finish(resolve, value), error => finish(reject, error));
    });
}
