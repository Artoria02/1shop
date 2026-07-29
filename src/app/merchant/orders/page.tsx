import { requireSessionUser } from "@/lib/auth";
import { findSubOrdersByMerchant } from "@/server/services/order.service";
import Link from "next/link";
import type { OrderStatus } from "@prisma/client";

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "待支付",
  PAID: "已支付",
  SHIPPED: "已发货",
  RECEIVED: "已收货",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING_PAYMENT: "#f59e0b",
  PAID: "#3b82f6",
  SHIPPED: "#8b5cf6",
  RECEIVED: "#10b981",
  COMPLETED: "#6b7280",
  CANCELLED: "#ef4444",
};

export default async function MerchantOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>;
}) {
  const user = await requireSessionUser("MERCHANT");
  if (!user.merchantId) {
    return <div style={{ padding: 32, color: "#999" }}>您还没有关联的店铺</div>;
  }

  const params = await searchParams;
  const status = params.status as OrderStatus | undefined;
  const search = params.search;
  const page = parseInt(params.page ?? "1");

  const result = await findSubOrdersByMerchant(user.merchantId, {
    status,
    search,
    page,
    pageSize: 10,
  });

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>订单管理</h2>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {["", "PAID", "SHIPPED", "RECEIVED", "COMPLETED", "CANCELLED"].map((s) => (
          <Link
            key={s}
            href={s ? `/merchant/orders?status=${s}` : "/merchant/orders"}
            style={{
              padding: "4px 12px",
              borderRadius: 4,
              fontSize: 13,
              textDecoration: "none",
              background: (status ?? "") === s ? "#111" : "#f0f0f0",
              color: (status ?? "") === s ? "#fff" : "#333",
            }}
          >
            {STATUS_LABELS[s] ?? "全部"}
          </Link>
        ))}
      </div>

      {/* Search */}
      <form method="GET" style={{ marginBottom: 16, display: "flex", gap: 8 }}>
        <input type="hidden" name="status" value={status ?? ""} />
        <input
          name="search"
          defaultValue={search ?? ""}
          placeholder="搜索订单号..."
          style={{ padding: "6px 12px", border: "1px solid #ddd", borderRadius: 4, fontSize: 13, width: 240 }}
        />
        <button type="submit" style={{ padding: "6px 16px", background: "#111", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13 }}>
          搜索
        </button>
      </form>

      {result.items.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "#999", fontSize: 14 }}>暂无订单</div>
      ) : (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#fafafa", textAlign: "left" }}>
                <th style={{ padding: "8px 12px", borderBottom: "1px solid #eee" }}>子订单号</th>
                <th style={{ padding: "8px 12px", borderBottom: "1px solid #eee" }}>商品</th>
                <th style={{ padding: "8px 12px", borderBottom: "1px solid #eee" }}>金额</th>
                <th style={{ padding: "8px 12px", borderBottom: "1px solid #eee" }}>状态</th>
                <th style={{ padding: "8px 12px", borderBottom: "1px solid #eee" }}>时间</th>
                <th style={{ padding: "8px 12px", borderBottom: "1px solid #eee" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((sub) => (
                <tr key={sub.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 12 }}>
                    {sub.subOrderNo}
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    {sub.items.map((item, idx) => (
                      <div key={idx} style={{ marginBottom: 4 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <div style={{ width: 36, height: 36, background: "#f5f5f5", borderRadius: 4, overflow: "hidden", flexShrink: 0 }}>
                            {item.productImage ? (
                              <img src={item.productImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : null}
                          </div>
                          <div>
                            <div>{item.productName}</div>
                            <div style={{ color: "#999", fontSize: 11 }}>x{item.quantity} ¥{(item.price / 100).toFixed(2)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </td>
                  <td style={{ padding: "8px 12px", fontWeight: 600 }}>
                    ¥{(sub.totalAmount / 100).toFixed(2)}
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <span style={{ color: STATUS_COLORS[sub.status], fontWeight: 500 }}>
                      {STATUS_LABELS[sub.status]}
                    </span>
                  </td>
                  <td style={{ padding: "8px 12px", fontSize: 12, color: "#999" }}>
                    {new Date(sub.createdAt).toLocaleDateString("zh-CN")}
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <Link
                      href={`/merchant/orders/${sub.id}`}
                      style={{ color: "#111", textDecoration: "underline", fontSize: 12 }}
                    >
                      详情{sub.status === "PAID" ? "/发货" : ""}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {Math.ceil(result.total / 10) > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
              {Array.from({ length: Math.ceil(result.total / 10) }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={`/merchant/orders?page=${p}${status ? `&status=${status}` : ""}${search ? `&search=${search}` : ""}`}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 4,
                    textDecoration: "none",
                    fontSize: 13,
                    background: p === page ? "#111" : "#f0f0f0",
                    color: p === page ? "#fff" : "#333",
                  }}
                >
                  {p}
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
