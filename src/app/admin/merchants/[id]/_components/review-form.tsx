"use client";

import { useActionState } from "react";
import { reviewMerchantAction } from "@/server/actions/admin.merchant.actions";
import { MerchantStatus } from "@prisma/client";

export function ReviewForm({ merchantId, status }: { merchantId: string; status: MerchantStatus }) {
  const [state, action, pending] = useActionState(reviewMerchantAction, {});

  return (
    <div style={{ background: "#fff", padding: 20, borderRadius: 8, border: "1px solid #e5e7eb" }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>审核操作</h3>

      {state.error && (
        <div style={{ color: "#c00", fontSize: 13, marginBottom: 16, padding: 10, background: "#fff0f0", borderRadius: 4 }}>
          {state.error}
        </div>
      )}
      {state.success && (
        <div style={{ color: "#0a0", fontSize: 13, marginBottom: 16, padding: 10, background: "#f0fff0", borderRadius: 4 }}>
          {state.success}
        </div>
      )}

      <form action={action} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <input type="hidden" name="id" value={merchantId} />
        <div>
          <select name="status" required style={{ padding: "8px 10px", borderRadius: 4, border: "1px solid #ccc", minWidth: 120 }}>
            <option value="">选择操作</option>
            {status === "PENDING" && (
              <>
                <option value="APPROVED">通过</option>
                <option value="REJECTED">驳回</option>
              </>
            )}
            {status === "APPROVED" && <option value="DISABLED">禁用</option>}
            {status === "REJECTED" && (
              <>
                <option value="APPROVED">通过</option>
                <option value="DISABLED">禁用</option>
              </>
            )}
            {status === "DISABLED" && <option value="APPROVED">启用</option>}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <input
            name="reason"
            placeholder="驳回/操作原因（可选）"
            style={{ width: "100%", padding: "8px 10px", borderRadius: 4, border: "1px solid #ccc" }}
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          style={{
            padding: "8px 20px",
            background: pending ? "#ccc" : "#111",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: pending ? "not-allowed" : "pointer"
          }}
        >
          {pending ? "提交中..." : "提交"}
        </button>
      </form>
    </div>
  );
}
