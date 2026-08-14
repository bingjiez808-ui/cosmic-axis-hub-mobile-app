import { createFileRoute } from "@tanstack/react-router";
import { Handshake } from "lucide-react";

import { AppSectionPreview } from "@/components/AppSectionPreview";
import { useLang } from "@/lib/i18n";
import { useSupabaseSession } from "@/lib/session";

export const Route = createFileRoute("/bonds")({
  head: () => ({
    meta: [
      { title: "关系 · 命运书房 App" },
      { name: "description", content: "关系分区预览：好友、关系便签、安全控制与适配分析。" },
    ],
  }),
  component: BondsPreviewPage,
});

function BondsPreviewPage() {
  const { lang } = useLang();
  const { user } = useSupabaseSession();
  const zh = lang === "zh";
  const signedIn = Boolean(user);
  const items = [
    {
      label: zh ? "好友邀请" : "Friend invites",
      value: zh
        ? "通过邀请码建立关系档案，后续可以做关系记录、适配分析和便签。"
        : "Use invite codes to create relationship records for notes and compatibility.",
    },
    {
      label: zh ? "关系便签" : "Bond notes",
      value: zh
        ? "记录相处中的提醒、误会、修复点和想说但还没说的话。"
        : "Keep reminders, misunderstandings, repair points and unsaid thoughts.",
    },
    {
      label: zh ? "适配分析" : "Compatibility",
      value: zh
        ? "两张命盘或匿名匹配池，查看吸引点、摩擦点和边界建议。"
        : "Compare two charts or anonymous pools for attraction, friction and boundaries.",
    },
    {
      label: zh ? "安全控制" : "Safety controls",
      value: zh
        ? "屏蔽、举报、同意门槛和通知，保证社交功能可控。"
        : "Block, report, consent gates and notifications keep social use controlled.",
    },
  ];

  return (
    <AppSectionPreview
      icon={Handshake}
      eyebrow={zh ? "关系" : "Bonds"}
      title={zh ? "把重要关系，放进一册可回看的记录。" : "Keep important bonds in a shelf you can revisit."}
      body={zh
        ? "好友、便签、适配和边界提醒，会和命盘一起形成长期关系档案。"
        : "Friends, notes, compatibility and boundaries form a long-term relationship record."}
      image="/assets/app-home/report-preview-app.png"
      items={items}
      primaryLabel={signedIn ? (zh ? "进入关系" : "Open Bonds") : (zh ? "登录进入关系" : "Login to Bonds")}
      primaryTo={signedIn ? "/me/friends" : "/auth"}
      primarySearch={signedIn ? undefined : ({ redirect: "/me/friends" } as never)}
      secondaryLabel={zh ? "查看适配" : "Match"}
      secondaryTo={signedIn ? "/me/match" : "/auth"}
      secondarySearch={signedIn ? undefined : ({ redirect: "/me/match" } as never)}
    />
  );
}
