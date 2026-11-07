<?php
final class SiteAvatar {
 public static function url(int $id,string $secret): ?string {
  if($id<1)return null;$name=hash_hmac('sha256','site-avatar:'.$id,$secret).'.jpg';$file=__DIR__.'/../public/assets/avatars/'.$name;
  return is_file($file)?'/assets/avatars/'.$name.'?v='.filemtime($file):null;
 }
 public static function upload(int $id,array $file,string $secret): string {
  if($id<1||($file['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_OK||($file['size']??0)>2097152||!is_uploaded_file($file['tmp_name']))throw new InvalidArgumentException('invalid_avatar');
  $info=getimagesize($file['tmp_name']);
  if(!$info||!in_array($info[2],[IMAGETYPE_JPEG,IMAGETYPE_PNG,IMAGETYPE_WEBP],true)||$info[0]<32||$info[1]<32||$info[0]>4096||$info[1]>4096||$info[0]*$info[1]>12000000)throw new InvalidArgumentException('invalid_avatar');
  $bytes=file_get_contents($file['tmp_name']);$image=imagecreatefromstring($bytes);if(!$image)throw new InvalidArgumentException('invalid_avatar');
  $square=imagecreatetruecolor(256,256);$side=min($info[0],$info[1]);
  imagecopyresampled($square,$image,0,0,(int)(($info[0]-$side)/2),(int)(($info[1]-$side)/2),256,256,$side,$side);
  $directory=__DIR__.'/../public/assets/avatars';$name=hash_hmac('sha256','site-avatar:'.$id,$secret).'.jpg';$tmp=tempnam($directory,'avatar-');
  try{if(!imagejpeg($square,$tmp,88))throw new RuntimeException('avatar_write_failed');chmod($tmp,0644);if(!rename($tmp,$directory.'/'.$name))throw new RuntimeException('avatar_write_failed');}finally{if(is_file($tmp))unlink($tmp);imagedestroy($image);imagedestroy($square);}
  return self::url($id,$secret);
 }
}
