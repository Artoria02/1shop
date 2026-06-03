"use client";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Unhandled error:", error); }, [error]);
  return (
    <html>
      <body style={{ margin: 0, fontFamily: "Arial, Microsoft YaHei, sans-serif", background: "#f6f5f2", color: "#1d252c" }}>
        <div style={{ maxWidth: 480, margin: "100px auto", padding: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>出错了</h1>
          <p style={{ color: "#5f6d76", marginBottom: 24, fontSize: 14 }}>{error.message || "发生未知错误"}</p>
          <button onClick={reset} style={{ padding: "8px 20px", fontSize: 14, fontWeight: 600, background: "#111", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>重试</button>
        </div>
      </body>
    </html>
  );
}