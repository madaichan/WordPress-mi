<?php
/**
 * Quiz Builder v2 smoke — image questions (PRD §13.10).
 * Throwaway entity, cleaned up.
 *   php wp-content/plugins/Pukat/tools/smoke-quiz-image.php
 * @package Pukat
 */
declare(strict_types=1);
require dirname( __DIR__, 4 ) . '/wp-load.php';
use Pukat\Services\QuizQuestionService;
use Pukat\Services\QuizPageGenerator;
global $wpdb;
$f=[]; function check($l,$ok,&$f){echo '['.($ok?'PASS':'FAIL')."] $l\n"; if(!$ok)$f[]=$l;}
wp_set_current_user(1);
$E='ZZImgQ';
$wpdb->delete($wpdb->prefix.'pukat_quiz_questions',['entity_name'=>$E]);
$svc=new QuizQuestionService();
// 1x1 transparent PNG
$png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
$opts=[['label'=>'Benar','value'=>'a','correct'=>true],['label'=>'Salah','value'=>'b','correct'=>false]];

$img=$svc->create(['entity'=>$E,'question'=>'Apa yang salah pada gambar ini?','question_type'=>'image','image_data'=>$png,'input_name'=>'answer_img1','options'=>$opts],1);
check('create image question',is_array($img)&&($img['question_type']??'')==='image',$f);
$id=is_array($img)?(int)$img['id']:0;

$one=$svc->get_one(['id'=>$id]);
check('get_one returns image_data',is_array($one)&&str_starts_with((string)($one['image_data']??''),'data:image/png'),$f);

$list=$svc->list(['entity'=>$E]);
$row=null; foreach(($list['questions']??[]) as $q){if((int)$q['id']===$id)$row=$q;}
check('list marks has_image, omits bytes',$row&&!empty($row['has_image'])&&!array_key_exists('image_data',$row),$f);

$bad=$svc->create(['entity'=>$E,'question'=>'x','question_type'=>'image','image_data'=>'http://x/y.png','input_name'=>'answer_img2','options'=>$opts],1);
check('reject non-data-URI image',is_wp_error($bad),$f);
$miss=$svc->create(['entity'=>$E,'question'=>'x','question_type'=>'image','input_name'=>'answer_img3','options'=>$opts],1);
check('reject image question without image',is_wp_error($miss),$f);
$big='data:image/png;base64,'.base64_encode(str_repeat('x',1024*1024+10));
$over=$svc->create(['entity'=>$E,'question'=>'x','question_type'=>'image','image_data'=>$big,'input_name'=>'answer_img4','options'=>$opts],1);
check('reject >1MB image',is_wp_error($over),$f);

// generator renders the img
$rows=$svc->selected_questions([$id],$E);
$html=(new QuizPageGenerator())->generate('<form method="post">{{pukat:questions}}</form>',[],$rows);
check('generated HTML has the inline img',str_contains($html,'<img src="data:image/png;base64,')&&str_contains($html,'class="pukat-question-image"'),$f);

// text question has no image column stored
$txt=$svc->create(['entity'=>$E,'question'=>'teks biasa','question_type'=>'text','input_name'=>'answer_txt1','options'=>$opts],1);
$txtrow=$svc->get_one(['id'=>(int)$txt['id']]);
check('text question stores no image',is_array($txtrow)&&array_key_exists('image_data',$txtrow)&&null===$txtrow['image_data'],$f);

$wpdb->delete($wpdb->prefix.'pukat_quiz_questions',['entity_name'=>$E]);
echo "-- cleanup --\n";
echo "\n".($f?count($f)." FAILURE(S)\n":"ALL PASS\n");
exit($f?1:0);
