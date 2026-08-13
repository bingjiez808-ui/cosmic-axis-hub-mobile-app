import{o as e,t}from"./jsx-runtime-CZcjcDnw.js";import{t as n}from"./react-DQyofxZ5.js";import{t as r}from"./link-Bg5PrUxj.js";import{n as i}from"./i18n-D-zD_9kn.js";import{t as a}from"./chevron-right-EFKsxsf9.js";import{t as o}from"./scroll-text-Be5ZQ0Kh.js";import{t as s}from"./wand-sparkles-Bzbf_kJ3.js";import{C as c,O as l,T as u,k as d,x as f}from"./index-tGtqY6kT.js";var p=e(n()),m=t();function h(){let{lang:e}=i(),t=e===`zh`,n=new Intl.DateTimeFormat(t?`zh-CN`:`en-US`,{month:`short`,day:`numeric`,weekday:`short`}).format(new Date),h=(0,p.useMemo)(()=>t?[{key:`choice`,label:`选择`,question:`我现在最需要看清什么？`,hint:`适合事业、学业、迁移和阶段转折`,glow:`rgba(251,191,36,0.42)`,star:`34%`},{key:`wealth`,label:`财富`,question:`我的安全感从哪里来？`,hint:`看资源方式、风险偏好和长期积累`,glow:`rgba(94,234,212,0.34)`,star:`48%`},{key:`bond`,label:`关系`,question:`这段关系为什么反复出现？`,hint:`看吸引模式、边界感和亲密课题`,glow:`rgba(252,211,77,0.36)`,star:`62%`}]:[{key:`choice`,label:`Choice`,question:`What do I need to see clearly now?`,hint:`For career, study, moves and turning points`,glow:`rgba(251,191,36,0.42)`,star:`34%`},{key:`wealth`,label:`Wealth`,question:`Where does my security come from?`,hint:`Resources, risk style and long-term growth`,glow:`rgba(94,234,212,0.34)`,star:`48%`},{key:`bond`,label:`Bond`,question:`Why does this pattern repeat?`,hint:`Attraction, boundaries and intimacy lessons`,glow:`rgba(252,211,77,0.36)`,star:`62%`}],[t]),[g,_]=(0,p.useState)(0),v=h[g]??h[0];(0,p.useEffect)(()=>{let e=window.setInterval(()=>{_(e=>(e+1)%h.length)},4200);return()=>window.clearInterval(e)},[h.length]);let y=[{icon:l,title:t?`建立第一份命盘`:`Build your chart`,body:t?`先选择问题，再填写出生资料；报告会按你的问题优先排列。`:`Choose a question, then enter birth data. The report follows your priority.`,to:`/ritual`,search:{returnTo:`/report`},primary:!0},{icon:d,title:t?`进入今日阅读`:`Today reading`,body:t?`查看今日主线、行动提醒和七日节奏。`:`Daily thread, action cue and 7-day rhythm.`,to:`/today`},{icon:c,title:t?`探索命运通识馆`:`Life Studies`,body:t?`用数学、文学、地理、物理、经济、生物六种语言理解自己。`:`Read yourself through six knowledge halls.`,to:`/life-studies`},{icon:u,title:t?`前往众生之厅`:`Hall of Beings`,body:t?`写信、收信、看公共信墙，和相似人生阶段的人互相回应。`:`Write, receive and read anonymous letters.`,to:`/community`}];return(0,m.jsxs)(`main`,{className:`min-h-screen bg-[#04050a] text-amber-50`,children:[(0,m.jsxs)(`div`,{className:`mx-auto flex min-h-screen w-full max-w-[430px] flex-col overflow-hidden bg-[#080910] shadow-[0_0_80px_rgba(0,0,0,0.45)]`,children:[(0,m.jsxs)(`header`,{className:`sticky top-0 z-30 border-b border-amber-300/10 bg-[#080910]/82 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-xl`,children:[(0,m.jsxs)(`div`,{className:`mb-3 flex items-center justify-between text-[11px] text-amber-100/55`,children:[(0,m.jsx)(`span`,{children:n}),(0,m.jsx)(`span`,{className:`rounded-full border border-amber-300/18 bg-amber-300/8 px-2 py-0.5 text-amber-100/75`,children:t?`导览台`:`Guide Desk`})]}),(0,m.jsxs)(`div`,{className:`flex items-center justify-between gap-3`,children:[(0,m.jsxs)(`div`,{className:`min-w-0`,children:[(0,m.jsx)(`p`,{className:`text-[10px] uppercase tracking-[0.24em] text-amber-300/65`,children:t?`命运图书馆`:`Destiny Library`}),(0,m.jsx)(`h1`,{className:`mt-1 text-2xl font-semibold tracking-normal text-amber-50`,children:t?`今晚从哪一扇门开始？`:`Which door tonight?`})]}),(0,m.jsx)(r,{to:`/me`,"aria-label":t?`读者证`:`Reader pass`,className:`grid h-11 w-11 shrink-0 place-items-center rounded-full border border-teal-300/25 bg-teal-300/10 text-teal-100 transition active:scale-95`,children:(0,m.jsx)(f,{"aria-hidden":!0,className:`h-5 w-5`})})]})]}),(0,m.jsxs)(`div`,{className:`flex-1 space-y-4 overflow-y-auto px-4 pb-28 pt-4`,children:[(0,m.jsxs)(`section`,{className:`app-hero relative min-h-[min(72svh,570px)] overflow-hidden rounded-[34px] border border-white/10 bg-[#0d0e12] shadow-[0_34px_96px_-50px_rgba(251,191,36,0.62)]`,style:{"--guide-glow":v.glow,"--guide-star":v.star},children:[(0,m.jsx)(`div`,{className:`absolute inset-0 overflow-hidden`,children:(0,m.jsx)(`img`,{src:`/assets/app-home/library-guide-desk.png`,alt:``,className:`app-hero-img absolute inset-0 h-full w-full object-cover object-[50%_42%] opacity-100`})}),(0,m.jsx)(`div`,{className:`absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.04)_0%,rgba(0,0,0,0)_42%,rgba(0,0,0,0.14)_68%,rgba(4,5,10,0.58)_100%)]`}),(0,m.jsx)(`div`,{className:`absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-t from-[#05060a]/82 via-[#05060a]/22 to-transparent`}),(0,m.jsx)(`div`,{className:`app-hero-scan pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-amber-200/10 via-transparent to-transparent`}),(0,m.jsx)(`div`,{className:`app-choice-glow pointer-events-none absolute inset-0`}),(0,m.jsx)(`div`,{className:`app-hero-dust pointer-events-none absolute inset-0 opacity-70`}),(0,m.jsx)(`div`,{className:`pointer-events-none absolute left-1/2 top-[34%] h-52 w-52 -translate-x-1/2 rounded-full border border-amber-200/14 app-orbit`}),(0,m.jsx)(`div`,{className:`pointer-events-none absolute left-1/2 top-[36%] h-32 w-32 -translate-x-1/2 rounded-full border border-teal-200/12 app-orbit-reverse`}),(0,m.jsx)(`div`,{className:`app-guide-line pointer-events-none absolute left-[18%] right-[18%] top-[42%] h-px origin-center bg-gradient-to-r from-transparent via-amber-200/44 to-transparent`}),(0,m.jsx)(`div`,{className:`app-pulse-star pointer-events-none absolute top-[35%] h-2 w-2 rounded-full bg-amber-200/90 shadow-[0_0_26px_9px_var(--guide-glow)]`}),(0,m.jsxs)(`div`,{className:`absolute left-4 top-4 flex items-center gap-2 rounded-full border border-white/12 bg-black/32 px-3 py-1.5 text-[11px] text-amber-50 shadow-[0_12px_30px_-18px_rgba(251,191,36,0.9)] backdrop-blur-xl`,children:[(0,m.jsx)(o,{"aria-hidden":!0,className:`h-3.5 w-3.5 text-amber-300`}),t?`馆员导览`:`Librarian guide`]}),(0,m.jsx)(`div`,{className:`absolute right-4 top-4 rounded-full border border-teal-200/20 bg-teal-300/10 px-3 py-1.5 text-[11px] text-teal-100/85 backdrop-blur-xl`,children:t?`今夜开放`:`Open tonight`}),(0,m.jsx)(`div`,{className:`absolute bottom-0 left-0 right-0 p-4`,children:(0,m.jsxs)(`div`,{className:`app-hero-copy space-y-3`,children:[(0,m.jsxs)(`div`,{className:`max-w-[285px]`,children:[(0,m.jsx)(`span`,{className:`inline-flex items-center rounded-full border border-amber-200/18 bg-amber-100/10 px-3 py-1 text-[11px] text-amber-50/82 backdrop-blur-xl`,children:t?`先问，再读`:`Ask first`}),(0,m.jsx)(`h2`,{className:`mt-2 text-[1.92rem] font-semibold leading-[1.06] tracking-normal text-amber-50 drop-shadow-[0_4px_18px_rgba(0,0,0,0.72)]`,children:t?`把今晚的问题，交给导览台。`:`Hand tonight's question to the desk.`})]}),(0,m.jsxs)(`div`,{className:`app-question-ticket rounded-[26px] border border-white/18 bg-white/[0.13] p-3 shadow-[0_18px_44px_-28px_rgba(0,0,0,0.95)] backdrop-blur-xl`,children:[(0,m.jsxs)(`div`,{className:`flex items-center justify-between gap-3`,children:[(0,m.jsxs)(`div`,{className:`min-w-0`,children:[(0,m.jsx)(`p`,{className:`text-[11px] text-amber-100/58`,children:t?`今晚先回答`:`Start with`}),(0,m.jsx)(`p`,{className:`mt-1 truncate text-[15px] font-medium text-amber-50`,children:v.question}),(0,m.jsx)(`p`,{className:`mt-1 truncate text-xs text-amber-100/55`,children:v.hint})]}),(0,m.jsx)(r,{to:`/ritual`,search:{returnTo:`/report`},"aria-label":t?`进入仪式`:`Begin ritual`,className:`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-200 text-[#111016] transition active:translate-x-0.5 active:scale-95`,children:(0,m.jsx)(a,{"aria-hidden":!0,className:`h-5 w-5`})})]}),(0,m.jsx)(`div`,{className:`mt-3 flex gap-2`,children:h.map((e,t)=>(0,m.jsx)(`button`,{type:`button`,onClick:e=>{_(t)},className:`app-question-slip rounded-full border px-3 py-1 text-[11px] transition active:scale-95 ${g===t?`border-amber-200/44 bg-amber-100/18 text-amber-50`:`border-white/10 bg-black/16 text-amber-50/68`}`,style:{"--chip-delay":`${t*80}ms`},children:e.label},e.key))})]}),(0,m.jsxs)(r,{to:`/ritual`,search:{returnTo:`/report`},className:`app-primary-cta flex min-h-13 items-center justify-between rounded-full bg-gradient-to-r from-amber-100 via-amber-200 to-amber-400 px-5 py-3.5 text-[15px] font-semibold text-[#111016] shadow-[0_18px_38px_-24px_rgba(251,191,36,0.95)] transition active:scale-[0.98]`,children:[t?`进入导览仪式`:`Begin the guide ritual`,(0,m.jsx)(s,{"aria-hidden":!0,className:`h-5 w-5`})]})]})})]}),(0,m.jsxs)(`section`,{className:`rounded-[30px] border border-white/10 bg-white/[0.035] p-3`,children:[(0,m.jsxs)(`div`,{className:`mb-3 flex items-center justify-between px-1`,children:[(0,m.jsx)(`h2`,{className:`text-sm font-medium text-amber-100`,children:t?`馆藏抽屉`:`Catalog drawer`}),(0,m.jsx)(`span`,{className:`text-xs text-amber-100/45`,children:t?`滑动选择`:`Swipe`})]}),(0,m.jsx)(`div`,{className:`flex snap-x gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`,children:y.map(e=>(0,m.jsxs)(r,{to:e.to,search:e.search,className:`app-route-card group flex min-h-[150px] min-w-[158px] snap-start flex-col items-start justify-between rounded-[24px] border p-3 transition active:scale-[0.985] ${e.primary?`border-amber-300/35 bg-gradient-to-br from-amber-300/16 via-white/[0.04] to-teal-300/10 shadow-[0_18px_48px_-40px_rgba(251,191,36,0.8)]`:`border-white/10 bg-white/[0.045]`}`,children:[(0,m.jsxs)(`span`,{className:`flex w-full items-start justify-between gap-2`,children:[(0,m.jsx)(`span`,{className:`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-black/24 text-amber-200 transition group-active:scale-95`,children:(0,m.jsx)(e.icon,{"aria-hidden":!0,className:`h-5 w-5`})}),(0,m.jsx)(a,{"aria-hidden":!0,className:`h-5 w-5 shrink-0 text-amber-100/35 transition group-active:translate-x-0.5`})]}),(0,m.jsxs)(`span`,{children:[(0,m.jsx)(`span`,{className:`block text-base font-semibold leading-snug text-amber-50`,children:e.title}),(0,m.jsx)(`span`,{className:`mt-2 line-clamp-3 block text-xs leading-relaxed text-amber-100/55`,children:e.body})]})]},e.title))})]}),(0,m.jsx)(`section`,{className:`rounded-[26px] border border-teal-300/14 bg-teal-300/[0.045] p-4`,children:(0,m.jsxs)(`div`,{className:`flex items-start gap-3`,children:[(0,m.jsx)(`span`,{className:`grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-300/12 text-amber-200`,children:(0,m.jsx)(u,{"aria-hidden":!0,className:`h-5 w-5`})}),(0,m.jsxs)(`div`,{className:`min-w-0`,children:[(0,m.jsx)(`h2`,{className:`text-sm font-medium text-amber-50`,children:t?`读者证会保存你的阅读进度`:`Reader Pass saves your progress`}),(0,m.jsx)(`p`,{className:`mt-1 text-xs leading-relaxed text-amber-100/55`,children:t?`登录后，命盘、报告、通识馆书签、众生回音和会员权益都会归入你的读者证。`:`Sign in to keep charts, reports, study bookmarks, echoes and pass benefits together.`})]})]})})]})]}),(0,m.jsx)(`style`,{children:`
        @media (prefers-reduced-motion: no-preference) {
          .app-hero-img {
            animation: app-hero-kenburns 16s ease-in-out infinite alternate;
          }
          .app-hero-scan {
            animation: app-hero-scan 5.8s ease-in-out infinite;
          }
          .app-choice-glow {
            background:
              radial-gradient(circle at 50% 42%, var(--guide-glow) 0 2%, transparent 24%),
              radial-gradient(circle at var(--guide-star) 48%, rgba(255,255,255,0.18) 0 1px, transparent 2px);
            filter: blur(0.2px);
            mix-blend-mode: screen;
            opacity: 0.78;
            transition: background 420ms ease, opacity 420ms ease;
            animation: app-choice-breathe 4.2s ease-in-out infinite;
          }
          .app-hero-dust {
            background-image:
              radial-gradient(circle at 18% 28%, rgba(251, 191, 36, 0.34) 0 1px, transparent 2px),
              radial-gradient(circle at 72% 22%, rgba(94, 234, 212, 0.28) 0 1px, transparent 2px),
              radial-gradient(circle at 44% 62%, rgba(251, 191, 36, 0.3) 0 1px, transparent 2px),
              radial-gradient(circle at 82% 72%, rgba(251, 191, 36, 0.22) 0 1px, transparent 2px);
            animation: app-dust-drift 9s ease-in-out infinite alternate;
          }
          .app-orbit {
            animation: app-orbit 18s linear infinite;
          }
          .app-orbit-reverse {
            animation: app-orbit 14s linear infinite reverse;
          }
          .app-pulse-star {
            animation: app-pulse-star 4.2s ease-in-out infinite;
            left: var(--guide-star);
            transition: left 420ms ease, box-shadow 420ms ease;
          }
          .app-guide-line {
            animation: app-guide-line 3.8s ease-in-out infinite;
          }
          .app-question-slip {
            animation: app-chip-in 520ms ease both;
            animation-delay: var(--chip-delay);
          }
          .app-question-ticket {
            animation: app-ticket-in 540ms ease both;
          }
          .app-primary-cta {
            animation: app-cta-glow 3.4s ease-in-out infinite;
          }
          .app-route-card {
            animation: app-route-in 420ms ease both;
          }
          .app-route-card:nth-child(2) { animation-delay: 80ms; }
          .app-route-card:nth-child(3) { animation-delay: 160ms; }
          .app-route-card:nth-child(4) { animation-delay: 240ms; }
          @keyframes app-hero-kenburns {
            from { transform: scale(1.01) translateY(0); }
            to { transform: scale(1.045) translateY(-0.8%); }
          }
          @keyframes app-hero-scan {
            0%, 100% { transform: translateY(-40%); opacity: 0.08; }
            50% { transform: translateY(220%); opacity: 0.18; }
          }
          @keyframes app-choice-breathe {
            0%, 100% { opacity: 0.54; transform: scale(0.98); }
            50% { opacity: 0.88; transform: scale(1.02); }
          }
          @keyframes app-dust-drift {
            from { transform: translate3d(0, 0, 0); }
            to { transform: translate3d(0, -12px, 0); }
          }
          @keyframes app-orbit {
            from { transform: translateX(-50%) rotate(0deg); }
            to { transform: translateX(-50%) rotate(360deg); }
          }
          @keyframes app-pulse-star {
            0%, 100% { opacity: 0.42; transform: scale(0.88); }
            50% { opacity: 0.92; transform: scale(1.08); }
          }
          @keyframes app-guide-line {
            0%, 100% { opacity: 0.12; transform: scaleX(0.72) rotate(-2deg); }
            50% { opacity: 0.48; transform: scaleX(1) rotate(1deg); }
          }
          @keyframes app-chip-in {
            from { opacity: 0; transform: translateY(8px) scale(0.96); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes app-ticket-in {
            from { opacity: 0; transform: translateY(10px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes app-cta-glow {
            0%, 100% { box-shadow: 0 18px 38px -24px rgba(251,191,36,0.95); }
            50% { box-shadow: 0 22px 48px -22px rgba(251,191,36,1); }
          }
          @keyframes app-route-in {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
        }
      `})]})}export{h as component};