/**
 * Fun Library · 16 hand-written personality entries.
 *
 * Codes: [M|L][E|T][A|C][F|O]
 *   M Map / L Lantern
 *   E Editor / T Traveler
 *   A Annotation / C Co-reading
 *   F Finality / O Open-ending
 *
 * Entries never leak axis letters to users. This file is the ONLY
 * source of truth for result copy; scoring.ts never invents text.
 */

export type TypeEntry = {
  code: string;
  name: { zh: string; en: string };
  literaryTitle: { zh: string; en: string };
  abstractTitle: { zh: string; en: string };
  howYouRead: { zh: string; en: string };
  moments: {
    decision: { zh: string; en: string };
    relations: { zh: string; en: string };
    change: { zh: string; en: string };
  };
  oftenMisread: { zh: string; en: string };
  gentleAdvice: { zh: string; en: string };
  coRead: [string, string];
  misRead: [string, string];
};

const E = (zh: string, en: string) => ({ zh, en });

export const TYPE_CATALOG: Record<string, TypeEntry> = {
  MEAF: {
    code: "MEAF",
    name: E("总编辑", "The Chief Editor"),
    literaryTitle: E("《先把地图折出折痕，才敢出门的人》", "The One Who Creases the Map Before Ever Stepping Out"),
    abstractTitle: E("《在自己脑内开了三年选题会的人》", "Three Years of Editorial Meetings, All Inside One Head"),
    howYouRead: E(
      "你把世界当成一份可以修订的手稿：先建立结构、再决定收录哪一段。",
      "You treat the world as a manuscript to edit — structure first, then decide what stays.",
    ),
    moments: {
      decision: E("会先列条件清单，再挑一条走。", "You list the criteria before choosing a path."),
      relations: E("愿意为亲近的人默默做审校，但不太说出口。", "You quietly proofread for the people you love, and rarely say so."),
      change: E("变化来时，你想先把新旧版本对齐。", "When change hits, you first align the old and new versions in your head."),
    },
    oftenMisread: E("被当作控制欲强，其实你只是害怕交出未修订的稿子。", "Mistaken for controlling; you just fear releasing an unedited draft."),
    gentleAdvice: E("允许自己交出一版“未定稿”，也允许别人不按你的目录读。", "Let one draft out unfinished; let others read out of order."),
    coRead: ["LTAF", "MTCF"],
    misRead: ["LTCO", "LEAO"],
  },
  MEAO: {
    code: "MEAO",
    name: E("藏书策展人", "The Curator"),
    literaryTitle: E("《把展签写得比展品还长的人》", "The One Whose Labels Outgrow the Exhibits"),
    abstractTitle: E("《收藏了很多可能性，最后一个都没打开的人》", "Collects Many Possibilities, Opens None"),
    howYouRead: E(
      "你会为每种未来预留一格书架，谁也不肯先关掉。",
      "You reserve a shelf slot for every possible future and refuse to close any first.",
    ),
    moments: {
      decision: E("你更擅长比较方案，而不是签字。", "Better at comparing options than at signing off."),
      relations: E("你在心里给每个人写了长长的注解。", "You keep long private annotations on every person."),
      change: E("换阶段时会先整理旧笔记，才愿意翻新章。", "You reorganize old notes before starting the new chapter."),
    },
    oftenMisread: E("看起来犹豫，其实你在维护一整套目录。", "Looks like hesitation; it's you maintaining a whole catalog."),
    gentleAdvice: E("挑一格暂时空着，也是一种收藏。", "Leaving one shelf empty is also a form of collecting."),
    coRead: ["LTCF", "MTAO"],
    misRead: ["LECF", "LEAF"],
  },
  MECF: {
    code: "MECF",
    name: E("圆桌会议主席", "The Round-Table Chair"),
    literaryTitle: E("《一个人的决定要先开会通知三个人的人》", "Who Consults Three People Before Deciding Alone"),
    abstractTitle: E("《嘴上说“大家怎么想都行”，心里已经写好会议纪要的人》", "Says \"whatever you all think\" — with minutes already drafted"),
    howYouRead: E(
      "你先把关系里的位置摆清楚，再决定往哪走。",
      "You place everyone in the room first, then decide direction.",
    ),
    moments: {
      decision: E("你在寻求共识里获得确定感。", "Consensus is where you find certainty."),
      relations: E("你是那个把每个人的想法都记住的人。", "You are the one who remembers what everyone said."),
      change: E("变化来时你会先问：谁受影响？", "Change arrives; your first question is \"who is affected?\""),
    },
    oftenMisread: E("被误认为太在意别人，其实你在为所有人搭稳桌子。", "Mistaken for people-pleasing; you are steadying the whole table."),
    gentleAdvice: E("有些决定不必等所有人的书签都插进来。", "Some decisions can be made before every bookmark is placed."),
    coRead: ["LTAO", "MTCF"],
    misRead: ["LTAF", "LECO"],
  },
  MECO: {
    code: "MECO",
    name: E("圈子编织者", "The Circle Weaver"),
    literaryTitle: E("《把每一次告别都留个联系方式的人》", "Who Trades a Way to Stay in Touch at Every Goodbye"),
    abstractTitle: E("《朋友圈里的每根线都亲手打了结的人》", "Every Thread in the Room Personally Knotted"),
    howYouRead: E(
      "你以关系为线，把可能性一根根织起来。",
      "You weave possibility together with relationships as the thread.",
    ),
    moments: {
      decision: E("你决定的第一步是叫齐相关的人。", "Step one of any decision: gather the relevant people."),
      relations: E("你会记住每个人的下一次生日。", "You remember everyone's next birthday."),
      change: E("大事发生时，你先联络人，再想计划。", "When something big happens you call people before making a plan."),
    },
    oftenMisread: E("被误以为随和，其实你在暗中调度整个系统。", "Read as easygoing; you are quietly orchestrating everything."),
    gentleAdvice: E("允许自己独自坐一整晚，不用连线所有人。", "Allow yourself one whole evening off the group chat."),
    coRead: ["LTAO", "LTCO"],
    misRead: ["MEAF", "LEAF"],
  },
  LTCF: {
    code: "LTCF",
    name: E("持照探险队长", "The Licensed Expedition Lead"),
    literaryTitle: E("《攻略收藏一百篇，出门依然靠直觉的人》", "A Hundred Guides Bookmarked, Still Trusting Instinct at the Door"),
    abstractTitle: E("《把不确定装订成册，再一页一页翻的人》", "Binds Uncertainty into a Book to Read Page by Page"),
    howYouRead: E(
      "你凭感觉出发，带着朋友一起收尾。",
      "You leave on instinct and land the ending with people around you.",
    ),
    moments: {
      decision: E("你在小圈子里拍板，讲究收得住。", "You call the shot inside a small circle and insist it lands."),
      relations: E("你信任那几个能一起收尾的人。", "You trust the few who can help close a thing."),
      change: E("变化让你先叫齐几个人再定案。", "Change makes you gather a few people before signing off."),
    },
    oftenMisread: E("被误会犹豫，其实你在等能一起定的人到齐。", "Read as hesitant; you're waiting for the co-signers."),
    gentleAdvice: E("有些事一个人先落笔，也不会失礼。", "Signing something alone isn't a discourtesy."),
    coRead: ["MEAO", "LECO"],
    misRead: ["MEAF", "MECF"],
  },
  LTCO: {
    code: "LTCO",
    name: E("行脚制图师", "The Wandering Cartographer"),
    literaryTitle: E("《一边走一边画地图的人》", "The One Who Draws the Map While Walking It"),
    abstractTitle: E("《行李箱里塞满未拆封计划的人》", "A Suitcase of Unopened Plans"),
    howYouRead: E(
      "你凭感觉走，也随手把一路上遇到的人拉进故事。",
      "You go by feel and quietly pull in whoever you meet along the way.",
    ),
    moments: {
      decision: E("你不急着定，让故事再多一页。", "You don't rush; let the story hold one more page."),
      relations: E("你在旅途里认识人，也慢慢淡出。", "You meet people on the road, and fade out gently."),
      change: E("变化让你兴奋，你会立刻叫上人一起。", "Change excites you; you'll call someone along at once."),
    },
    oftenMisread: E("被以为漂泊，其实你随手把身边的人也带上了地图。", "Read as drifting; you're quietly writing others onto the map."),
    gentleAdvice: E("给自己保留几条不再重画的路。", "Keep a few routes you refuse to redraw."),
    coRead: ["LEAF", "MECO"],
    misRead: ["MEAF", "LECF"],
  },
  MTAF: {
    code: "MTAF",
    name: E("独行标本师", "The Solo Specimen-Maker"),
    literaryTitle: E("《把回忆一件一件贴上标签的人》", "Who Labels Memories One by One"),
    abstractTitle: E("《嘴上说随缘，心里已经做完三套预案的人》", "Says \"whatever comes\" — quietly finishing plan A, B, and C"),
    howYouRead: E(
      "你要看清全貌才安心，一个人也能把结论钉稳。",
      "You need the whole picture to be at ease — and can pin down a conclusion alone.",
    ),
    moments: {
      decision: E("你在独处的房间里把决定敲定。", "You finalize decisions in a room by yourself."),
      relations: E("你在别人开口前就想清了。", "You've thought it through before anyone speaks."),
      change: E("变化到来时你先关门，再重整目录。", "You close the door before reindexing everything."),
    },
    oftenMisread: E("被以为固执，其实你只是提前写好了结论。", "Read as stubborn; the conclusion was written in advance."),
    gentleAdvice: E("试着把过程也拿出来晒一晒。", "Try airing the process, not just the conclusion."),
    coRead: ["LECO", "MEAF"],
    misRead: ["LTCO", "MECO"],
  },
  MTAO: {
    code: "MTAO",
    name: E("边缘制图人", "The Margin Cartographer"),
    literaryTitle: E("《只在别人不看的角落做记号的人》", "Marks Only the Corners Nobody Watches"),
    abstractTitle: E("《同一页可以看一整年的人》", "Can Stay on One Page for a Whole Year"),
    howYouRead: E(
      "你安静地绘制自己的地图，允许它长期没有终点。",
      "You draw your own map in silence — and let it stay endless.",
    ),
    moments: {
      decision: E("你不着急拍板；你等地形自己说话。", "You don't rush the gavel; you let the terrain speak."),
      relations: E("你更相信长期的旁观胜过一次表白。", "You trust long observation over a single declaration."),
      change: E("变化来了，你先把它翻译成自己的语言。", "When change comes, you translate it into your own dialect first."),
    },
    oftenMisread: E("被以为疏离，其实你正在慢慢注解一切。", "Read as distant; you are slowly annotating everything."),
    gentleAdvice: E("偶尔把一页递到别人手上，不用附说明。", "Sometimes hand one page over with no footnote."),
    coRead: ["LECF", "MEAO"],
    misRead: ["LECO", "MECF"],
  },
  MTCF: {
    code: "MTCF",
    name: E("桌角说书人", "The Table-Corner Storyteller"),
    literaryTitle: E("《把每一次误会都收集起来说给下一个人听的人》", "Who Collects Every Misunderstanding to Tell the Next Person"),
    abstractTitle: E("《在一群人里也在画自己那张地图的人》", "Drawing a Private Map Even in a Crowd"),
    howYouRead: E(
      "你在关系中辨认位置，但结论要自己下。",
      "You locate yourself through others — and still write the conclusion yourself.",
    ),
    moments: {
      decision: E("你听完所有人，再一个人拍板。", "You hear everyone out, then decide alone."),
      relations: E("你在人群里像书里那个记事者。", "In a crowd you are the chronicler."),
      change: E("变化让你想召集一次“定案会议”。", "Change makes you want to call a decision meeting."),
    },
    oftenMisread: E("被当成中立观察者，其实你早有立场。", "Read as a neutral observer; your stance was already set."),
    gentleAdvice: E("试着不做那个盖章的人，也没关系。", "You don't always have to be the one stamping it final."),
    coRead: ["LTAO", "MEAF"],
    misRead: ["LECF", "LTAF"],
  },
  MTCO: {
    code: "MTCO",
    name: E("客厅里的地图人", "The Living-Room Map-Keeper"),
    literaryTitle: E("《在朋友聊天时偷偷记下坐标的人》", "Who Quietly Notes Coordinates While Friends Chat"),
    abstractTitle: E("《收藏别人故事却从不轻易结尾的人》", "Hoards Others' Stories and Refuses to End Any"),
    howYouRead: E(
      "你在关系里辨认方向，让所有人保留续写的权利。",
      "You navigate through relations, and let every one of them keep the right to continue.",
    ),
    moments: {
      decision: E("你倾向不定死结论，好让未来有空档。", "You avoid hard closure so the future keeps room."),
      relations: E("朋友的每一次转折你都记得。", "You remember every friend's plot twist."),
      change: E("变化让你先联系旧朋友再动身。", "You call an old friend before making a move."),
    },
    oftenMisread: E("看起来慢，其实你在等一张更完整的地图。", "Reads as slow; you're waiting for a more complete map."),
    gentleAdvice: E("允许一件小事今晚就写下句号。", "Let one small thing end tonight."),
    coRead: ["MEAO", "LECO"],
    misRead: ["MEAF", "LTCF"],
  },
  LEAF: {
    code: "LEAF",
    name: E("孤灯抄写员", "The Lamp-Lit Scribe"),
    literaryTitle: E("《所有火光都要亲手关掉才睡的人》", "Who Puts Out Every Candle by Hand Before Sleep"),
    abstractTitle: E("《把直觉一条一条写成条例的人》", "Turns Every Hunch into a Bylaw"),
    howYouRead: E(
      "你顺着感觉找到线索，然后一个人把它编成秩序。",
      "You follow a feeling to its clue, then quietly forge it into order.",
    ),
    moments: {
      decision: E("你先感受，再动手立规。", "Feel first; codify second."),
      relations: E("你在独处里生成清晰的立场。", "Solitude is where your stance sharpens."),
      change: E("变化让你想把感觉先写下来。", "Change makes you want to write the feeling down first."),
    },
    oftenMisread: E("看起来严肃，其实你先被一束光带过来。", "Reads as stern; a single beam brought you here."),
    gentleAdvice: E("给灵感一点晚一点的截稿。", "Give inspiration a later deadline than usual."),
    coRead: ["MTCO", "MEAF"],
    misRead: ["MTAO", "MECO"],
  },
  LEAO: {
    code: "LEAO",
    name: E("感应制图师", "The Intuitive Cartographer"),
    literaryTitle: E("《跟着风走完一半，才回头画路线的人》", "Follows the Wind Halfway, Then Draws the Route"),
    abstractTitle: E("《一半清单，一半直觉的人》", "Half Checklist, Half Instinct"),
    howYouRead: E(
      "你相信第一感，也相信自己可以整理它。",
      "You trust the first instinct and trust yourself to organize it.",
    ),
    moments: {
      decision: E("你留一半空白给临场调整。", "You leave half the page blank for on-the-spot edits."),
      relations: E("你独自捕捉信号，再决定亲近谁。", "You catch signals alone; only then decide who to move close to."),
      change: E("变化到来时你不急着关门。", "You don't rush to close any door."),
    },
    oftenMisread: E("被以为随意，其实你有一整套私人秩序。", "Read as casual; you have an entire private order."),
    gentleAdvice: E("有时说出你的直觉，不需要立刻讲清楚。", "Sometimes say the hunch out loud without explaining it."),
    coRead: ["MTCF", "MTAO"],
    misRead: ["MECF", "MECO"],
  },
  LECF: {
    code: "LECF",
    name: E("篝火中间的人", "The One at the Bonfire's Center"),
    literaryTitle: E("《所有故事的接梗人的人》", "The One Who Always Picks Up the Thread"),
    abstractTitle: E("《一堆人里最能替沉默的人翻页的人》", "The One Who Turns the Page for Whoever's Silent"),
    howYouRead: E(
      "你在人群里点燃直觉，用一个决定收束气氛。",
      "You strike intuition in a crowd, then settle the mood with one call.",
    ),
    moments: {
      decision: E("你会主动叫暂停，帮大家收尾。", "You call the pause and help everyone land."),
      relations: E("你敏感于他人的一句沉默。", "One person's silence never escapes you."),
      change: E("变化中你像那个先鼓掌的人。", "In change, you are the first to clap."),
    },
    oftenMisread: E("被误为热情表演，其实你在悄悄读空气。", "Mistaken for showmanship; you are reading the room."),
    gentleAdvice: E("允许别人自己接下一句。", "Let others land their own sentences sometimes."),
    coRead: ["MTAO", "MTAF"],
    misRead: ["MTCF", "MTCO"],
  },
  LECO: {
    code: "LECO",
    name: E("夜谈灯泡", "The Late-Night Lightbulb"),
    literaryTitle: E("《能陪人聊完凌晨最后一件事的人》", "Who Can Stay Up Through the Very Last Thing"),
    abstractTitle: E("《相信任何话题都还有下一页的人》", "Believes Every Topic Still Has One More Page"),
    howYouRead: E(
      "你借由感受和关系去认识世界，且愿意让它一直没完。",
      "You know the world through feeling and people, and let it stay unfinished.",
    ),
    moments: {
      decision: E("你不介意决定被明天再改一次。", "You don't mind if the decision gets revised tomorrow."),
      relations: E("你的房间总是给别人多一把椅子。", "There is always an extra chair in your room."),
      change: E("变化让你想拉一个人一起走进去。", "Change makes you want to walk into it with someone."),
    },
    oftenMisread: E("被以为漫无边际，其实你在照顾整段关系。", "Read as aimless; you are tending the whole relationship."),
    gentleAdvice: E("有些夜可以早点熄灯。", "Some nights the lamp can go off early."),
    coRead: ["MTAF", "MTAO"],
    misRead: ["MEAF", "MTCF"],
  },
  LTAF: {
    code: "LTAF",
    name: E("暗室独舞者", "The Dark-Room Soloist"),
    literaryTitle: E("《一个人先跳完再决定给谁看的人》", "Dances Alone First, Then Decides Whom to Show"),
    abstractTitle: E("《靠直觉走完一整条路，回头才写标题的人》", "Walks the Path on Instinct, Titles It Only in Hindsight"),
    howYouRead: E(
      "你独自听自己的感觉走，直到写下终章。",
      "You follow your own signal alone, all the way to the final chapter.",
    ),
    moments: {
      decision: E("你的决定像深夜写完的一页稿。", "Your decisions feel like a page written late at night."),
      relations: E("你倾向亲近少数人，而且专注。", "You bond with a few, and bond fully."),
      change: E("变化让你更沉默，然后突然定案。", "Change makes you quieter, then abruptly decisive."),
    },
    oftenMisread: E("被以为冷淡，其实你把火苗留给了自己。", "Read as cold; you kept the flame for yourself."),
    gentleAdvice: E("给别人看一次没写完的稿，也不会烧掉你。", "Show an unfinished draft; it won't burn you."),
    coRead: ["MEAF", "MECO"],
    misRead: ["MECF", "LECO"],
  },
  LTAO: {
    code: "LTAO",
    name: E("窗前守夜人", "The Window Watcher"),
    literaryTitle: E("《总在等下一场雨的人》", "The One Who Is Always Waiting for the Next Rain"),
    abstractTitle: E("《书签插了半本，也不打算翻完的人》", "Bookmark at the Middle, No Plan to Finish"),
    howYouRead: E(
      "你安静地跟着感觉走，愿意让所有事都保有下一页。",
      "You follow feeling in silence, letting every thing keep its next page.",
    ),
    moments: {
      decision: E("你更愿意选择“暂缓”而非“中止”。", "You'd rather pause than terminate."),
      relations: E("你倾向长时间独处，也很珍惜偶然的连接。", "Long solitudes, tender chance encounters."),
      change: E("变化让你想搬到窗边，多看一会儿。", "Change makes you sit closer to the window."),
    },
    oftenMisread: E("被以为退缩，其实你在慢慢确认光的方向。", "Read as retreating; you are slowly confirming the light."),
    gentleAdvice: E("有时把窗打开，让别人也进来一会儿。", "Open the window; let someone in for a while."),
    coRead: ["MECF", "MECO"],
    misRead: ["MEAF", "MTCF"],
  },
};

export function getTypeEntry(code: string): TypeEntry {
  return TYPE_CATALOG[code] ?? TYPE_CATALOG["MEAF"];
}

export const ALL_TYPE_CODES: string[] = Object.keys(TYPE_CATALOG);
