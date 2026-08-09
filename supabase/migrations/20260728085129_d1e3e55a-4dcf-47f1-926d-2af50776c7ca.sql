
-- =========================================================================
-- LITERATURE HALL — schema + seeds
-- =========================================================================

-- 1) literature_works
CREATE TABLE public.literature_works (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title_zh TEXT,
  title_original TEXT,
  author_zh TEXT,
  author_original TEXT,
  language TEXT NOT NULL,
  country_or_region TEXT,
  literary_form TEXT,
  era TEXT,
  publication_year TEXT,
  is_public_domain BOOLEAN NOT NULL DEFAULT true,
  rights_note TEXT,
  source_url TEXT,
  source_name TEXT,
  verification_status TEXT NOT NULL DEFAULT 'reviewed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.literature_works TO authenticated, anon;
GRANT ALL ON public.literature_works TO service_role;
ALTER TABLE public.literature_works ENABLE ROW LEVEL SECURITY;
CREATE POLICY "works readable" ON public.literature_works FOR SELECT USING (true);
CREATE POLICY "works admin write" ON public.literature_works FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER trg_lit_works_updated BEFORE UPDATE ON public.literature_works
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) literature_passages
CREATE TABLE public.literature_passages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_id UUID NOT NULL REFERENCES public.literature_works(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  original_text TEXT NOT NULL,
  display_text_zh TEXT,
  display_text_en TEXT,
  text_type TEXT NOT NULL DEFAULT 'original',
  translator TEXT,
  rights_status TEXT NOT NULL DEFAULT 'public_domain',
  citation_label TEXT,
  context_zh TEXT,
  context_en TEXT,
  default_interpretation_zh TEXT,
  default_interpretation_en TEXT,
  action_prompt_zh TEXT,
  action_prompt_en TEXT,
  question_zh TEXT,
  question_en TEXT,
  life_stage_tags TEXT[] NOT NULL DEFAULT '{}',
  concern_tags TEXT[] NOT NULL DEFAULT '{}',
  tone_tags TEXT[] NOT NULL DEFAULT '{}',
  reading_path TEXT,
  weight NUMERIC NOT NULL DEFAULT 1.0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.literature_passages TO authenticated, anon;
GRANT ALL ON public.literature_passages TO service_role;
ALTER TABLE public.literature_passages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "passages readable" ON public.literature_passages FOR SELECT USING (active = true);
CREATE POLICY "passages admin write" ON public.literature_passages FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER trg_lit_passages_updated BEFORE UPDATE ON public.literature_passages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_lit_pass_stage ON public.literature_passages USING GIN (life_stage_tags);
CREATE INDEX idx_lit_pass_concern ON public.literature_passages USING GIN (concern_tags);
CREATE INDEX idx_lit_pass_tone ON public.literature_passages USING GIN (tone_tags);

-- 3) user_literature_preferences
CREATE TABLE public.user_literature_preferences (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_tones TEXT[] NOT NULL DEFAULT '{}',
  preferred_regions TEXT[] NOT NULL DEFAULT '{}',
  prefers_classical BOOLEAN NOT NULL DEFAULT true,
  prefers_modern BOOLEAN NOT NULL DEFAULT true,
  show_age_on_share BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_literature_preferences TO authenticated;
GRANT ALL ON public.user_literature_preferences TO service_role;
ALTER TABLE public.user_literature_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prefs" ON public.user_literature_preferences FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_lit_prefs_updated BEFORE UPDATE ON public.user_literature_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) user_literature_recommendations
CREATE TABLE public.user_literature_recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chart_id UUID REFERENCES public.charts(id) ON DELETE SET NULL,
  passage_id UUID NOT NULL REFERENCES public.literature_passages(id) ON DELETE CASCADE,
  life_stage TEXT,
  concern TEXT,
  reading_tone TEXT,
  ranking_score NUMERIC,
  ranking_reasons JSONB NOT NULL DEFAULT '{}'::jsonb,
  personalized_bridge_zh TEXT,
  personalized_bridge_en TEXT,
  ai_model TEXT,
  prompt_version TEXT,
  content_version TEXT NOT NULL DEFAULT 'v1',
  saved BOOLEAN NOT NULL DEFAULT false,
  dismissed BOOLEAN NOT NULL DEFAULT false,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unique_key TEXT NOT NULL,
  UNIQUE (user_id, unique_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_literature_recommendations TO authenticated;
GRANT ALL ON public.user_literature_recommendations TO service_role;
ALTER TABLE public.user_literature_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own recs" ON public.user_literature_recommendations FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_lit_recs_user_time ON public.user_literature_recommendations(user_id, last_viewed_at DESC);

-- 5) user_literature_annotations
CREATE TABLE public.user_literature_annotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recommendation_id UUID NOT NULL REFERENCES public.user_literature_recommendations(id) ON DELETE CASCADE,
  annotation TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','share_only')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_literature_annotations TO authenticated;
GRANT ALL ON public.user_literature_annotations TO service_role;
ALTER TABLE public.user_literature_annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own annotations" ON public.user_literature_annotations FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_lit_ann_updated BEFORE UPDATE ON public.user_literature_annotations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- SEED DATA: 15 works
-- =========================================================================

INSERT INTO public.literature_works (slug, title_zh, title_original, author_zh, author_original, language, country_or_region, literary_form, era, publication_year, is_public_domain, rights_note, source_name) VALUES
('shijing-guanju',      '关雎',       '關雎',                    '佚名',       '佚名',            'zh', 'China', 'poetry', 'pre-Qin', 'c. 1000-600 BCE', true, '公共领域', '《诗经·周南》'),
('gushi-shijiu-xingxing','行行重行行','行行重行行',              '佚名',       '佚名',            'zh', 'China', 'poetry', 'Han',    'c. 100-200 CE',    true, '公共领域', '《古诗十九首》'),
('zhuangzi-xiaoyao',    '逍遥游节录', '逍遙遊',                  '庄子',       '莊周',            'zh', 'China', 'prose',  'Warring States','c. 300 BCE', true, '公共领域', '《庄子》'),
('taoyuanming-yinjiu5', '饮酒·其五', '飲酒·其五',                '陶渊明',     '陶淵明',          'zh', 'China', 'poetry', 'Jin',    'c. 400 CE',        true, '公共领域', '陶渊明集'),
('wangwei-shanjuqiuming','山居秋暝','山居秋暝',                  '王维',       '王維',            'zh', 'China', 'poetry', 'Tang',   'c. 750 CE',        true, '公共领域', '王维集'),
('libai-jiangjinjiu',   '将进酒',     '將進酒',                  '李白',       '李白',            'zh', 'China', 'poetry', 'Tang',   'c. 752 CE',        true, '公共领域', '李太白集'),
('libai-xinglunan',     '行路难·其一','行路難·其一',              '李白',       '李白',            'zh', 'China', 'poetry', 'Tang',   'c. 742 CE',        true, '公共领域', '李太白集'),
('dufu-denggao',        '登高',       '登高',                    '杜甫',       '杜甫',            'zh', 'China', 'poetry', 'Tang',   'c. 767 CE',        true, '公共领域', '杜工部集'),
('dufu-wangyue',        '望岳',       '望嶽',                    '杜甫',       '杜甫',            'zh', 'China', 'poetry', 'Tang',   'c. 736 CE',        true, '公共领域', '杜工部集'),
('baijuyi-pipaxing',    '琵琶行',     '琵琶行',                  '白居易',     '白居易',          'zh', 'China', 'poetry', 'Tang',   '816 CE',           true, '公共领域', '白氏长庆集'),
('sushi-dingfengbo',    '定风波·莫听','定風波·莫聽穿林打葉聲',    '苏轼',       '蘇軾',            'zh', 'China', 'ci',     'Song',   '1082 CE',          true, '公共领域', '东坡词'),
('sushi-shuidiao',      '水调歌头·明月','水調歌頭·明月幾時有',    '苏轼',       '蘇軾',            'zh', 'China', 'ci',     'Song',   '1076 CE',          true, '公共领域', '东坡词'),
('liqingzhao-shengsheng','声声慢',    '聲聲慢',                  '李清照',     '李清照',          'zh', 'China', 'ci',     'Song',   'c. 1135 CE',       true, '公共领域', '漱玉词'),
('xinqiji-choununer',   '丑奴儿·书博山','醜奴兒·書博山道中壁',    '辛弃疾',     '辛棄疾',          'zh', 'China', 'ci',     'Song',   'c. 1181 CE',       true, '公共领域', '稼轩长短句'),
('wangbo-tengwangge',   '滕王阁序',   '滕王閣序',                '王勃',       '王勃',            'zh', 'China', 'prose',  'Tang',   '675 CE',           true, '公共领域', '王子安集'),
('wangxizhi-lantingji', '兰亭集序',   '蘭亭集序',                '王羲之',     '王羲之',          'zh', 'China', 'prose',  'Jin',    '353 CE',           true, '公共领域', '王右军集'),
('shijing-jianjia',     '蒹葭',       '蒹葭',                    '佚名',       '佚名',            'zh', 'China', 'poetry', 'pre-Qin', 'c. 1000-600 BCE', true, '公共领域', '《诗经·秦风》'),
('lunyu-shizhe',        '论语·逝者如斯','論語·子在川上曰',         '孔子',       '孔子',            'zh', 'China', 'prose',  'pre-Qin', 'c. 500 BCE',      true, '公共领域', '《论语·子罕》'),
('whitman-song',        '自我之歌',   'Song of Myself',          '惠特曼',     'Walt Whitman',    'en', 'USA',   'poetry', 'modern', '1855',             true, '公共领域', 'Leaves of Grass'),
('dickinson-hope',      '希望是长着羽毛的东西','"Hope" is the thing with feathers','狄金森','Emily Dickinson','en','USA','poetry','modern','c. 1861', true, '公共领域', 'Poems by Emily Dickinson'),
('thoreau-walden',      '瓦尔登湖节录','Walden',                 '梭罗',       'Henry David Thoreau','en','USA','prose','modern','1854',                 true, '公共领域', 'Walden'),
('wordsworth-ode',      '不朽颂节录', 'Ode: Intimations of Immortality','华兹华斯','William Wordsworth','en','UK','poetry','modern','1807',           true, '公共领域', 'Poems in Two Volumes'),
('shakespeare-asyoulikeit','皆大欢喜·世界是舞台','As You Like It',  '莎士比亚','William Shakespeare','en','UK','drama','early modern','1599',           true, '公共领域', 'As You Like It II.vii');

-- =========================================================================
-- SEED DATA: 30 passages
-- Each passage tags: life_stage_tags, concern_tags, tone_tags, reading_path
-- reading_paths: youth_spirit (少年意气), first_steps (初入人间), love_farewell (爱与告别), midway (行至中途)
-- life_stage_tags: youth(12-24), early_career(25-32), midlife_entry(33-42), midlife(43-55), later(56+)
-- concern_tags: study, career, love, family, solitude, wealth, migration, recovery, self
-- tone_tags: classical, direct, tender, sober, romantic, absurd
-- =========================================================================

WITH w AS (SELECT id, slug FROM public.literature_works)
INSERT INTO public.literature_passages
  (work_id, slug, original_text, display_text_zh, display_text_en, text_type, rights_status, citation_label,
   context_zh, context_en, default_interpretation_zh, default_interpretation_en,
   action_prompt_zh, action_prompt_en, question_zh, question_en,
   life_stage_tags, concern_tags, tone_tags, reading_path, weight)
VALUES
-- 1
((SELECT id FROM w WHERE slug='shijing-guanju'), 'guanju-yaotiao',
 '窈窕淑女，君子好逑。', '窈窕淑女，君子好逑。', 'A gentle, graceful maiden — a good match for a noble man.',
 'original', 'public_domain', '《诗经·周南·关雎》',
 '中国最早的诗歌总集开卷第一首，写少年对心仪之人的思慕。','The opening poem of the earliest Chinese poetry anthology, on youthful longing.',
 '爱意最初的形状，往往是安静地看着一个人。','Love first arrives as quiet attention to another person.',
 '写下你当下真正想靠近的人。','Write down who you actually want to move closer to now.',
 '你在他身上看到的，是他，还是你想成为的自己？','Do you see them, or a version of who you want to be?',
 ARRAY['youth','early_career'], ARRAY['love','self'], ARRAY['classical','tender'], 'love_farewell', 1.0),

-- 2
((SELECT id FROM w WHERE slug='shijing-jianjia'), 'jianjia-suwei',
 '所谓伊人，在水一方。', '所谓伊人，在水一方。', 'The one I long for stands on the far side of the water.',
 'original', 'public_domain', '《诗经·秦风·蒹葭》',
 '在秋日苇丛中追寻始终无法靠近的人，是中文最古的"未完成的爱"。','Chasing someone across autumn reeds — the oldest Chinese image of unfinished love.',
 '有些人一辈子只出现在河的对岸。','Some people stay across the water for a lifetime.',
 '给一个"你没能靠近的人"，写下一句你今天才敢说的话。','Write, to someone you never reached, the sentence you can finally say today.',
 '如果河对岸的人一直没变，是不是你自己也没走开？','If the far shore never changed, is it because you never left either?',
 ARRAY['early_career','midlife_entry','midlife'], ARRAY['love','recovery'], ARRAY['classical','tender','sober'], 'love_farewell', 1.0),

-- 3
((SELECT id FROM w WHERE slug='gushi-shijiu-xingxing'), 'gushi-xingxing',
 '行行重行行，与君生别离。', '行行重行行，与君生别离。', 'On and on I walked, walked on — parted from you while both still living.',
 'original', 'public_domain', '《古诗十九首》',
 '汉末乱世中最普遍的处境：与所爱之人在生前被迫远离。','A Han-era image of being torn from someone you love while both are still alive.',
 '有些告别不是死亡，是活着的两个人再也见不到。','Some farewells are not death; they are two living people who never meet again.',
 '给一个还活着但已远的人，写一句你不会寄出的话。','Write one line to someone still alive but out of reach — one you will never send.',
 '你在等对方回来，还是在等自己放下？','Are you waiting for them, or waiting to let go?',
 ARRAY['early_career','midlife_entry','midlife'], ARRAY['love','family','migration'], ARRAY['classical','tender'], 'love_farewell', 1.0),

-- 4
((SELECT id FROM w WHERE slug='zhuangzi-xiaoyao'), 'zhuangzi-peng',
 '鲲之大，不知其几千里也……怒而飞，其翼若垂天之云。','鲲之大，不知其几千里也……怒而飞，其翼若垂天之云。',
 'The Kun is vast — none know how many thousand miles. It rises in anger, wings like clouds hung across heaven.',
 'original','public_domain','《庄子·逍遥游》',
 '中国哲学最早的想象：不肯被自己的名字定义的生物。','The earliest Chinese image of a creature that refuses to be defined by its name.',
 '你不必先证明自己足够大，才允许自己想要一次真正的飞。','You do not need to prove you are large enough before you allow yourself to want to fly.',
 '写下一件你以"我还不够格"为理由推迟的事。','Write one thing you have postponed by saying "I am not qualified yet".',
 '这一次不飞的理由，和上一次是同一个吗？','Is your reason for not flying this time the same as last time?',
 ARRAY['youth','early_career'], ARRAY['career','self'], ARRAY['classical','absurd','romantic'], 'youth_spirit', 1.0),

-- 5
((SELECT id FROM w WHERE slug='taoyuanming-yinjiu5'), 'yinjiu5-nanshan',
 '采菊东篱下，悠然见南山。','采菊东篱下，悠然见南山。','I pluck chrysanthemums by the eastern hedge, and calmly the southern mountain comes into view.',
 'original','public_domain','《饮酒·其五》',
 '陶渊明四十余岁辞官归田，这两句写的是他重新开始过日子的清晨。','Written after Tao Yuanming resigned in his forties and returned to farm; these are lines from a quiet morning of starting again.',
 '真正的南山不是被你追到的，是你终于愿意抬头时它就在那里。','The mountain was never chased down; it was always there the moment you were willing to look up.',
 '今天做一件不为任何人证明什么的小事。','Do one small thing today that proves nothing to anyone.',
 '你上一次"没有目的地做一件事"是什么时候？','When was the last time you did something without a purpose?',
 ARRAY['midlife_entry','midlife','later'], ARRAY['self','recovery','career'], ARRAY['classical','sober','tender'], 'midway', 1.1),

-- 6
((SELECT id FROM w WHERE slug='wangwei-shanjuqiuming'), 'wangwei-mingyue',
 '明月松间照，清泉石上流。','明月松间照，清泉石上流。','Bright moon in the pines; a clear spring runs over stones.',
 'original','public_domain','《山居秋暝》',
 '王维中年半官半隐，这两句是他自己安静下来后看到的世界。','Written by Wang Wei during his half-retirement in mid-life — the world as he saw it once he grew quiet.',
 '当你不再向外解释自己，风景才愿意走近你。','Once you stop explaining yourself outward, the world moves closer.',
 '今晚离开屏幕十分钟，只是看一下窗外。','Tonight, leave the screen for ten minutes and just look out the window.',
 '你有多久没有让一件事"没有下一步"？','How long since you allowed something to simply have no next step?',
 ARRAY['midlife_entry','midlife'], ARRAY['solitude','self','recovery'], ARRAY['classical','sober','tender'], 'midway', 1.0),

-- 7
((SELECT id FROM w WHERE slug='libai-jiangjinjiu'), 'jiangjinjiu-tiansheng',
 '天生我材必有用，千金散尽还复来。','天生我材必有用，千金散尽还复来。','Heaven gave me talents that must be of use; a thousand gold pieces spent will come again.',
 'original','public_domain','《将进酒》',
 '李白酒后写下的自我确认，其实那时他并不得志。','Written by Li Bai in wine — a public act of self-belief at a time when he was, in fact, not in favour.',
 '相信自己的时候，往往正是外部还没相信你的时候。','You most need to believe in yourself precisely when the outside world does not yet.',
 '写下你此刻真心相信的一件"以后一定行"的事。','Write one thing you truly believe will work — later.',
 '这句话你今天读，是安慰，是壮胆，还是不甘心？','Today, do these words comfort you, embolden you, or refuse to let you settle?',
 ARRAY['youth','early_career'], ARRAY['career','self','wealth'], ARRAY['direct','romantic'], 'youth_spirit', 1.2),

-- 8
((SELECT id FROM w WHERE slug='libai-xinglunan'), 'xinglunan-changfeng',
 '长风破浪会有时，直挂云帆济沧海。','长风破浪会有时，直挂云帆济沧海。','A great wind will one day break the waves; then hoist the cloud-sail and cross the vast sea.',
 'original','public_domain','《行路难·其一》',
 '李白仕途受挫、心里满是"路难行"时，在诗的末尾突然给自己留下一句希望。','Li Bai wrote this at the end of a poem full of blocked roads — he ends by leaving himself one line of hope.',
 '真正的"以后会好"，是在承认现在很难之后仍写下的那一句。','A real "it will be better" is the line you still write after admitting today is hard.',
 '写下现在最卡住你的一件事，和这件事"会好"的最小版本。','Write down what most blocks you now, and the smallest version of it getting better.',
 '你相信这一句，是因为它真，还是因为你今天需要它？','Do you believe this line because it is true, or because you need it today?',
 ARRAY['early_career','midlife_entry'], ARRAY['career','recovery','self'], ARRAY['direct','romantic'], 'first_steps', 1.2),

-- 9
((SELECT id FROM w WHERE slug='dufu-wangyue'), 'wangyue-huidang',
 '会当凌绝顶，一览众山小。','会当凌绝顶，一览众山小。','I will one day climb the highest peak, and all mountains will look small.',
 'original','public_domain','《望岳》',
 '杜甫二十四五岁登临泰山所写，是他一生最年轻、最不知天高地厚的一首诗。','Written by Du Fu around 24, gazing at Mt. Tai — his youngest and boldest poem.',
 '有些话只有二十几岁的自己写得出来，值得被四十岁的自己重读。','Some lines can only be written at 24 — and are worth being reread at 40.',
 '找出你二十岁时说过的一句"以后要做的事"，看看它今天怎么样了。','Find something you at 20 said you would do — and see where it stands now.',
 '你今天愿意重新签一次那个当年的自己吗？','Would you sign, today, the promise your younger self made?',
 ARRAY['youth','early_career','midlife_entry'], ARRAY['career','self'], ARRAY['direct','romantic'], 'youth_spirit', 1.1),

-- 10
((SELECT id FROM w WHERE slug='dufu-denggao'), 'denggao-wanli',
 '万里悲秋常作客，百年多病独登台。','万里悲秋常作客，百年多病独登台。','Ten thousand miles from home, a chronic guest in autumn''s grief; a lifetime of illness — I climb the terrace alone.',
 'original','public_domain','《登高》',
 '杜甫五十六岁写下，此时他远离家乡、贫病交加，独自登高。','Written by Du Fu at 56, far from home, poor and ill, climbing alone.',
 '中年之后的悲伤，是"没人可以一起爬这一段山"。','Grief in middle age is: no one is walking this stretch up the mountain with you.',
 '给一个你已经很久没联系、但当年一起走过一段路的人，发一条消息。','Message one person you have not contacted in a long time, who once walked a stretch of road with you.',
 '你独自登台的时候，最想告诉谁？','When you climbed alone, who did you most want to tell?',
 ARRAY['midlife','later'], ARRAY['solitude','recovery','family'], ARRAY['sober','classical'], 'midway', 1.2),

-- 11
((SELECT id FROM w WHERE slug='baijuyi-pipaxing'), 'pipa-tongshi',
 '同是天涯沦落人，相逢何必曾相识。','同是天涯沦落人，相逢何必曾相识。','We are both fallen souls at the world''s edge — meeting now, why must we have known each other before?',
 'original','public_domain','《琵琶行》',
 '白居易被贬江州，深夜船头遇到一位一样从繁华跌落的琵琶女，两人素不相识却彼此看懂。','Bai Juyi, demoted to Jiangzhou, meets a pipa player on the river at night — a stranger who has also fallen from a bright past. Neither knew the other before; both understood.',
 '有时候懂你的人不是老朋友，而是一个和你走了同一段下坡路的陌生人。','Sometimes the one who understands you is not an old friend, but a stranger who walked the same descent.',
 '想一个"陌生人却看懂了你"的时刻，把它写下来，别只藏在心里。','Recall a moment a stranger saw you clearly — and write it down instead of only holding it.',
 '现在的你，更需要一个老朋友，还是一个刚刚才认识的人？','Right now, do you need an old friend, or a person you have only just met?',
 ARRAY['early_career','midlife_entry','midlife'], ARRAY['career','recovery','solitude'], ARRAY['classical','sober','tender'], 'first_steps', 1.5),

-- 12
((SELECT id FROM w WHERE slug='baijuyi-pipaxing'), 'pipa-cailueshuai',
 '门前冷落鞍马稀，老大嫁作商人妇。','门前冷落鞍马稀，老大嫁作商人妇。','Fewer horses at my door now; older, I married a merchant.',
 'original','public_domain','《琵琶行》',
 '琵琶女讲述自己年轻时被追捧、成年后无人问津，最后随便嫁人的过程。','The pipa player recounts her youth of admirers, her later years of silence, and marrying almost by default.',
 '才华与位置不总是匹配，尤其在一个人不再年轻之后。','Talent and station do not always match, especially after one is no longer young.',
 '写下一件"我明明可以，但没有人给我机会"的事。','Write one thing that you were capable of, but no one gave you the chance.',
 '你更难接受的是没被看见，还是自己也开始不看自己？','What is harder — not being seen, or beginning to stop seeing yourself?',
 ARRAY['early_career','midlife_entry','midlife'], ARRAY['career','wealth','love'], ARRAY['classical','sober'], 'first_steps', 1.2),

-- 13
((SELECT id FROM w WHERE slug='sushi-dingfengbo'), 'dingfengbo-mo',
 '莫听穿林打叶声，何妨吟啸且徐行。','莫听穿林打叶声，何妨吟啸且徐行。','Do not mind the rain crashing through leaves — why not hum, and walk on slowly?',
 'original','public_domain','《定风波》',
 '苏轼被贬黄州第三年，途中遇雨，同行者狼狈，他独自不觉。','Written in Su Shi''s third year of exile in Huangzhou: he and companions were caught in rain; the others panicked, he did not.',
 '真正的从容不是没有下雨，是下雨那一刻你没有先跑。','Real composure is not the absence of rain, but not being the first to run when it starts.',
 '今天遇到一件让你想立刻反应的事，先什么都不做十分钟。','The next thing that makes you want to react instantly today — do nothing for ten minutes first.',
 '你在着急的时候，能听见自己的呼吸吗？','When you are in a hurry, can you still hear your own breathing?',
 ARRAY['midlife_entry','midlife','later'], ARRAY['career','recovery','self'], ARRAY['sober','classical'], 'midway', 1.3),

-- 14
((SELECT id FROM w WHERE slug='sushi-shuidiao'), 'shuidiao-danyuan',
 '但愿人长久，千里共婵娟。','但愿人长久，千里共婵娟。','May we live long, and share this moon across a thousand miles.',
 'original','public_domain','《水调歌头》',
 '苏轼中秋写给弟弟苏辙，兄弟已多年未见。','Written by Su Shi at Mid-Autumn for his brother Su Zhe, whom he had not seen in years.',
 '有些人你无法常见，但可以约定同时抬头。','Some people you cannot see often, but you can agree to look up at the same time.',
 '给一个你想念但很久没联系的家人，发一句短消息。','Send one short message to a family member you miss but have not messaged in a long time.',
 '"长久"是长期在场，还是长期在心里？','Does "long-lasting" mean always present, or always kept in mind?',
 ARRAY['early_career','midlife_entry','midlife','later'], ARRAY['family','love','migration'], ARRAY['classical','tender'], 'love_farewell', 1.2),

-- 15
((SELECT id FROM w WHERE slug='liqingzhao-shengsheng'), 'shengsheng-xunxun',
 '寻寻觅觅，冷冷清清，凄凄惨惨戚戚。','寻寻觅觅，冷冷清清，凄凄惨惨戚戚。','Searching, searching; cold, so cold; alone, alone in sorrow.',
 'original','public_domain','《声声慢》',
 '李清照晚年国破家亡、丈夫已逝，独居时写下这七组叠字。','Written by Li Qingzhao in old age, after the fall of her country, the death of her husband, alone.',
 '有些悲伤没有对手，只是每一天都要重新开始一次。','Some grief has no opponent — it simply begins again every morning.',
 '今天不必"走出来"，允许自己安静地坐十分钟。','Today, do not try to "get past it". Sit quietly for ten minutes.',
 '你现在需要有人陪，还是需要有人安静地不打扰你？','Do you need company now, or someone quietly not intruding?',
 ARRAY['midlife','later'], ARRAY['recovery','solitude','family'], ARRAY['classical','sober','tender'], 'love_farewell', 1.1),

-- 16
((SELECT id FROM w WHERE slug='xinqiji-choununer'), 'choununer-shaonian',
 '少年不识愁滋味，爱上层楼。而今识尽愁滋味，欲说还休。','少年不识愁滋味，爱上层楼。而今识尽愁滋味，欲说还休。',
 'Young, I did not know the taste of sorrow — I loved to climb high towers. Now I know it fully, and yet I want to say it, then stop.',
 'original','public_domain','《丑奴儿·书博山道中壁》',
 '辛弃疾中年被闲置多年后所写。','Written by Xin Qiji after being sidelined for years in middle age.',
 '真正懂得的时候，反而不那么想说了。','When one truly understands, one no longer wants to say it aloud.',
 '写下一件你少年时会大声抱怨、现在只会短短说一句的事。','Write one thing you would have complained loudly about as a teenager, and now only mention briefly.',
 '你不再说的原因，是没意义，还是没人听得懂？','Do you no longer say it because it is pointless, or because no one would understand?',
 ARRAY['midlife_entry','midlife','later'], ARRAY['self','recovery'], ARRAY['sober','classical'], 'midway', 1.1),

-- 17
((SELECT id FROM w WHERE slug='wangbo-tengwangge'), 'tengwang-laodang',
 '老当益壮，宁移白首之心？穷且益坚，不坠青云之志。','老当益壮，宁移白首之心？穷且益坚，不坠青云之志。',
 'Grow older, grow stronger — never move the heart because the hair whitens. In poverty grow firmer — never let the cloud-high ambition fall.',
 'original','public_domain','《滕王阁序》',
 '王勃二十几岁在滕王阁上写下这一段，声音年轻得近乎逼人。','Written by Wang Bo in his twenties at the Tengwang Pavilion — a young voice almost sharp with insistence.',
 '有些话年轻人写、中年人读，才最动人。','Some lines are most moving when written by the young and read by the middle-aged.',
 '给此刻的自己，写一句"我不改的东西是什么"。','Write, to yourself today, one line: "what will I not change".',
 '你的"青云之志"是别人写给你的，还是你自己写的？','Is your ambition one you wrote for yourself, or one someone else wrote for you?',
 ARRAY['early_career','midlife_entry','midlife'], ARRAY['career','self'], ARRAY['direct','romantic','classical'], 'first_steps', 1.0),

-- 18
((SELECT id FROM w WHERE slug='wangxizhi-lantingji'), 'lanting-sishengyida',
 '死生亦大矣，岂不痛哉！','死生亦大矣，岂不痛哉！','Life and death are the great matter — how could this not hurt?',
 'original','public_domain','《兰亭集序》',
 '王羲之与友人春日雅集之后，突然写下这一句。','Written by Wang Xizhi at the end of a bright spring gathering with friends — a sudden turn.',
 '真正的清醒不是不痛，而是承认痛这件事本身值得被认真对待。','Real clarity is not the absence of pain, but the willingness to take the fact of pain seriously.',
 '给最近一次你压下去的难过，起一个名字。','Give a name to the sadness you most recently pushed down.',
 '你今天最不敢承认"这件事让我很难受"的一件事是什么？','What is the one thing today you are least willing to admit hurt you?',
 ARRAY['midlife_entry','midlife','later'], ARRAY['recovery','self'], ARRAY['sober','classical'], 'midway', 1.0),

-- 19
((SELECT id FROM w WHERE slug='lunyu-shizhe'), 'lunyu-shizhe-1',
 '逝者如斯夫，不舍昼夜。','逝者如斯夫，不舍昼夜。','So it passes, like this — never resting, day or night.',
 'original','public_domain','《论语·子罕》',
 '孔子在河边看着流水，说了这一句。','Confucius said this while watching a river.',
 '有些东西不用担心它会不会走，它只是走得比你想象的快。','Some things do not need to be worried about leaving — they simply leave faster than you thought.',
 '今晚睡前，写下今天真正对你重要的一件小事。','Before sleep tonight, write down one small thing that actually mattered today.',
 '你今天有没有做一件"过了就再没有了"的事？','Did you do one thing today that will not come back?',
 ARRAY['youth','early_career','midlife_entry','midlife','later'], ARRAY['self','recovery'], ARRAY['classical','sober','direct'], 'midway', 1.0),

-- 20
((SELECT id FROM w WHERE slug='whitman-song'), 'whitman-contain',
 'Do I contradict myself? Very well then I contradict myself, (I am large, I contain multitudes.)',
 '我自相矛盾吗？好吧，我就自相矛盾——我很辽阔，我包含众多。',
 'Do I contradict myself? Very well then I contradict myself, (I am large, I contain multitudes.)',
 'original','public_domain','Whitman, Song of Myself §51',
 '惠特曼在自我之歌接近结尾时的宣言，一个人第一次允许自己"不必一致"。','Near the end of Song of Myself, Whitman gives himself permission not to be consistent.',
 '你不必先把自己修剪整齐，才配被称作一个人。','You do not need to trim yourself into consistency before you are allowed to be a person.',
 '写下你身上两件互相矛盾、但都真实的事。','Write down two contradictory things about yourself that are both true.',
 '你为什么以为矛盾是错的？','Why did you assume contradiction was wrong?',
 ARRAY['youth','early_career','midlife_entry'], ARRAY['self'], ARRAY['direct','romantic'], 'youth_spirit', 1.1),

-- 21
((SELECT id FROM w WHERE slug='dickinson-hope'), 'dickinson-hope-1',
 '"Hope" is the thing with feathers - That perches in the soul - And sings the tune without the words -',
 '"希望"是长着羽毛的东西——栖在灵魂里——唱着没有词的调子——',
 '"Hope" is the thing with feathers — That perches in the soul — And sings the tune without the words —',
 'original','public_domain','Dickinson, No. 254',
 '狄金森一生极少出门，却写下这句关于希望的著名开头。','Dickinson, who rarely left her home, wrote this famous opening about hope.',
 '希望不是响亮的宣告，是一只不肯离开的小鸟。','Hope is not a loud announcement; it is a small bird that will not leave.',
 '写下最近让你"没有理由地又想试一次"的一件事。','Write down one thing that has made you want to try again, for no clear reason.',
 '你上一次听见自己心里那只小鸟唱歌，是什么时候？','When did you last hear that bird singing inside you?',
 ARRAY['youth','early_career','midlife_entry','midlife','later'], ARRAY['recovery','self'], ARRAY['tender','direct'], 'midway', 1.0),

-- 22
((SELECT id FROM w WHERE slug='thoreau-walden'), 'thoreau-deliberately',
 'I went to the woods because I wished to live deliberately.',
 '我到林中去，是因为我希望活得慎重。',
 'I went to the woods because I wished to live deliberately.',
 'original','public_domain','Thoreau, Walden',
 '梭罗二十八岁独自搬到瓦尔登湖边，试图重新回答"什么是必要的"。','At 28, Thoreau moved alone to Walden Pond to answer, again, what is necessary.',
 '"慎重地活"不是过更慢的生活，是过一个你真的在选的生活。','To live deliberately is not to live more slowly, but to live a life you actually chose.',
 '写下这周你为自己主动选过的一件事（不是被安排的）。','Write down one thing you actively chose for yourself this week (not something arranged for you).',
 '你现在的生活里，哪一部分是你真的选过的？','Which part of your life did you actually choose?',
 ARRAY['early_career','midlife_entry','midlife'], ARRAY['self','career','recovery'], ARRAY['direct','sober'], 'first_steps', 1.1),

-- 23
((SELECT id FROM w WHERE slug='wordsworth-ode'), 'wordsworth-splendour',
 'Though nothing can bring back the hour Of splendour in the grass, of glory in the flower; We will grieve not, rather find Strength in what remains behind.',
 '虽然再也回不去那一刻——草地曾经如此辉煌，花朵曾经如此荣光——我们并不悲伤，只在剩下的一切里，寻找力量。',
 'Though nothing can bring back the hour of splendour in the grass, of glory in the flower; we will grieve not, rather find strength in what remains behind.',
 'original','public_domain','Wordsworth, Ode',
 '华兹华斯在人到中年时承认：童年的那种"世界发光"的感觉再也不会回来了。','Wordsworth, in middle age, admits: the childhood sensation that the world glowed will not return.',
 '成熟不是找回过去，而是承认它已过去、然后从剩下的里继续活。','Maturity is not recovering the past — it is admitting it is past, then continuing from what remains.',
 '写下一件"已经回不去，但我仍然感谢它发生过"的事。','Write one thing that will never return, but that you are grateful happened.',
 '你现在剩下的里面，有没有一样其实一直没被你用过？','Among what remains to you, is there one thing you have not yet used?',
 ARRAY['midlife_entry','midlife','later'], ARRAY['recovery','family','self'], ARRAY['tender','sober','romantic'], 'midway', 1.2),

-- 24
((SELECT id FROM w WHERE slug='shakespeare-asyoulikeit'), 'shakespeare-stage',
 'All the world''s a stage, And all the men and women merely players; They have their exits and their entrances; And one man in his time plays many parts.',
 '世界是一座舞台，所有男女不过是演员：各有各的出场和退场；一个人在一生中要扮演许多角色。',
 'All the world''s a stage, And all the men and women merely players; They have their exits and their entrances; And one man in his time plays many parts.',
 'original','public_domain','Shakespeare, As You Like It II.vii',
 '莎士比亚借人物之口，把一生说成七幕戏，从婴儿到晚年。','Shakespeare, through Jaques, describes a life as seven acts, infant to old age.',
 '你不是同一个角色演一辈子，你只是刚好轮到这一幕。','You do not play one role for a lifetime — this act simply happens to be yours right now.',
 '给你现在的这一幕起一个名字。','Give the act you are currently playing a name.',
 '你在这一幕里，是不是还在演上一幕的台词？','In this act, are you still saying lines from the last one?',
 ARRAY['early_career','midlife_entry','midlife','later'], ARRAY['self','career'], ARRAY['classical','absurd','direct'], 'midway', 1.0),

-- 25
((SELECT id FROM w WHERE slug='libai-jiangjinjiu'), 'jiangjinjiu-junbujian',
 '君不见黄河之水天上来，奔流到海不复回。','君不见黄河之水天上来，奔流到海不复回。',
 'Have you not seen — the Yellow River pouring down from heaven, rushing to the sea, never to return?',
 'original','public_domain','《将进酒》',
 '李白开篇一句用整条黄河形容时间过得有多快。','Li Bai opens the poem by using an entire river to describe how fast time passes.',
 '时间从来不是慢慢流走的，是有一天你突然发现它已经不在原地了。','Time does not slip away slowly — one day you simply notice it is no longer where it was.',
 '写下你今年"还没做但今年一定要做"的一件事。','Write one thing you have not yet done this year, but must do before it ends.',
 '什么是你在等的那个"更合适的时机"？','What exactly is the "better moment" you are waiting for?',
 ARRAY['youth','early_career','midlife_entry','midlife'], ARRAY['self','career'], ARRAY['direct','romantic'], 'youth_spirit', 1.1),

-- 26
((SELECT id FROM w WHERE slug='taoyuanming-yinjiu5'), 'yinjiu5-jiezai',
 '结庐在人境，而无车马喧。','结庐在人境，而无车马喧。','I built a hut in the human world, yet hear no cart, no horse.',
 'original','public_domain','《饮酒·其五》',
 '陶渊明并没有真的走进深山，他只是学会了对喧嚣不再回应。','Tao Yuanming did not actually retreat to the mountains; he simply learned to stop responding to noise.',
 '真正的安静，不是没有人，是你不再急着回应每一件事。','Real quiet is not the absence of people — it is no longer rushing to reply to everything.',
 '今天挑一条消息，允许自己不回。','Choose one message today and allow yourself not to reply.',
 '你"必须马上回"的感觉，是别人给你的，还是你给自己的？','The feeling that you must reply immediately — did someone give it to you, or did you give it to yourself?',
 ARRAY['early_career','midlife_entry','midlife'], ARRAY['solitude','self','recovery'], ARRAY['classical','sober'], 'midway', 1.0),

-- 27
((SELECT id FROM w WHERE slug='dufu-denggao'), 'denggao-wubian',
 '无边落木萧萧下，不尽长江滚滚来。','无边落木萧萧下，不尽长江滚滚来。','Boundless leaves fall rustling down; the great river rolls on without end.',
 'original','public_domain','《登高》',
 '杜甫五十六岁在长江边写下这两句，个人的悲和天地的大放在一起。','Written by Du Fu at 56 on the banks of the Yangtze — personal grief laid against the vastness of the world.',
 '把自己的难放在一条更大的河边，不代表它变小了，只是它有了同类。','Setting your grief beside a larger river does not shrink it — it simply gives it company.',
 '出门走十分钟，找一处比你更大的东西，看一下再回来。','Step out for ten minutes and look at something larger than you before returning.',
 '你有没有一个可以承载你悲伤的地方，而不是一个人？','Do you have a place — not a person — that can hold your grief?',
 ARRAY['midlife','later'], ARRAY['recovery','solitude'], ARRAY['sober','classical'], 'midway', 1.0),

-- 28
((SELECT id FROM w WHERE slug='libai-xinglunan'), 'xinglunan-jinzun',
 '金樽清酒斗十千，玉盘珍羞直万钱。停杯投箸不能食，拔剑四顾心茫茫。','金樽清酒斗十千，玉盘珍羞直万钱。停杯投箸不能食，拔剑四顾心茫茫。',
 'A gold cup of pure wine — ten thousand a measure; a jade platter of rare food — worth a fortune. I set down cup and chopsticks, cannot eat. I draw my sword, look around — my heart is at a loss.',
 'original','public_domain','《行路难·其一》',
 '在真正说出"以后会好"之前，李白先诚实写下：桌上什么都有，但我一口都吃不下。','Before Li Bai can say "one day it will be better", he honestly writes: everything is on the table, and I cannot eat a bite.',
 '有些困住你的时刻，不是没有东西，是有东西你却不想要。','Some moments do not trap you by lack — they trap you by things you no longer want.',
 '写下一件"看起来该开心，我却开心不起来"的事。','Write one thing you are "supposed" to be happy about, but are not.',
 '你允许自己承认"我现在其实不想要这个"吗？','Do you allow yourself to admit "I actually do not want this right now"?',
 ARRAY['early_career','midlife_entry','midlife'], ARRAY['career','recovery','self','wealth'], ARRAY['sober','direct'], 'first_steps', 1.1),

-- 29
((SELECT id FROM w WHERE slug='baijuyi-pipaxing'), 'pipa-xianxian',
 '别有幽愁暗恨生，此时无声胜有声。','别有幽愁暗恨生，此时无声胜有声。','Another hidden sorrow, another secret grief arises — and here, silence surpasses sound.',
 'original','public_domain','《琵琶行》',
 '白居易写琵琶女弹到一半时的那一段沉默。','Bai Juyi describes the moment the pipa player pauses mid-song.',
 '有些情绪不需要被表达完整，留一段沉默反而更完整。','Some emotions do not need to be fully expressed — a length of silence completes them better.',
 '今天给一件事留一段沉默：不解释，不辩护，不评论。','Today, give one thing a length of silence — no explanation, no defense, no comment.',
 '你有没有一件事，是你一直"想说清楚"却越说越模糊？','Is there something you keep "trying to say clearly" that only gets blurrier?',
 ARRAY['midlife_entry','midlife','later'], ARRAY['recovery','self','love'], ARRAY['tender','sober','classical'], 'love_farewell', 1.0),

-- 30
((SELECT id FROM w WHERE slug='sushi-dingfengbo'), 'dingfengbo-yesuo',
 '一蓑烟雨任平生。','一蓑烟雨任平生。','One straw cape in the misty rain — let it be my whole life.',
 'original','public_domain','《定风波》',
 '苏轼在同一首词的下阕，用一句话总结了他被贬后的态度。','In the same poem''s second half, Su Shi sums up his post-exile attitude in one line.',
 '"任"不是放弃，是不再和天气吵架。','"Let it be" is not surrender — it is no longer arguing with the weather.',
 '选一件你已经吵了很久的事，今天不再和它争。','Choose one thing you have long argued with — and today, stop arguing.',
 '你现在最想"任它去"的是什么？','What do you most want, right now, to simply let be?',
 ARRAY['midlife_entry','midlife','later'], ARRAY['self','recovery','career'], ARRAY['classical','sober','romantic'], 'midway', 1.3);
