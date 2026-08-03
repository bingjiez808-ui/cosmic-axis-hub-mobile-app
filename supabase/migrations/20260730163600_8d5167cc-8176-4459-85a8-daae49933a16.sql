-- ── Batch C: cold-start library samples + onboarding ─────────────

ALTER TABLE public.community_profiles
  ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;

CREATE TABLE IF NOT EXISTS public.community_sample_echoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_id uuid NOT NULL REFERENCES public.community_letters(id) ON DELETE CASCADE,
  body text NOT NULL,
  echo_age_band text NOT NULL,
  position integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_sample_echoes_band_chk CHECK (
    echo_age_band = ANY (ARRAY['18-22','23-29','30-39','40-49','50-59','60+'])),
  CONSTRAINT community_sample_echoes_len_chk CHECK (length(body) BETWEEN 10 AND 3000)
);

GRANT SELECT ON public.community_sample_echoes TO authenticated;
GRANT ALL ON public.community_sample_echoes TO service_role;

ALTER TABLE public.community_sample_echoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "community_sample_echoes_select" ON public.community_sample_echoes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.community_letters l
     WHERE l.id = community_sample_echoes.letter_id
       AND l.content_origin = 'library_sample'
       AND l.status = 'approved'
       AND l.published_at IS NOT NULL));

CREATE INDEX IF NOT EXISTS community_sample_echoes_letter_idx
  ON public.community_sample_echoes (letter_id, position);

DROP TRIGGER IF EXISTS community_sample_echoes_touch ON public.community_sample_echoes;
CREATE TRIGGER community_sample_echoes_touch
  BEFORE UPDATE ON public.community_sample_echoes
  FOR EACH ROW EXECUTE FUNCTION public.community_touch_updated_at();

-- ── seed: transparent library samples (zh + en) ──────────────────
DO $seed$
DECLARE _id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.community_letters WHERE content_origin = 'library_sample') THEN
    RETURN;
  END IF;

  -- zh 1
  INSERT INTO public.community_letters
    (subject, body, topic, target_age_band, response_style, language, visibility, status, content_origin, published_at, expires_at)
  VALUES ('毕业前夜，我不知道该选哪条路',
    E'我今年二十二岁，还有一个月毕业。家里希望我回去考编，导师希望我留在实验室，而我自己只知道两个方向都让我害怕。\n我怕选错了就再也回不了头，也怕一直不选，时间就替我选了。\n想问问走过这一段路的人：当年你是怎么决定的？后来后悔过吗？',
    'career', '30-39', 'gentle', 'zh', 'published', 'approved', 'library_sample', now(), now() + interval '3650 days')
  RETURNING id INTO _id;
  INSERT INTO public.community_sample_echoes (letter_id, body, echo_age_band, position) VALUES
    (_id, E'我三十六岁了。当年也在两条路之间站了很久，最后随手选了一条，后来又换了两次。\n想告诉你的是：路是可以改的，但时间不能停。先选一个能让你三个月内学到东西的方向，走走看，不必把它当作一生的答案。', '30-39', 1),
    (_id, E'我五十岁。回头看，真正让我后悔的从来不是选错，而是那些因为犹豫而空掉的年份。\n你现在的害怕是对的，说明你在认真对待自己的人生。', '50-59', 2);

  -- zh 2
  INSERT INTO public.community_letters
    (subject, body, topic, target_age_band, response_style, language, visibility, status, content_origin, published_at, expires_at)
  VALUES ('我好像不太会和父母说话了',
    E'每次回家都想好好聊天，结果十分钟就变成互相挑刺。我知道他们爱我，可我们之间好像没有一种共同的语言。\n有没有人也经历过这样的阶段？后来是怎么和解的，还是就这样了？',
    'family', '40-49', 'listening', 'zh', 'published', 'approved', 'library_sample', now(), now() + interval '3650 days')
  RETURNING id INTO _id;
  INSERT INTO public.community_sample_echoes (letter_id, body, echo_age_band, position) VALUES
    (_id, E'我四十五岁，同时是女儿也是母亲。后来我发现，我们其实不需要"聊得来"，只需要一起做点什么——买菜、散步、修灯泡。\n话是在事情的缝隙里长出来的，不是硬聊出来的。', '40-49', 1);

  -- zh 3
  INSERT INTO public.community_letters
    (subject, body, topic, target_age_band, response_style, language, visibility, status, content_origin, published_at, expires_at)
  VALUES ('三十岁，我第一次承认自己很普通',
    E'同龄人开始有成绩了，而我只是勤勤恳恳地上班、还贷、照顾家里。\n我不是不甘心，只是有点空——如果一生就这样，意义在哪里？',
    'self', '50-59', 'direct', 'zh', 'published', 'approved', 'library_sample', now(), now() + interval '3650 days')
  RETURNING id INTO _id;
  INSERT INTO public.community_sample_echoes (letter_id, body, echo_age_band, position) VALUES
    (_id, E'我今年五十八。到我这个年纪你会看清一件事：所谓"普通"，是把一个家、一份工作、一些人稳稳托住的能力，这并不容易。\n意义不在别人的时间表里，它在你早上还愿意起床的那一刻。', '50-59', 1),
    (_id, E'我二十四岁，正在羡慕你说的那种稳定。我们大概都在看对方的窗户。', '18-22', 2);

  -- zh 4
  INSERT INTO public.community_letters
    (subject, body, topic, target_age_band, response_style, language, visibility, status, content_origin, published_at, expires_at)
  VALUES ('要不要为了一个人换城市',
    E'我们异地两年了。他不能走，我这边其实也有牵挂。\n我不想把决定说成牺牲，可我确实害怕过去以后，只剩下他。',
    'love', '30-39', 'gentle', 'zh', 'published', 'approved', 'library_sample', now(), now() + interval '3650 days')
  RETURNING id INTO _id;
  INSERT INTO public.community_sample_echoes (letter_id, body, echo_age_band, position) VALUES
    (_id, E'我搬过一次，也搬回来过一次。\n判断标准不是"值不值得"，而是：换过去之后，除了他，你还有没有能出门见的人、能做的事。有，就去；没有，就先造出来再去。', '30-39', 1);

  -- en 1
  INSERT INTO public.community_letters
    (subject, body, topic, target_age_band, response_style, language, visibility, status, content_origin, published_at, expires_at)
  VALUES ('One month before graduation and I still cannot choose',
    E'I am twenty-two. My family wants a safe job at home, my professor wants me in the lab, and honestly both paths frighten me.\nI am afraid that choosing wrong closes the door forever — and equally afraid that if I wait, time will choose for me.\nHow did you decide, back then? Did you regret it?',
    'career', '30-39', 'gentle', 'en', 'published', 'approved', 'library_sample', now(), now() + interval '3650 days')
  RETURNING id INTO _id;
  INSERT INTO public.community_sample_echoes (letter_id, body, echo_age_band, position) VALUES
    (_id, E'I am thirty-six. I stood at that same fork, picked almost at random, and changed twice afterwards.\nRoads can be changed; years cannot. Choose the direction that teaches you something in three months, and stop treating it as a life sentence.', '30-39', 1),
    (_id, E'I am fifty. What I regret is never a wrong turn — only the years that went empty while I hesitated.', '50-59', 2);

  -- en 2
  INSERT INTO public.community_letters
    (subject, body, topic, target_age_band, response_style, language, visibility, status, content_origin, published_at, expires_at)
  VALUES ('I do not know how to talk to my parents anymore',
    E'Every visit starts with good intentions and turns into small criticisms within ten minutes. I know they love me, yet we seem to have lost a shared language.\nDid anyone else go through this? Did it get better, or did you simply make peace with it?',
    'family', '40-49', 'listening', 'en', 'published', 'approved', 'library_sample', now(), now() + interval '3650 days')
  RETURNING id INTO _id;
  INSERT INTO public.community_sample_echoes (letter_id, body, echo_age_band, position) VALUES
    (_id, E'I am forty-five, a daughter and a mother at once. What helped was giving up on "good conversation" and doing things together instead — groceries, a walk, a broken lamp.\nWords grow in the gaps between tasks, not under a spotlight.', '40-49', 1);

  -- en 3
  INSERT INTO public.community_letters
    (subject, body, topic, target_age_band, response_style, language, visibility, status, content_origin, published_at, expires_at)
  VALUES ('At thirty I admitted that I am ordinary',
    E'People my age are collecting achievements, and I simply go to work, pay the loan, look after my family.\nIt is not resentment, only a kind of emptiness. If this is the whole of it, where is the meaning?',
    'self', '50-59', 'direct', 'en', 'published', 'approved', 'library_sample', now(), now() + interval '3650 days')
  RETURNING id INTO _id;
  INSERT INTO public.community_sample_echoes (letter_id, body, echo_age_band, position) VALUES
    (_id, E'I am fifty-eight. From here, "ordinary" looks like the rare ability to hold a household, a job and a few people steady for decades.\nMeaning is not on anyone else timetable; it is in the morning you still get up.', '50-59', 1),
    (_id, E'I am twenty-four and quietly envious of the steadiness you describe. We are probably each looking through the other window.', '18-22', 2);

  -- en 4
  INSERT INTO public.community_letters
    (subject, body, topic, target_age_band, response_style, language, visibility, status, content_origin, published_at, expires_at)
  VALUES ('Should I move cities for someone',
    E'Two years of distance. He cannot leave, and I have ties here too.\nI do not want to call the decision a sacrifice, but I am afraid that once I arrive, he will be all I have.',
    'love', '30-39', 'gentle', 'en', 'published', 'approved', 'library_sample', now(), now() + interval '3650 days')
  RETURNING id INTO _id;
  INSERT INTO public.community_sample_echoes (letter_id, body, echo_age_band, position) VALUES
    (_id, E'I moved once, and moved back once.\nThe question is not whether he is worth it, but whether — apart from him — you will have people to meet and work to do. If yes, go. If not, build that first, then go.', '30-39', 1);
END $seed$;

-- ── read model: library samples with their echoes ────────────────
CREATE OR REPLACE FUNCTION public.get_community_library_samples(_language text DEFAULT NULL, _limit integer DEFAULT 12)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(row ORDER BY row->>'publishedAt' DESC), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'letterId', l.id,
      'subject', l.subject,
      'body', l.body,
      'topic', l.topic,
      'targetAgeBand', l.target_age_band,
      'responseStyle', l.response_style,
      'language', l.language,
      'publishedAt', l.published_at,
      'echoes', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', e.id, 'body', e.body, 'ageBand', e.echo_age_band)
                         ORDER BY e.position)
          FROM public.community_sample_echoes e WHERE e.letter_id = l.id), '[]'::jsonb)
    ) AS row
      FROM public.community_letters l
     WHERE l.content_origin = 'library_sample'
       AND l.status = 'approved'
       AND l.published_at IS NOT NULL
       AND (_language IS NULL OR l.language = _language)
     ORDER BY l.published_at DESC
     LIMIT GREATEST(LEAST(COALESCE(_limit, 12), 50), 1)
  ) s;
$$;

REVOKE ALL ON FUNCTION public.get_community_library_samples(text, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_community_library_samples(text, integer) TO authenticated, service_role;

-- ── onboarding flag ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_community_onboarded()
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _at timestamptz := now();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.community_profiles (user_id, onboarded_at)
  VALUES (_uid, _at)
  ON CONFLICT (user_id) DO UPDATE SET onboarded_at = COALESCE(public.community_profiles.onboarded_at, _at);
  SELECT onboarded_at INTO _at FROM public.community_profiles WHERE user_id = _uid;
  RETURN _at;
END; $$;

REVOKE ALL ON FUNCTION public.mark_community_onboarded() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mark_community_onboarded() TO authenticated, service_role;