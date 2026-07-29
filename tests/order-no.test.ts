import { describe, it, expect } from "vitest";
import {
  generateOrderNo,
  generateSubOrderNo,
  generateIdempotencyKey,
} from "../src/lib/order-no";

// ============================================================
// order-no — 纯单元测试
// ============================================================

describe("generateOrderNo", () => {
  it("生成的订单号为纯数字字符串", () => {
    const orderNo = generateOrderNo();
    expect(orderNo).toMatch(/^\d+$/);
  });

  it("订单号长度为 20 位 (14 位时间戳 + 6 位随机数)", () => {
    const orderNo = generateOrderNo();
    expect(orderNo).toHaveLength(20);
  });

  it("订单号前 14 位为 yyyyMMddHHmmss 格式", () => {
    const orderNo = generateOrderNo();
    const now = new Date();
    const y = now.getFullYear().toString();
    const M = (now.getMonth() + 1).toString().padStart(2, "0");
    const d = now.getDate().toString().padStart(2, "0");
    const h = now.getHours().toString().padStart(2, "0");
    const m = now.getMinutes().toString().padStart(2, "0");
    const s = now.getSeconds().toString().padStart(2, "0");
    const expectedPrefix = `${y}${M}${d}${h}${m}${s}`;

    expect(orderNo.startsWith(expectedPrefix)).toBe(true);
  });

  it("后 6 位随机数在 100000-999999 之间", () => {
    const orderNo = generateOrderNo();
    const randPart = parseInt(orderNo.slice(14), 10);
    expect(randPart).toBeGreaterThanOrEqual(100000);
    expect(randPart).toBeLessThanOrEqual(999999);
  });

  it("连续生成 100 个订单号应全部不同", () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) {
      set.add(generateOrderNo());
    }
    expect(set.size).toBe(100);
  });

  it("连续生成 1000 个订单号应全部不同", () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      set.add(generateOrderNo());
    }
    expect(set.size).toBe(1000);
  });
});

describe("generateSubOrderNo", () => {
  it("子订单号格式为 {orderNo}-{序号2位补零}", () => {
    const orderNo = "20260605120000123456";
    expect(generateSubOrderNo(orderNo, 0)).toBe("20260605120000123456-01");
    expect(generateSubOrderNo(orderNo, 1)).toBe("20260605120000123456-02");
    expect(generateSubOrderNo(orderNo, 9)).toBe("20260605120000123456-10");
    expect(generateSubOrderNo(orderNo, 98)).toBe("20260605120000123456-99");
  });

  it("序号从 0 开始补零为 2 位", () => {
    expect(generateSubOrderNo("X", 0)).toBe("X-01");
    expect(generateSubOrderNo("X", 99)).toBe("X-100");
  });

  it("同一订单的不同子订单号不同", () => {
    const orderNo = generateOrderNo();
    const sub1 = generateSubOrderNo(orderNo, 0);
    const sub2 = generateSubOrderNo(orderNo, 1);
    const sub3 = generateSubOrderNo(orderNo, 2);
    expect(sub1).not.toBe(sub2);
    expect(sub2).not.toBe(sub3);
    expect(sub1).not.toBe(sub3);
  });
});

describe("generateIdempotencyKey", () => {
  it("幂等键以 idem- 开头", () => {
    const key = generateIdempotencyKey();
    expect(key.startsWith("idem-")).toBe(true);
  });

  it("幂等键长度为 41 (idem- + 36 位 UUID)", () => {
    const key = generateIdempotencyKey();
    expect(key).toHaveLength(41);
  });

  it("连续生成 100 个幂等键应全部不同", () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) {
      set.add(generateIdempotencyKey());
    }
    expect(set.size).toBe(100);
  });

  it("幂等键格式为 UUID v4 格式", () => {
    const key = generateIdempotencyKey();
    const uuidPart = key.slice(5); // remove "idem-"
    const uuidV4Regex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuidPart).toMatch(uuidV4Regex);
  });
});
