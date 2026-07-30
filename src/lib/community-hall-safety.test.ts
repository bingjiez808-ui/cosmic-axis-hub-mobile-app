import { describe, expect, it } from "bun:test";

import { riskLevel, needsSupportResources, screenCommunityText } from "./community-hall-safety";

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
