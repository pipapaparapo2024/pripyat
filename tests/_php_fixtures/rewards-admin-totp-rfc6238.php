<?php
require __DIR__ . '/../../../../сайт/totp.php';
$secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
$cases = [59 => '287082', 1111111109 => '081804', 1111111111 => '050471', 1234567890 => '005924', 2000000000 => '279037'];
foreach($cases as $timestamp => $expected) if(rewards_totp_code($secret, $timestamp) !== $expected) exit("RFC vector failed at $timestamp\n");
if(!rewards_totp_verify($secret, '287082', 59)) exit("current code rejected\n");
if(!rewards_totp_verify($secret, '287082', 89)) exit("one time period window rejected\n");
if(rewards_totp_verify($secret, '287082', 119)) exit("expired code accepted\n");
if(rewards_totp_verify($secret, 'abcdef', 59)) exit("non-numeric code accepted\n");
try { rewards_totp_base32_decode('invalid!'); exit("invalid base32 secret accepted\n"); } catch(InvalidArgumentException $e) {}
$uri = rewards_totp_provisioning_uri('Припять Награды', 'rewards-admin', $secret);
if(strpos($uri, 'otpauth://totp/') !== 0 || strpos($uri, 'secret=' . $secret) === false) exit("provisioning URI invalid\n");
echo "OK\n";
