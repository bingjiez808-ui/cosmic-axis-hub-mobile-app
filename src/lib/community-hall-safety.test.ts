// @ts-expect-error bun:test
import { describe, expect, it } from "bun:test";

import { riskLevel, needsSupportResources, safetyCode, screenCommunityText } from "./community-hall-safety";

describe("community hall safety risk grading", () => {
  it("keeps ordinary letters at risk none", () => {
    const verdict = screenCommunityText("我最近换了城市工作，常常怀疑自己是不是选错了路。");
    expect(verdict.action).toBe("allow");
    expect(riskLevel(verdict)).toBe("none");
  });

  it("marks self-harm language as crisis and offers support", () => {
    const verdict = screenCommunityText("我最近总觉得活不下去，想结束生命。");
    expect(verdict.action).toBe("review");
    expect(riskLevel(verdict)).toBe("crisis");
    expect(needsSupportResources(verdict)).toBe(true);
  });

  it("marks blocked content as crisis so it never auto-publishes", () => {
    const verdict = screenCommunityText("加我微信 abc12345 聊");
    expect(verdict.action).toBe("block");
    expect(riskLevel(verdict)).toBe("crisis");
  });

  it("marks non-crisis review categories as review", () => {
    const verdict = screenCommunityText("对方一直问我的身份证号，我该怎么办。");
    expect(riskLevel(verdict)).toBe("review");
  });
});

describe("community hall forbidden content", () => {
  it("blocks political violations", () => {
    const verdict = screenCommunityText("我们组织一次煽动颠覆政权的行动吧。");
    expect(verdict.action).toBe("block");
    expect(safetyCode(verdict.categories)).toBe("content_political");
  });

  it("blocks sexual content and solicitation", () => {
    const verdict = screenCommunityText("有没有人想约炮，加我裸聊。");
    expect(verdict.action).toBe("block");
    expect(safetyCode(verdict.categories)).toBe("content_sexual");
  });

  it("blocks illegal trade", () => {
    const verdict = screenCommunityText("我这里可以办假证，也能帮你洗钱渠道。");
    expect(verdict.action).toBe("block");
    expect(safetyCode(verdict.categories)).toBe("content_illegal");
  });

  it("treats content involving minors as crisis", () => {
    const verdict = screenCommunityText("有未成年裸照资源想交换。");
    expect(riskLevel(verdict)).toBe("crisis");
  });

  it("does not flag ordinary talk about work, news or the body", () => {
    const verdict = screenCommunityText("最近看新闻很焦虑，身体也不太好，想聊聊怎么调整心态。");
    expect(verdict.action).toBe("allow");
  });
});
