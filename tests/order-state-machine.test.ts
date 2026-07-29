import { describe, it, expect } from "vitest";
import {
  canTransition,
  assertTransition,
  getNextAllowed,
} from "../src/lib/order-state-machine";
import { OrderStatus } from "@prisma/client";

// ============================================================
// order-state-machine — 纯单元测试
// ============================================================

describe("order-state-machine — VALID_TRANSITIONS", () => {
  // ---- PENDING_PAYMENT 合法跳转 ----
  it("PENDING_PAYMENT → PAID (支付成功)", () => {
    expect(canTransition("PENDING_PAYMENT", "PAID")).toBe(true);
  });

  it("PENDING_PAYMENT → CANCELLED (买家取消/超时)", () => {
    expect(canTransition("PENDING_PAYMENT", "CANCELLED")).toBe(true);
  });

  // ---- PAID 合法跳转 ----
  it("PAID → SHIPPED (商家发货)", () => {
    expect(canTransition("PAID", "SHIPPED")).toBe(true);
  });

  it("PAID → REFUNDING (退款, Phase 4)", () => {
    expect(canTransition("PAID", "REFUNDING")).toBe(true);
  });

  // ---- SHIPPED 合法跳转 ----
  it("SHIPPED → RECEIVED (买家确认收货)", () => {
    expect(canTransition("SHIPPED", "RECEIVED")).toBe(true);
  });

  it("SHIPPED → REFUNDING (退货退款, Phase 4)", () => {
    expect(canTransition("SHIPPED", "REFUNDING")).toBe(true);
  });

  // ---- RECEIVED 合法跳转 ----
  it("RECEIVED → COMPLETED (自动完成)", () => {
    expect(canTransition("RECEIVED", "COMPLETED")).toBe(true);
  });

  // ---- REFUNDING 合法跳转 ----
  it("REFUNDING → REFUNDED (退款完成, Phase 4)", () => {
    expect(canTransition("REFUNDING", "REFUNDED")).toBe(true);
  });

  // ---- 终态不可再跳转 ----
  it("COMPLETED 是终态，不可再跳转", () => {
    const states: OrderStatus[] = [
      "PENDING_PAYMENT", "PAID", "SHIPPED", "RECEIVED",
      "COMPLETED", "CANCELLED", "REFUNDING", "REFUNDED",
    ];
    for (const to of states) {
      expect(canTransition("COMPLETED", to)).toBe(false);
    }
  });

  it("CANCELLED 是终态，不可再跳转", () => {
    const states: OrderStatus[] = [
      "PENDING_PAYMENT", "PAID", "SHIPPED", "RECEIVED",
      "COMPLETED", "CANCELLED", "REFUNDING", "REFUNDED",
    ];
    for (const to of states) {
      expect(canTransition("CANCELLED", to)).toBe(false);
    }
  });

  it("REFUNDED 是终态，不可再跳转", () => {
    const states: OrderStatus[] = [
      "PENDING_PAYMENT", "PAID", "SHIPPED", "RECEIVED",
      "COMPLETED", "CANCELLED", "REFUNDING", "REFUNDED",
    ];
    for (const to of states) {
      expect(canTransition("REFUNDED", to)).toBe(false);
    }
  });
});

describe("order-state-machine — 非法跳转", () => {
  it("PENDING_PAYMENT → SHIPPED (未支付直接发货) 非法", () => {
    expect(canTransition("PENDING_PAYMENT", "SHIPPED")).toBe(false);
  });

  it("PENDING_PAYMENT → RECEIVED 非法", () => {
    expect(canTransition("PENDING_PAYMENT", "RECEIVED")).toBe(false);
  });

  it("PENDING_PAYMENT → COMPLETED 非法", () => {
    expect(canTransition("PENDING_PAYMENT", "COMPLETED")).toBe(false);
  });

  it("PAID → RECEIVED (跳过发货) 非法", () => {
    expect(canTransition("PAID", "RECEIVED")).toBe(false);
  });

  it("PAID → COMPLETED 非法", () => {
    expect(canTransition("PAID", "COMPLETED")).toBe(false);
  });

  it("PAID → CANCELLED 非法", () => {
    expect(canTransition("PAID", "CANCELLED")).toBe(false);
  });

  it("SHIPPED → PAID (逆向) 非法", () => {
    expect(canTransition("SHIPPED", "PAID")).toBe(false);
  });

  it("SHIPPED → COMPLETED (跳过收货) 非法", () => {
    expect(canTransition("SHIPPED", "COMPLETED")).toBe(false);
  });

  it("RECEIVED → SHIPPED (逆向) 非法", () => {
    expect(canTransition("RECEIVED", "SHIPPED")).toBe(false);
  });

  it("RECEIVED → PAID (逆向) 非法", () => {
    expect(canTransition("RECEIVED", "PAID")).toBe(false);
  });

  it("RECEIVED → CANCELLED 非法", () => {
    expect(canTransition("RECEIVED", "CANCELLED")).toBe(false);
  });

  it("CANCELLED → PENDING_PAYMENT (复活) 非法", () => {
    expect(canTransition("CANCELLED", "PENDING_PAYMENT")).toBe(false);
  });
});

describe("order-state-machine — assertTransition", () => {
  it("合法跳转不抛出异常", () => {
    expect(() => assertTransition("PENDING_PAYMENT", "PAID")).not.toThrow();
    expect(() => assertTransition("PAID", "SHIPPED")).not.toThrow();
    expect(() => assertTransition("SHIPPED", "RECEIVED")).not.toThrow();
    expect(() => assertTransition("RECEIVED", "COMPLETED")).not.toThrow();
  });

  it("非法跳转抛出 Error", () => {
    expect(() => assertTransition("PENDING_PAYMENT", "SHIPPED")).toThrow(
      "Invalid order status transition: PENDING_PAYMENT -> SHIPPED"
    );
  });

  it("终态再跳转抛出 Error", () => {
    expect(() => assertTransition("COMPLETED", "PAID")).toThrow(
      "Invalid order status transition: COMPLETED -> PAID"
    );
    expect(() => assertTransition("CANCELLED", "PAID")).toThrow(
      "Invalid order status transition: CANCELLED -> PAID"
    );
  });

  it("错误消息包含 from 和 to 状态", () => {
    expect(() => assertTransition("PAID", "CANCELLED")).toThrow(
      "Invalid order status transition: PAID -> CANCELLED"
    );
  });
});

describe("order-state-machine — getNextAllowed", () => {
  it("PENDING_PAYMENT 可跳转到 PAID 和 CANCELLED", () => {
    const allowed = getNextAllowed("PENDING_PAYMENT");
    expect(allowed).toContain("PAID");
    expect(allowed).toContain("CANCELLED");
    expect(allowed).toHaveLength(2);
  });

  it("PAID 可跳转到 SHIPPED 和 REFUNDING", () => {
    const allowed = getNextAllowed("PAID");
    expect(allowed).toContain("SHIPPED");
    expect(allowed).toContain("REFUNDING");
    expect(allowed).toHaveLength(2);
  });

  it("SHIPPED 可跳转到 RECEIVED 和 REFUNDING", () => {
    const allowed = getNextAllowed("SHIPPED");
    expect(allowed).toContain("RECEIVED");
    expect(allowed).toContain("REFUNDING");
    expect(allowed).toHaveLength(2);
  });

  it("RECEIVED 只能跳转到 COMPLETED", () => {
    const allowed = getNextAllowed("RECEIVED");
    expect(allowed).toEqual(["COMPLETED"]);
  });

  it("COMPLETED 无允许跳转", () => {
    expect(getNextAllowed("COMPLETED")).toEqual([]);
  });

  it("CANCELLED 无允许跳转", () => {
    expect(getNextAllowed("CANCELLED")).toEqual([]);
  });

  it("REFUNDED 无允许跳转", () => {
    expect(getNextAllowed("REFUNDED")).toEqual([]);
  });
});
