"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createOrderAction } from "@/server/actions/order.actions";

interface AddressDisplay {
  id: string;
  receiverName: string;
  receiverPhone: string;
  fullAddress: string;
  isDefault: boolean;
}

interface CheckoutItem {
  skuId: string;
  productId: string;
  name: string;
  image: string;
  specs: Record<string, string>;
  price: number;
  quantity: number;
}

interface CheckoutGroup {
  merchantName: string;
  items: CheckoutItem[];
  subtotal: number;
}

export default function CheckoutClient({
  groups,
  totalAmount,
  addresses,
  skuIds,
  isDirect,
}: {
  groups: CheckoutGroup[];
  totalAmount: number;
  addresses: AddressDisplay[];
  skuIds: string[];
  isDirect: boolean;
}) {
  const router = useRouter();
  const [state, dispatch] = useActionState(createOrderAction, {});

  useEffect(() => {
    if (state.success && state.orderId) {
      router.push(`/pay/${state.orderId}`);
    }
  }, [state.success, state.orderId, router]);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 32 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>确认订单</h2>

      {state.error && (
        <div style={{ background: "#fff0f0", color: "#c00", padding: "8px 12px", marginBottom: 12, borderRadius: 4, fontSize: 13 }}>
          {state.error}
        </div>
      )}

      {/* Order items grouped by merchant */}
      {groups.map((group, gi) => (
        <div key={gi} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#666", marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid #eee" }}>
            {group.merchantName}
          </div>
          {group.items.map((item) => (
            <div
              key={item.skuId}
              style={{ display: "flex", gap: 12, padding: "8px 0", alignItems: "center" }}
            >
              <div style={{ width: 64, height: 64, background: "#f5f5f5", borderRadius: 4, overflow: "hidden", flexShrink: 0 }}>
                {item.image ? (
                  <img src={item.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : null}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14 }}>{item.name}</div>
                <div style={{ fontSize: 12, color: "#999" }}>
                  {Object.values(item.specs).join(" / ")} x {item.quantity}
                </div>
              </div>
              <div style={{ fontSize: 14, color: "#e00", fontWeight: 600 }}>
                ¥{((item.price * item.quantity) / 100).toFixed(2)}
              </div>
            </div>
          ))}
          <div style={{ textAlign: "right", fontSize: 13, color: "#666", paddingTop: 8 }}>
            小计：¥{(group.subtotal / 100).toFixed(2)}
          </div>
        </div>
      ))}

      {/* Address selection */}
      <form action={dispatch}>
        <div style={{ borderTop: "1px solid #eee", paddingTop: 16, marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>收货地址</h3>
          {addresses.length === 0 ? (
            <div style={{ color: "#999", fontSize: 13 }}>
              暂无地址，请先
              <a href="/index/user" style={{ color: "#666" }}>添加收货地址</a>
            </div>
          ) : (
            <select
              name="addressId"
              defaultValue={addresses.find((a) => a.isDefault)?.id ?? addresses[0].id}
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: 13,
                border: "1px solid #ddd",
                borderRadius: 6,
                background: "#fff",
                cursor: "pointer",
              }}
            >
              {addresses.map((addr) => (
                <option key={addr.id} value={addr.id}>
                  {addr.receiverName} {addr.receiverPhone} — {addr.fullAddress}
                  {addr.isDefault ? " [默认]" : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Submit */}
        <input type="hidden" name="skuIds" value={JSON.stringify(skuIds)} />
        <input type="hidden" name="paymentMethod" value="WECHAT_PAY" />
        {isDirect && <input type="hidden" name="direct" value="1" />}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 0",
            borderTop: "1px solid #eee",
          }}
        >
          <div style={{ fontSize: 14, color: "#666" }}>
            应付金额：{" "}
            <span style={{ color: "#e00", fontWeight: 600, fontSize: 20 }}>
              ¥{(totalAmount / 100).toFixed(2)}
            </span>
          </div>
          <button
            type="submit"
            disabled={addresses.length === 0}
            style={{
              padding: "10px 40px",
              background: addresses.length > 0 ? "#e00" : "#ccc",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 15,
              cursor: addresses.length > 0 ? "pointer" : "not-allowed",
            }}
          >
            提交订单
          </button>
        </div>
      </form>
    </div>
  );
}
