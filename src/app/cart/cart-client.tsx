"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  updateCartAction,
  removeCartAction,
  toggleCartSelectAction,
  selectAllCartAction,
} from "@/server/actions/cart.actions";

interface CartItemDisplay {
  skuId: string;
  productId: string;
  name: string;
  image: string;
  specs: Record<string, string>;
  price: number;
  stock: number;
  quantity: number;
  selected: boolean;
  addedAt: string;
}

export default function CartClient({ items }: { items: CartItemDisplay[] }) {
  const [updateState, updateDispatch] = useActionState(updateCartAction, {});
  const [, removeDispatch] = useActionState(removeCartAction, {});
  const [, toggleDispatch] = useActionState(toggleCartSelectAction, {});
  const [, selectAllDispatch] = useActionState(selectAllCartAction, {});

  const selectedItems = items.filter((i) => i.selected);
  const totalAmount = selectedItems.reduce(
    (sum, i) => sum + i.price * i.quantity,
    0
  );
  const allSelected = items.length > 0 && items.every((i) => i.selected);

  if (items.length === 0) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", padding: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>购物车</h2>
        <div style={{ textAlign: "center", padding: 48, color: "#999" }}>
          <p style={{ fontSize: 16, marginBottom: 16 }}>购物车是空的</p>
          <Link href="/products" style={{ color: "#666", textDecoration: "underline" }}>
            去逛逛
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 32 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>购物车</h2>

      {updateState.error && (
        <div style={{ background: "#fff0f0", color: "#c00", padding: "8px 12px", marginBottom: 12, borderRadius: 4, fontSize: 13 }}>
          {updateState.error}
        </div>
      )}

      {/* Select all */}
      <form action={selectAllDispatch} style={{ marginBottom: 12 }}>
        <input type="hidden" name="selected" value={(!allSelected).toString()} />
        <button type="submit" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#666" }}>
          {allSelected ? "取消全选" : "全选"}
        </button>
      </form>

      {/* Cart items */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((item) => (
          <div
            key={item.skuId}
            style={{
              display: "flex",
              gap: 12,
              padding: 12,
              border: "1px solid #eee",
              borderRadius: 6,
              background: "#fff",
              alignItems: "center",
            }}
          >
            {/* Select */}
            <form action={toggleDispatch}>
              <input type="hidden" name="skuId" value={item.skuId} />
              <input type="hidden" name="selected" value={(!item.selected).toString()} />
              <button type="submit" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>
                {item.selected ? "☑" : "☐"}
              </button>
            </form>

            {/* Image */}
            <div style={{ width: 80, height: 80, background: "#f5f5f5", borderRadius: 4, overflow: "hidden", flexShrink: 0 }}>
              {item.image ? (
                <img src={item.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#ccc" }}>无图</div>
              )}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{item.name}</div>
              <div style={{ fontSize: 12, color: "#999", marginBottom: 4 }}>
                {Object.values(item.specs).join(" / ")}
              </div>
              <div style={{ fontSize: 14, color: "#e00", fontWeight: 600 }}>
                ¥{(item.price / 100).toFixed(2)}
              </div>
            </div>

            {/* Quantity */}
            <form action={updateDispatch} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input type="hidden" name="skuId" value={item.skuId} />
              <input
                name="quantity"
                type="number"
                defaultValue={item.quantity}
                min={1}
                max={item.stock}
                style={{ width: 50, padding: "4px 6px", border: "1px solid #ddd", borderRadius: 4, textAlign: "center", fontSize: 13 }}
              />
              <button
                type="submit"
                style={{ padding: "4px 8px", background: "#f0f0f0", border: "1px solid #ddd", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
              >
                更新
              </button>
            </form>

            {/* Subtotal */}
            <div style={{ fontSize: 13, color: "#666", minWidth: 80, textAlign: "right" }}>
              ¥{((item.price * item.quantity) / 100).toFixed(2)}
            </div>

            {/* Remove */}
            <form action={removeDispatch}>
              <input type="hidden" name="skuId" value={item.skuId} />
              <button
                type="submit"
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#999", padding: 4 }}
              >
                ✕
              </button>
            </form>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          background: "#fff",
          borderTop: "1px solid #eee",
          padding: "12px 0",
          marginTop: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: 14, color: "#666" }}>
          已选 {selectedItems.length} 件，合计{" "}
          <span style={{ color: "#e00", fontWeight: 600, fontSize: 18 }}>
            ¥{(totalAmount / 100).toFixed(2)}
          </span>
        </div>
        <Link
          href={
            selectedItems.length > 0
              ? `/checkout?skuIds=${selectedItems.map((i) => i.skuId).join(",")}`
              : "#"
          }
          style={{
            padding: "10px 32px",
            background: selectedItems.length > 0 ? "#e00" : "#ccc",
            color: "#fff",
            borderRadius: 6,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 14,
            pointerEvents: selectedItems.length > 0 ? "auto" : "none",
          }}
        >
          去结算
        </Link>
      </div>
    </div>
  );
}
