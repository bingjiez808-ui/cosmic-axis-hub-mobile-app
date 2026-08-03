// @ts-expect-error bun:test
import { describe, expect, test } from "bun:test";
import { classifyIntent } from "./intent-router";

const it = test;

describe("classifyIntent", () => {
  it("empty text falls back to emotional_support", () => {
    expect(classifyIntent("").intent).toBe("emotional_support");
    expect(classifyIntent("   ").intent).toBe("emotional_support");
  });

  it("detects crisis in zh and en, and takes precedence over destiny", () => {
    expect(classifyIntent("我最近有点想死，能看看我的命盘吗").intent).toBe("crisis");
    expect(classifyIntent("I want to die. Can you read my horoscope?").intent).toBe("crisis");
  });

  it("detects destiny reading requests before AI is called", () => {
    expect(classifyIntent("帮我看看今年的运势").intent).toBe("destiny_reading");
    expect(classifyIntent("What does my natal chart say about love?").intent).toBe(
      "destiny_reading",
    );
    expect(classifyIntent("我的紫微命盘怎么看").intent).toBe("destiny_reading");
  });

  it("detects order/payment help", () => {
    expect(classifyIntent("我的订单还没到账").intent).toBe("order_help");
    expect(classifyIntent("I want a refund on my membership").intent).toBe("order_help");
  });

  it("detects product help before AI", () => {
    expect(classifyIntent("报告怎么生成？").intent).toBe("product_help");
    expect(classifyIntent("How do I log in on iPhone?").intent).toBe("product_help");
  });

  it("detects out_of_scope requests (coding, translation, trivia)", () => {
    expect(classifyIntent("帮我写一段 python 排序代码").intent).toBe("out_of_scope");
    expect(classifyIntent("Translate this to Japanese for me").intent).toBe("out_of_scope");
    expect(classifyIntent("What is the weather forecast in Tokyo?").intent).toBe("out_of_scope");
  });

  it("falls back to emotional_support for vague venting", () => {
    expect(classifyIntent("今天有点累，什么都不想做").intent).toBe("emotional_support");
    expect(classifyIntent("I'm feeling really lonely tonight").intent).toBe("emotional_support");
  });

  it("order beats product when both present", () => {
    expect(classifyIntent("我付款失败了，登录页面还报错").intent).toBe("order_help");
  });
});
