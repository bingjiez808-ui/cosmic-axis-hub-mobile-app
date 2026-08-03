
CREATE TABLE public.historical_figures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_key text UNIQUE NOT NULL,
  name_zh text NOT NULL,
  name_en text NOT NULL,
  era_zh text NOT NULL,
  era_en text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.historical_figures TO anon, authenticated;
GRANT ALL ON public.historical_figures TO service_role;
ALTER TABLE public.historical_figures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "historical_figures_public_read" ON public.historical_figures FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "historical_figures_admin_write" ON public.historical_figures FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER historical_figures_touch BEFORE UPDATE ON public.historical_figures FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.historical_life_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text UNIQUE NOT NULL,
  person_key text NOT NULL REFERENCES public.historical_figures(person_key) ON DELETE CASCADE,
  stage text NOT NULL,
  domains text[] NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  signal text NOT NULL DEFAULT 'neutral',
  curated_rank int NOT NULL DEFAULT 999,
  situation_zh text NOT NULL, situation_en text NOT NULL,
  tension_zh text NOT NULL, tension_en text NOT NULL,
  choice_zh text NOT NULL, choice_en text NOT NULL,
  borrow_zh text NOT NULL, borrow_en text NOT NULL,
  dont_copy_zh text NOT NULL, dont_copy_en text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  content_version text NOT NULL DEFAULT 'life-guidance-v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT historical_events_signal_ck CHECK (signal IN ('opportunity','pressure','neutral')),
  CONSTRAINT historical_events_stage_ck CHECK (stage IN ('learning_self','early_adulthood','building_life','midlife_reassessment','maturity_legacy'))
);
CREATE INDEX historical_events_stage_active_idx ON public.historical_life_events(stage) WHERE is_active;
CREATE INDEX historical_events_domains_gin ON public.historical_life_events USING gin (domains);
CREATE INDEX historical_events_tags_gin ON public.historical_life_events USING gin (tags);
GRANT SELECT ON public.historical_life_events TO anon, authenticated;
GRANT ALL ON public.historical_life_events TO service_role;
ALTER TABLE public.historical_life_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "historical_events_public_read" ON public.historical_life_events FOR SELECT TO anon, authenticated USING (is_active);
CREATE POLICY "historical_events_admin_write" ON public.historical_life_events FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER historical_events_touch BEFORE UPDATE ON public.historical_life_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.historical_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_key text NOT NULL REFERENCES public.historical_figures(person_key) ON DELETE CASCADE,
  event_key text REFERENCES public.historical_life_events(event_key) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'biography',
  title text NOT NULL,
  url text,
  license text,
  is_primary boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX historical_sources_person_idx ON public.historical_sources(person_key);
CREATE INDEX historical_sources_event_idx ON public.historical_sources(event_key) WHERE event_key IS NOT NULL;
GRANT SELECT ON public.historical_sources TO anon, authenticated;
GRANT ALL ON public.historical_sources TO service_role;
ALTER TABLE public.historical_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "historical_sources_public_read" ON public.historical_sources FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "historical_sources_admin_write" ON public.historical_sources FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.historical_reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL REFERENCES public.historical_life_events(event_key) ON DELETE CASCADE,
  tone text NOT NULL DEFAULT 'curator',
  body_zh text NOT NULL,
  body_en text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX historical_reflections_event_idx ON public.historical_reflections(event_key);
GRANT SELECT ON public.historical_reflections TO anon, authenticated;
GRANT ALL ON public.historical_reflections TO service_role;
ALTER TABLE public.historical_reflections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "historical_reflections_public_read" ON public.historical_reflections FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "historical_reflections_admin_write" ON public.historical_reflections FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

INSERT INTO public.historical_figures (person_key, name_zh, name_en, era_zh, era_en) VALUES
  ('malala_yousafzai', '马拉拉 · 优素福扎伊', 'Malala Yousafzai', '巴基斯坦 · 1997– ', 'Pakistan · b. 1997'),
  ('benjamin_franklin', '本杰明 · 富兰克林', 'Benjamin Franklin', '北美 · 1706–1790', 'Colonial America · 1706–1790'),
  ('marie_curie', '玛丽 · 居里', 'Marie Curie', '波兰 / 法国 · 1867–1934', 'Poland / France · 1867–1934'),
  ('steve_jobs', '史蒂夫 · 乔布斯', 'Steve Jobs', '美国 · 1955–2011', 'USA · 1955–2011'),
  ('murasaki_shikibu', '紫式部', 'Murasaki Shikibu', '日本平安时代 · 约 973–1014', 'Heian Japan · c. 973–1014'),
  ('abraham_lincoln', '亚伯拉罕 · 林肯', 'Abraham Lincoln', '美国 · 1809–1865', 'USA · 1809–1865'),
  ('frida_kahlo', '弗里达 · 卡罗', 'Frida Kahlo', '墨西哥 · 1907–1954', 'Mexico · 1907–1954'),
  ('paul_gauguin', '保罗 · 高更', 'Paul Gauguin', '法国 · 1848–1903', 'France · 1848–1903'),
  ('carl_jung', '卡尔 · 荣格', 'Carl Jung', '瑞士 · 1875–1961', 'Switzerland · 1875–1961'),
  ('julia_child', '朱莉娅 · 柴尔德', 'Julia Child', '美国 · 1912–2004', 'USA · 1912–2004'),
  ('warren_buffett', '沃伦 · 巴菲特', 'Warren Buffett', '美国 · 1930–', 'USA · b. 1930'),
  ('katsushika_hokusai', '葛饰北斋', 'Katsushika Hokusai', '日本 · 1760–1849', 'Japan · 1760–1849'),
  ('nelson_mandela', '纳尔逊 · 曼德拉', 'Nelson Mandela', '南非 · 1918–2013', 'South Africa · 1918–2013');

INSERT INTO public.historical_life_events (
  event_key, person_key, stage, domains, tags, signal, curated_rank,
  situation_zh, situation_en, tension_zh, tension_en,
  choice_zh, choice_en, borrow_zh, borrow_en, dont_copy_zh, dont_copy_en
) VALUES
  ('malala', 'malala_yousafzai', 'learning_self', ARRAY['study','body_mind','career']::text[], ARRAY['self_expression_risk','learning_stance','health_constraint']::text[], 'opportunity', 1, '少女时期，她想继续上学，而她的家乡正处在剥夺女孩受教育权利的压力之下。', 'As a teenager she wanted to keep going to school in a region where girls'' education was under threat.', '个人安全与继续发声之间的取舍；家庭愿望与外部危险的拉扯。', 'The pull between personal safety and continuing to speak up; between family hope and external danger.', '在遇袭后仍继续为女孩受教育权发声，代价是不能回到熟悉的故乡生活。', 'She kept speaking for girls'' schooling after being attacked — the cost was not returning to the life she knew.', '把「继续学习」当作一种立场，而不仅是一件任务。', 'Treat ''continuing to learn'' as a stance, not just a task.', '不必把每一次发声都放到公共舞台，安全与私域也是选择。', 'You don''t have to put every voice on a public stage — safety and privacy are also choices.'),
  ('franklin_teen', 'benjamin_franklin', 'learning_self', ARRAY['study','career']::text[], ARRAY['learning_stance']::text[], 'opportunity', 2, '少年学徒时期，他没有正规学校教育，只能在印刷所和自学中拼出知识。', 'As a young apprentice with no formal schooling, he pieced together learning inside a print shop and by teaching himself.', '现实生计与自我教育之间的时间分配。', 'Splitting limited time between earning a living and self-education.', '把每天的碎片时间转成阅读、抄写与练习，长期积累。', 'Turned fragments of each day into reading, copying and practice, compounding over years.', '把「今天多学一点」变成小到不容易破戒的习惯。', 'Make ''a little more today'' a habit small enough that you rarely break it.', '他的时代节奏与今天不同；不必用他的量表苛责自己。', 'His century''s tempo is not ours — don''t beat yourself with his yardstick.'),
  ('curie_young', 'marie_curie', 'learning_self', ARRAY['study','career']::text[], ARRAY['learning_stance','late_start']::text[], 'opportunity', 3, '青年时期她想学科学，但当时的波兰不接受女性进入大学。', 'As a young woman she wanted to study science, but universities in her homeland did not admit women at the time.', '留在家乡与追求学术之间的取舍。', 'Staying near family versus leaving to pursue a scientific education.', '远赴巴黎求学，长期节衣缩食，只为进入一间自己想要的教室。', 'Moved to Paris and lived very frugally for years to sit in the classroom she wanted.', '如果本地的门关着，就找一间开着的门，即使要走远一点。', 'If the local door is closed, find one that''s open — even if you have to travel to reach it.', '不必用透支健康换机会，她后期也曾为此付出代价。', 'You don''t have to trade your health for opportunity — she paid a real cost for that later.'),
  ('jobs_20s', 'steve_jobs', 'early_adulthood', ARRAY['career','study']::text[], ARRAY['career_transition','self_expression_risk']::text[], 'opportunity', 1, '他从大学退学，靠在附近旁听感兴趣的课，尤其是书法课。', 'He dropped out of college but kept auditing classes that interested him, notably calligraphy.', '看似「无用」的兴趣与「应该」的正轨之间的选择。', '''Useless'' interest versus the expected straight path.', '允许自己走非典型路径，把兴趣长期存着，等未来自己去连接。', 'Allowed himself an atypical path, saving interests to be connected later.', '现在无法预测的连接，很多年后可能才成型；先允许自己感兴趣。', 'Connections you can''t predict now often show up years later — first, allow yourself to be curious.', '不必把「退学」浪漫化，路径是他的，不是普遍处方。', 'Don''t romanticise dropping out — his path was his, not a universal prescription.'),
  ('murasaki', 'murasaki_shikibu', 'early_adulthood', ARRAY['career','love']::text[], ARRAY['self_expression_risk','relationship_boundary']::text[], 'neutral', 3, '早年守寡后，她进入宫廷成为女官，在有限的活动空间里持续写作。', 'Widowed young, she entered court service as a lady-in-waiting and kept writing within a narrow social space.', '现实处境（阶层、性别、身份）与内在创作愿望之间的落差。', 'The gap between her real constraints (class, gender, role) and her inner creative drive.', '利用宫廷生活的观察与自由时段坚持写作，完成《源氏物语》。', 'Used what freedom court life did give her — observation and quiet hours — to sustain the work that became The Tale of Genji.', '空间不完美，也可以有真实的产出。', 'An imperfect space can still produce real work.', '她的处境是历史性的，不必美化限制本身。', 'Her constraints were historical — don''t romanticise the limits themselves.'),
  ('franklin_20s', 'benjamin_franklin', 'early_adulthood', ARRAY['career','finance']::text[], ARRAY['career_transition','financial_rebuild']::text[], 'opportunity', 2, '20 多岁离开熟悉的城市，在费城开始新的印刷生意。', 'In his twenties he left the city he knew and started a printing business in Philadelphia.', '稳定的旧路径与在陌生城市重新建立信誉之间的选择。', 'The stable known path versus rebuilding a reputation in a new city.', '选择重新开始，专注于建立信誉和小社群，而不是一夜成功。', 'Chose the restart, focusing on trust and a small community rather than quick success.', '早期最重要的资产是别人愿意把小事交给你。', 'Your most important early asset is other people willing to hand you small things.', '不必模仿他的行业或时代节奏，只借用「先建立信任」的顺序。', 'Don''t copy the trade or century — borrow the order: trust before scale.'),
  ('abe_lawyer', 'abraham_lincoln', 'building_life', ARRAY['career','body_mind']::text[], ARRAY['career_transition','learning_stance']::text[], 'neutral', 1, '在成为总统前，他多年做地方律师，往返各县出差，收入起伏。', 'Before the presidency he practised circuit law for years, travelling between counties with an uneven income.', '看似不够耀眼的日常工作与内在使命感之间的张力。', 'Everyday work that didn''t feel grand versus a growing sense of larger calling.', '把日常案件做扎实，同时长期阅读、写作与思考公共问题。', 'Did the ordinary casework well while reading, writing and thinking about public issues on the side.', '看似平淡的几年，往往是后来能承担更大责任的地基。', 'The years that feel plain are often the foundation for the bigger work later.', '不必等待「大时代召唤」；也不必因未被召唤而否定自己。', 'Don''t wait for a ''moment of history'' — and don''t invalidate yourself if it never arrives.'),
  ('curie_marriage', 'marie_curie', 'building_life', ARRAY['career','love']::text[], ARRAY['career_family_conflict','health_constraint']::text[], 'pressure', 3, '与配偶皮埃尔在极其简陋的实验室里坚持研究放射性。', 'She and her partner Pierre pushed on with radioactivity research in a very bare lab.', '家庭责任、经济压力与长期研究之间的持续拉扯。', 'Ongoing pull between family, money pressure and long-term research.', '把工作与亲密关系放在同一节奏里，而不是让其中一个吃掉另一个。', 'Kept work and partnership on the same rhythm instead of letting one swallow the other.', '重要的关系值得进入你日程表的「已锁定」部分。', 'Important relationships deserve to be in the ''already locked'' part of your calendar.', '别把长期透支健康看作研究者的必需，那是她的代价，不是配方。', 'Don''t treat long-term health depletion as a scientist''s badge — that was her cost, not a recipe.'),
  ('kahlo', 'frida_kahlo', 'building_life', ARRAY['body_mind','love','career']::text[], ARRAY['physical_pain_creation','health_constraint','career_family_conflict']::text[], 'pressure', 2, '严重车祸后长期身体疼痛，同时经营高强度的婚姻和艺术生涯。', 'Long-term physical pain after a serious accident, alongside an intense marriage and art career.', '身体极限、亲密关系风暴与创作愿望三者之间的分配。', 'Body limits, a stormy relationship, and creative drive competing for the same energy.', '把痛苦本身变成作品的材料，而不是等到「身体好起来」才创作。', 'Turned the pain itself into material for the work — did not wait to be ''well'' before creating.', '允许自己在不完美的身体状态里继续创造与生活。', 'Allow yourself to keep creating and living inside an imperfect body.', '不必美化痛苦或忽视医疗，她的选择是她的，不是普遍处方。', 'Don''t romanticise pain or refuse care — her choices were hers, not a prescription for anyone else.'),
  ('gauguin', 'paul_gauguin', 'midlife_reassessment', ARRAY['career','finance','love']::text[], ARRAY['career_transition','career_family_conflict','financial_rebuild']::text[], 'pressure', 3, '35 岁前后，他从股票经纪人的职业转向全职绘画。', 'Around 35, he left a stockbroker career to paint full-time.', '家庭经济稳定与个人艺术使命之间的巨大取舍。', 'Family financial stability versus personal artistic calling.', '选择转向艺术，代价是家庭关系与经济的长期动荡。', 'Chose art — at the cost of long-term strain on family and finances.', '中年重估时，「你真正想为什么承担代价」是一个必须问的问题。', 'At midlife, ''what am I actually willing to pay a price for?'' is a question you have to ask.', '他把代价大部分转嫁到了家人身上，这不是一个可以复制的答案。', 'He passed most of that cost onto his family — that isn''t a template to reuse.'),
  ('junghmid', 'carl_jung', 'midlife_reassessment', ARRAY['career','body_mind']::text[], ARRAY['midlife_withdrawal','career_transition']::text[], 'neutral', 1, '在与弗洛伊德决裂后，他进入长期的自我探索期，暂时退出主流学术。', 'After breaking with Freud he entered a long period of self-inquiry, stepping back from mainstream academia.', '既有名声与内心不能再回避的问题之间的冲突。', 'Existing reputation versus questions he could no longer avoid inside himself.', '允许自己「退一段」，把这段时间用于内在梳理与写作。', 'Allowed himself a long ''withdrawal'', using it for inner work and writing.', '中年时，允许自己「什么都不产出」的一段时间，可能是最重要的产出。', 'In midlife, letting yourself ''produce nothing'' for a while can be the most important output.', '不必模仿他的隐居时长；每个人的复原时间尺度不同。', 'Don''t copy the length — everyone''s recovery scale is different.'),
  ('julia_child', 'julia_child', 'midlife_reassessment', ARRAY['career','study']::text[], ARRAY['late_start','career_transition']::text[], 'opportunity', 2, '她在近 40 岁时才开始认真学做菜，最终在 50 岁前后靠这门手艺成名。', 'She only began learning to cook seriously in her late 30s and became known for it around age 50.', '「起步太晚」的社会叙事与内在对某件事持续兴趣之间的冲突。', 'The ''too late to start'' social story versus a real, lasting interest.', '无视「太晚」的评价，长期专注在一件她真的享受的手艺上。', 'Ignored the ''too late'' verdict and stayed with a craft she actually enjoyed.', '「太晚」通常是别人给你的判词，不是事实。', '''Too late'' is usually someone else''s verdict, not a fact.', '不必把她的曝光路径当作成就的必要条件。', 'Her public profile isn''t a required part of doing what you love.'),
  ('buffett', 'warren_buffett', 'maturity_legacy', ARRAY['finance','career']::text[], ARRAY['legacy_handoff','wealth_distribution']::text[], 'opportunity', 1, '多年在公开场合承诺将大部分财富捐出，并逐步安排传承。', 'Has publicly committed to giving away most of his wealth and gradually arranged succession.', '个人对下一代的期待与「不留下太多」的价值观之间的平衡。', 'Personal hopes for the next generation versus the value that ''not leaving too much'' matters.', '把「留什么、留给谁、什么时候留」当作长期而具体的工作。', 'Treats ''what to leave, to whom, and when'' as an ongoing, concrete piece of work.', '传承不是终点的一次动作，而是提前很多年就开始的一系列小决定。', 'Passing things on isn''t a single moment — it''s a series of small decisions started years earlier.', '不必以他的资产规模为参照；每个人的传承尺度不同。', 'Don''t measure by his wealth scale — legacy comes in every size.'),
  ('hokusai', 'katsushika_hokusai', 'maturity_legacy', ARRAY['career','study']::text[], ARRAY['elder_growth','late_start']::text[], 'opportunity', 2, '70 多岁仍在创作代表作，一生反复修改自己的作品和署名。', 'Still creating major work in his 70s, repeatedly refining his art and even his signature over his life.', '年龄给身体的限制与仍未完成的手艺之间的冲突。', 'The body''s limits versus a craft that still felt unfinished.', '在晚年继续把标准往前推，把「还没完成」当作动力而非焦虑。', 'Kept raising his standard late in life, treating ''not yet finished'' as fuel rather than anxiety.', '允许自己晚年仍在成长，不必用「差不多了」结束自己。', 'Let yourself keep growing late — you don''t have to end yourself with ''that''s about enough''.', '他的高强度并非普遍适用，休息也是尊重身体。', 'His intensity isn''t universal — rest is also respect for the body.'),
  ('mandela_later', 'nelson_mandela', 'maturity_legacy', ARRAY['career','love']::text[], ARRAY['legacy_handoff','delegation_handoff']::text[], 'neutral', 3, '在漫长的公共角色之后，他晚年主动淡出，把舞台交给下一代。', 'After a very long public role, he stepped back later in life and handed the stage to a next generation.', '外界仍希望他继续在前台，而他选择让出位置。', 'The public still wanted him at the front; he chose to make room for others.', '把「让位」本身当作一项负责任的传承工作。', 'Treated stepping back as itself a responsible act of legacy.', '退到后台，也可以是一种主动的成就。', 'Stepping back can itself be a deliberate achievement.', '不必以他的舞台尺度衡量自己；传承在小尺度上同样重要。', 'Don''t measure by his scale — legacy at any size matters.');

INSERT INTO public.historical_sources (person_key, event_key, kind, title, url, license, is_primary) VALUES
  ('malala_yousafzai', NULL, 'biography', 'Wikipedia', 'https://en.wikipedia.org/wiki/Malala_Yousafzai', 'CC BY-SA 4.0', true),
  ('benjamin_franklin', NULL, 'biography', 'Wikipedia', 'https://en.wikipedia.org/wiki/Benjamin_Franklin', 'CC BY-SA 4.0', true),
  ('marie_curie', NULL, 'biography', 'Wikipedia', 'https://en.wikipedia.org/wiki/Marie_Curie', 'CC BY-SA 4.0', true),
  ('steve_jobs', NULL, 'biography', 'Wikipedia', 'https://en.wikipedia.org/wiki/Steve_Jobs', 'CC BY-SA 4.0', true),
  ('murasaki_shikibu', NULL, 'biography', 'Wikipedia', 'https://en.wikipedia.org/wiki/Murasaki_Shikibu', 'CC BY-SA 4.0', true),
  ('abraham_lincoln', NULL, 'biography', 'Wikipedia', 'https://en.wikipedia.org/wiki/Abraham_Lincoln', 'CC BY-SA 4.0', true),
  ('frida_kahlo', NULL, 'biography', 'Wikipedia', 'https://en.wikipedia.org/wiki/Frida_Kahlo', 'CC BY-SA 4.0', true),
  ('paul_gauguin', NULL, 'biography', 'Wikipedia', 'https://en.wikipedia.org/wiki/Paul_Gauguin', 'CC BY-SA 4.0', true),
  ('carl_jung', NULL, 'biography', 'Wikipedia', 'https://en.wikipedia.org/wiki/Carl_Jung', 'CC BY-SA 4.0', true),
  ('julia_child', NULL, 'biography', 'Wikipedia', 'https://en.wikipedia.org/wiki/Julia_Child', 'CC BY-SA 4.0', true),
  ('warren_buffett', NULL, 'biography', 'Wikipedia', 'https://en.wikipedia.org/wiki/Warren_Buffett', 'CC BY-SA 4.0', true),
  ('katsushika_hokusai', NULL, 'biography', 'Wikipedia', 'https://en.wikipedia.org/wiki/Hokusai', 'CC BY-SA 4.0', true),
  ('nelson_mandela', NULL, 'biography', 'Wikipedia', 'https://en.wikipedia.org/wiki/Nelson_Mandela', 'CC BY-SA 4.0', true);
