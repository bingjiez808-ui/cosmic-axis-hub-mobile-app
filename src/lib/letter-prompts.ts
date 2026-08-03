import type { Lang } from "@/lib/i18n";

import type { LetterTopic } from "@/lib/i18n-community-hall";

/**
 * Starter prompts for the writing desk. Each entry gives a suggested subject
 * line plus an opening paragraph the traveler can click to drop straight into
 * the letter, so an empty page never blocks the first question.
 */
export type LetterPrompt = {
  subject: { zh: string; en: string };
  body: { zh: string; en: string };
};

const PROMPTS: Record<LetterTopic, LetterPrompt[]> = {
  study: [
    {
      subject: { zh: "我该继续读下去，还是先去工作？", en: "Keep studying, or start working?" },
      body: {
        zh: "我正在犹豫要不要继续读书。身边的人给的建议完全相反，我怕自己选错了就再也回不了头。你当时是怎么判断这件事值不值得再等几年的？",
        en: "I'm torn about whether to keep studying. Everyone around me gives opposite advice, and I'm scared that the wrong choice can't be undone. How did you decide whether waiting a few more years was worth it?",
      },
    },
    {
      subject: { zh: "努力了很久，成绩还是不动", en: "I work hard and nothing moves" },
      body: {
        zh: "我已经很努力了，但结果一直没有变好。我开始怀疑自己是不是根本不适合这条路。你有过这种“怎么用力都没有回响”的阶段吗？后来是怎么走出来的？",
        en: "I've been trying hard, but the results don't move. I've started to wonder if I'm simply not made for this path. Did you ever have a season where effort got no echo? How did it end?",
      },
    },
    {
      subject: { zh: "专业选错了怎么办", en: "What if I chose the wrong major" },
      body: {
        zh: "读了两年才发现自己并不喜欢这个方向，但换掉的代价很大。我想知道，那些和自己专业无关的人生，后来都过成什么样了？",
        en: "Two years in, I realise I don't like this field, but switching costs a lot. I want to know how life turned out for people who ended up far from what they studied.",
      },
    },
    {
      subject: { zh: "我很怕让家里失望", en: "I'm afraid of disappointing my family" },
      body: {
        zh: "我的选择和家里的期待不一样。每次要开口都很难。你当年有没有做过让家人失望的决定？现在回头看，你后悔吗？",
        en: "My choices don't match what my family expects, and speaking up is hard every time. Did you ever make a decision that disappointed them? Looking back now, do you regret it?",
      },
    },
    {
      subject: { zh: "同龄人好像都比我快", en: "Everyone my age seems faster" },
      body: {
        zh: "我总觉得别人都在往前走，只有我停在原地。这种比较让我很难专注在自己的事情上。你是从什么时候开始不再和别人比进度的？",
        en: "It feels like everyone is moving forward except me, and the comparison makes it hard to focus on my own work. When did you stop measuring your pace against others?",
      },
    },
    {
      subject: { zh: "毕业前最该做的一件事", en: "The one thing to do before graduating" },
      body: {
        zh: "还有一年就毕业了，我不想浪费这段时间。如果能回到毕业前，你最想让当时的自己去做哪一件事？为什么是它？",
        en: "I graduate in a year and don't want to waste it. If you could return to your final year, what one thing would you tell yourself to do, and why that one?",
      },
    },
  ],
  career: [
    {
      subject: { zh: "要不要离开这份稳定的工作", en: "Should I leave a stable job" },
      body: {
        zh: "现在的工作很稳定，但我每天都提不起劲。想走又怕后悔。你有没有做过类似的决定？做完之后最真实的感受是什么？",
        en: "My job is stable but I wake up flat every day. I want to leave and I'm scared to regret it. Did you make a decision like this? What did it actually feel like afterwards?",
      },
    },
    {
      subject: { zh: "我是不是入错了行", en: "Did I pick the wrong industry" },
      body: {
        zh: "做了几年之后，我越来越怀疑这个行业适不适合我。转行意味着从头再来。你会怎么判断“该忍一忍”和“该止损”的分界线？",
        en: "After a few years I keep doubting whether this industry suits me, and switching means starting over. How would you tell the difference between holding on and cutting losses?",
      },
    },
    {
      subject: { zh: "被同事和上级消耗得很累", en: "Worn down by the people at work" },
      body: {
        zh: "工作本身还好，但人际关系让我很疲惫。我不知道该改变自己还是换个环境。你后来是怎么和职场里的人相处的？",
        en: "The work itself is fine, but the relationships exhaust me. I can't tell whether to change myself or change the place. How did you learn to handle people at work?",
      },
    },
    {
      subject: { zh: "钱和喜欢，只能选一个吗", en: "Money or meaning — must I pick one" },
      body: {
        zh: "一份给得多但没意思，一份喜欢但收入低。我一直在两者之间摇摆。你当初是怎么选的？后来这个选择带来了什么？",
        en: "One offer pays well and bores me; the other I love and it pays little. I keep swinging between them. How did you choose, and what did the choice bring later?",
      },
    },
    {
      subject: { zh: "三十岁之后还来得及重来吗", en: "Is it too late to restart after 30" },
      body: {
        zh: "我担心自己已经过了可以试错的年纪。想听听真正在这个年纪重新开始过的人，后来过得怎么样。",
        en: "I worry I'm past the age where trying and failing is allowed. I'd like to hear from someone who actually started over at this age — how did it go?",
      },
    },
    {
      subject: { zh: "我没有所谓的热爱怎么办", en: "What if I have no passion" },
      body: {
        zh: "大家都说要找到热爱的事，可我好像什么都不特别喜欢。没有热爱的人生，是不是也可以过得好？你是怎么过的？",
        en: "Everyone says to find your passion, but nothing feels special to me. Can a life without a calling still be a good one? How did yours go?",
      },
    },
  ],
  love: [
    {
      subject: { zh: "我该继续等他改变吗", en: "Should I keep waiting for them to change" },
      body: {
        zh: "这段关系里有很多让我不舒服的地方，但我一直觉得再等等也许会好。你怎么判断一段关系是值得继续，还是该放手？",
        en: "There's a lot in this relationship that hurts, yet I keep believing it might get better. How do you tell whether a relationship deserves more time or an ending?",
      },
    },
    {
      subject: { zh: "分手之后我一直走不出来", en: "I can't get past the breakup" },
      body: {
        zh: "已经过去很久了，我还是会想起他。我不知道这样正常吗，也不知道要多久才会好。你是怎么熬过那段时间的？",
        en: "It's been a long time and I still think of them. I don't know if that's normal or how long it takes. How did you get through that stretch?",
      },
    },
    {
      subject: { zh: "一个人也可以吗", en: "Is being alone also fine" },
      body: {
        zh: "我并不着急恋爱，但周围的声音让我怀疑自己是不是有问题。你身边有一直单身、也过得很好的人吗？他们的生活是什么样的？",
        en: "I'm not in a hurry to date, but the voices around me make me wonder if something's wrong with me. Do you know people who stayed single and lived well? What was their life like?",
      },
    },
    {
      subject: { zh: "要不要为了他改变自己的规划", en: "Should I change my plans for them" },
      body: {
        zh: "如果在一起，我可能要放弃现在的城市和工作。我怕将来会怪自己，也怕错过这个人。你遇到过这样的取舍吗？",
        en: "Staying together may mean giving up my city and my job. I'm afraid of blaming myself later, and afraid of losing this person. Did you ever face this trade?",
      },
    },
    {
      subject: { zh: "怎么知道这个人可不可靠", en: "How do you know someone is safe" },
      body: {
        zh: "我总是很容易相信别人，又常常受伤。有没有一些你后来才明白的信号，是当时应该注意的？",
        en: "I trust people easily and get hurt often. Were there signs you only understood later, that you wish you'd noticed at the time?",
      },
    },
    {
      subject: { zh: "关系里的争吵越来越多", en: "We fight more and more" },
      body: {
        zh: "我们并不是不爱，但每次沟通都会变成争吵。你们后来是怎么找到相处方式的？还是说，有些差距真的过不去？",
        en: "It's not that we don't love each other, but every talk turns into a fight. How did you find a way to live together — or are some gaps simply too wide?",
      },
    },
  ],
  boundaries: [
    {
      subject: { zh: "我不会拒绝别人", en: "I can't say no" },
      body: {
        zh: "我总是答应自己其实不想做的事，事后又后悔。你是从什么时候开始学会拒绝的？第一次拒绝时发生了什么？",
        en: "I keep agreeing to things I don't want to do and regret it afterwards. When did you learn to say no, and what happened the first time you did?",
      },
    },
    {
      subject: { zh: "朋友越来越少，是我的问题吗", en: "My friendships are thinning out" },
      body: {
        zh: "长大之后联系的人越来越少，我不确定这是自然的，还是我出了问题。你这个年纪身边还剩下多少人？",
        en: "The older I get, the fewer people I talk to. I can't tell if that's natural or a problem with me. How many people are still around you at your age?",
      },
    },
    {
      subject: { zh: "怎么处理让我不舒服的亲近关系", en: "Handling closeness that hurts" },
      body: {
        zh: "有个人对我很好，但相处时我总觉得压抑。我不知道该怎么开口，也怕伤人。你会怎么处理这种关系？",
        en: "Someone treats me well, yet I feel suffocated around them. I don't know how to speak up without hurting them. How would you handle it?",
      },
    },
    {
      subject: { zh: "被人辜负之后还敢信任吗", en: "Trusting again after betrayal" },
      body: {
        zh: "被很信任的人伤过一次之后，我很难再敞开。你后来还愿意重新相信别人吗？是什么让你愿意的？",
        en: "After someone I trusted hurt me, I can't open up. Did you ever trust again? What made that possible?",
      },
    },
    {
      subject: { zh: "总在意别人怎么看我", en: "I care too much what people think" },
      body: {
        zh: "别人一句话我能想很久，很累。你是什么时候开始不那么在意别人的评价的？有什么事情促成了这个变化？",
        en: "One remark can occupy me for days and it's exhausting. When did other people's opinions start to weigh less on you, and what caused the shift?",
      },
    },
    {
      subject: { zh: "该不该和一段关系断掉", en: "Should I end this relationship" },
      body: {
        zh: "有段关系已经消耗我很久了，但断掉又觉得可惜。你有没有真正切断过一段关系？后来后悔过吗？",
        en: "A relationship has drained me for a long time, yet cutting it feels like a waste. Have you ever truly ended one? Did you regret it?",
      },
    },
  ],
  family: [
    {
      subject: { zh: "我和父母永远说不通", en: "My parents and I never understand each other" },
      body: {
        zh: "每次谈到我的生活，最后都会不欢而散。我想维持关系，又不想被安排。你后来是怎么和父母相处的？",
        en: "Every conversation about my life ends badly. I want to keep the relationship without being managed. How did you end up relating to your parents?",
      },
    },
    {
      subject: { zh: "要不要回到家乡", en: "Should I move back home" },
      body: {
        zh: "在外面很累，回去又怕失去现在的一切。你做过类似的决定吗？回去或留下之后，生活变成了什么样？",
        en: "Life away is exhausting, but going back may cost everything I've built. Did you face this? What did life become after you stayed or returned?",
      },
    },
    {
      subject: { zh: "照顾家人让我喘不过气", en: "Caring for family is crushing me" },
      body: {
        zh: "家里需要我，但我也快撑不住了。我不敢说累，因为好像没有人可以替我。你是怎么撑过来的？",
        en: "My family needs me and I'm nearly out of strength. I can't admit I'm tired because no one can take my place. How did you carry it?",
      },
    },
    {
      subject: { zh: "要不要生小孩", en: "Should I have a child" },
      body: {
        zh: "我一直不确定自己想不想要孩子，也听不到真实的声音。如果可以重来，你会做同样的选择吗？",
        en: "I've never been sure whether I want children, and honest answers are hard to find. If you could choose again, would you choose the same?",
      },
    },
    {
      subject: { zh: "父母老了，我很害怕", en: "My parents are ageing and I'm scared" },
      body: {
        zh: "我开始意识到时间不多了，但每次见面还是会吵。你有没有和家人和解过？是怎么开始的？",
        en: "I've started to feel the time running out, yet we still argue when we meet. Did you ever make peace with your family? How did it begin?",
      },
    },
    {
      subject: { zh: "我想过和家庭不一样的人生", en: "I want a different life than my family's" },
      body: {
        zh: "我的人生方向和家里的期望完全不同。我怕被当成不孝，也怕对不起自己。你怎么在两者之间找平衡？",
        en: "The life I want looks nothing like what my family imagined. I fear being called ungrateful and fear betraying myself. How did you balance the two?",
      },
    },
  ],
  money: [
    {
      subject: { zh: "我总是很焦虑钱的事", en: "Money keeps me anxious" },
      body: {
        zh: "就算收入还可以，我还是每天担心钱不够。这种不安到底会不会消失？你现在还会为钱焦虑吗？",
        en: "Even when my income is fine, I worry daily that it isn't enough. Does that unease ever go away? Do you still worry about money now?",
      },
    },
    {
      subject: { zh: "要不要背上这笔债", en: "Should I take on this debt" },
      body: {
        zh: "为了房子/学业，我可能要背很多年的债。我算不清这笔账值不值。你有过类似的决定吗？现在怎么看？",
        en: "For a home or for school, I may carry debt for years. I can't work out whether it's worth it. Did you make a similar call, and how do you see it now?",
      },
    },
    {
      subject: { zh: "赚多少才算够", en: "How much is enough" },
      body: {
        zh: "我一直在往前追，却从来没有觉得够。你后来找到那个“够”的标准了吗？它是什么样的？",
        en: "I keep chasing more and never feel it's enough. Did you ever find your own line of 'enough'? What does it look like?",
      },
    },
    {
      subject: { zh: "为了赚钱牺牲健康值得吗", en: "Trading health for money" },
      body: {
        zh: "这几年我用身体换收入，现在开始有点后果。你有过类似的阶段吗？后来是怎么调整的？",
        en: "For years I traded my body for income, and it's catching up. Did you have that phase? How did you adjust afterwards?",
      },
    },
    {
      subject: { zh: "帮不帮家里的忙", en: "Should I bail out my family" },
      body: {
        zh: "家人需要钱，我给了会影响自己的计划，不给又过不去心里那关。你遇到过吗？怎么处理的？",
        en: "My family needs money; giving it derails my plans, refusing eats at me. Did you face this, and what did you do?",
      },
    },
    {
      subject: { zh: "关于钱，你最晚才明白的事", en: "What you learned about money too late" },
      body: {
        zh: "如果只能告诉现在的我一句关于钱的实话，你会说什么？最好是你自己吃过亏才明白的那种。",
        en: "If you could tell me one honest thing about money, what would it be? Ideally something you only learned by losing.",
      },
    },
  ],
  self: [
    {
      subject: { zh: "我好像不知道自己想要什么", en: "I don't know what I want" },
      body: {
        zh: "我按部就班地走到现在，却越来越不清楚自己想要什么样的生活。你是在什么时候、因为什么，开始知道答案的？",
        en: "I followed the steps and arrived here, less sure than ever what life I want. When and how did the answer start to arrive for you?",
      },
    },
    {
      subject: { zh: "这个阶段是不是都会这么迷茫", en: "Is this fog normal at my age" },
      body: {
        zh: "我现在的状态说不上坏，但一直提不起劲。想知道你在我这个年纪是什么样的，后来发生了什么变化？",
        en: "Nothing is wrong exactly, but nothing lifts me either. What were you like at my age, and what changed afterwards?",
      },
    },
    {
      subject: { zh: "我怕这辈子就这样了", en: "I'm afraid this is all there is" },
      body: {
        zh: "我常常觉得人生已经定型，剩下的只是重复。你有过这种感觉吗？后来有什么事情打破了它？",
        en: "I often feel my life is already set and the rest is repetition. Did you feel that? Did anything ever break it?",
      },
    },
    {
      subject: { zh: "怎么和过去的自己和解", en: "Making peace with my past self" },
      body: {
        zh: "有些事我一直没能原谅自己。时间真的能解决吗？还是需要我主动做点什么？",
        en: "There are things I still can't forgive myself for. Does time really handle it, or does it take something deliberate?",
      },
    },
    {
      subject: { zh: "重要的决定要怎么做", en: "How do you make big decisions" },
      body: {
        zh: "面对大的选择我总是拖延，怕选错。你做重大决定时，最后靠的是什么？直觉、条件，还是别的？",
        en: "I stall on big choices, afraid of picking wrong. When you decided something major, what did you finally rely on — instinct, conditions, or something else?",
      },
    },
    {
      subject: { zh: "回头看，什么才是真正重要的", en: "Looking back, what actually mattered" },
      body: {
        zh: "现在困扰我的事，可能十年后根本不算什么。从你现在的位置回头看，哪些事真的重要，哪些其实不必在意？",
        en: "What troubles me now may mean nothing in ten years. From where you stand, what truly mattered, and what turned out not to?",
      },
    },
  ],
  other: [
    {
      subject: { zh: "我说不清自己在困惑什么", en: "I can't name what's wrong" },
      body: {
        zh: "我没有具体的问题，只是长期有一种说不出的沉重。如果你也经历过这种状态，想听听你当时是怎么过日子的。",
        en: "I have no specific problem, just a heaviness I can't name. If you've been in that state, I'd like to know how you got through your days.",
      },
    },
    {
      subject: { zh: "关于失去，我想问一个问题", en: "A question about loss" },
      body: {
        zh: "我失去了一个很重要的人/事，到现在还没缓过来。想问问真正走过这段路的人，后来的日子是什么样的？",
        en: "I lost something that mattered deeply and haven't recovered. I want to ask someone who truly walked this road: what did the days after look like?",
      },
    },
    {
      subject: { zh: "身体出问题之后，生活怎么继续", en: "Life after the body breaks" },
      body: {
        zh: "健康出了一些状况，我的计划全被打乱了。你有过类似的经历吗？后来是怎么重新安排生活的？",
        en: "My health went sideways and every plan collapsed. Did you go through something similar, and how did you rebuild your days?",
      },
    },
    {
      subject: { zh: "在陌生的城市重新开始", en: "Starting over in a strange city" },
      body: {
        zh: "我刚到一个没有熟人的地方，什么都要重来。你有过从零开始的时候吗？最难的是哪一段？",
        en: "I've landed somewhere I know no one and must rebuild everything. Have you started from zero? Which part was hardest?",
      },
    },
    {
      subject: { zh: "想听一件让你撑下去的小事", en: "One small thing that kept you going" },
      body: {
        zh: "不需要什么大道理。只想知道，在最难的时候，有什么很小的事情让你决定再走一天？",
        en: "No grand lessons needed. In your hardest time, what small thing made you decide to walk one more day?",
      },
    },
    {
      subject: { zh: "如果能给我一句忠告", en: "If you could give me one piece of advice" },
      body: {
        zh: "你不认识我，也不需要照顾我的情绪。如果只能说一句真话给现在的我，你会说什么？",
        en: "You don't know me and don't have to spare my feelings. If you could say one true thing to me right now, what would it be?",
      },
    },
  ],
};

export function letterPromptsFor(topic: string, lang: Lang) {
  const list = PROMPTS[(topic as LetterTopic) in PROMPTS ? (topic as LetterTopic) : "other"];
  return list.map((p) => ({
    subject: lang === "zh" ? p.subject.zh : p.subject.en,
    body: lang === "zh" ? p.body.zh : p.body.en,
  }));
}

export type ResolvedPrompt = ReturnType<typeof letterPromptsFor>[number];
