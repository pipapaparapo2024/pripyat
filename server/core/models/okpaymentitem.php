<?php
class OkPaymentItem {
    public static function response($item, $responses, $prices) {
        if (!is_string($item) || !preg_match('/^ok_item(\d+)$/D', $item, $m)) return null;
        $id = intval($m[1]);
        if (!isset($responses[$id])) return null;
        $okPrices = []; $offset = 0;
        foreach (['stew','coins','cigarettes'] as $currency) {
            foreach ($prices[$currency]['price_ok'] as $i=>$price) $okPrices[$offset+$i] = $price;
            $offset += count($prices[$currency]['default']);
        }
        foreach ([20,49,70,140,280,420,595,840] as $i=>$price) $okPrices[100+$i] = $price;
        if (!isset($okPrices[$id])) return null;
        $response = $responses[$id];
        $response['price'] = intval($okPrices[$id]);
        // get_item requires the exact requested identifier, including its namespace.
        $response['item_id'] = $item;
        $response['expiration'] = 0;
        return $response;
    }
}
