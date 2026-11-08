<?php
/** TEST gateway shape policy. Authentication and developer rights remain server-side. */
final class NativeTestMethodPolicy {
    public static function allows($method): bool {
        if(!is_string($method)||!preg_match('/^[a-z0-9]+\.[A-Za-z][A-Za-z0-9]*$/D',$method))return false;
        // This controller method also requires an authenticated developer account.
        if(in_array($method,['users.devGrantShmot','users.resetSession'],true))return true;
        return !preg_match('/\.(?:dev|reset|setDev|toggleDev)/i',$method);
    }
}
