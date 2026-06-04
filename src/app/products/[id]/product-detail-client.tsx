"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface Sku {
  id: string;
  skuCode: string;
  specs: Record<string, string>;
  price: number;
  originalPrice: number | null;
  stock: number;
  image: string | null;
}

interface ProductDetailClientProps {
  product: {
    id: string;
    name: string;
    subtitle: string | null;
    description: string | null;
    mainImage: string;
    images: string[];
    specTemplate: unknown;
    merchant: { name: string } | null;
    skus: Sku[];
  };
}

export default function ProductDetailClient({ product }: ProductDetailClientProps) {
  const [selectedImage, setSelectedImage] = useState(product.mainImage);
  const [selectedSpecs, setSelectedSpecs] = useState<Record<string, string>>({});

  const specTemplate = (product.specTemplate as { name: string; values: string[] }[] | undefined) || [];

  const selectedSku = useMemo(() => {
    if (Object.keys(selectedSpecs).length !== specTemplate.length) return null;
    return product.skus.find((sku) =>
      Object.entries(selectedSpecs).every(([key, value]) => sku.specs[key] === value)
    );
  }, [selectedSpecs, product.skus, specTemplate.length]);

  const displayPrice = selectedSku ? selectedSku.price : Math.min(...product.skus.map((s) => s.price));
  const displayOriginalPrice = selectedSku?.originalPrice;
  const displayStock = selectedSku ? selectedSku.stock : product.skus.reduce((sum, s) => sum + s.stock, 0);

  const toggleSpec = (specName: string, value: string) => {
    setSelectedSpecs((prev) => {
      const next = { ...prev };
      if (next[specName] === value) {
        delete next[specName];
      } else {
        next[specName] = value;
      }
      return next;
    });
  };

  return (
    <div style={{ padding: "24px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
        {/* Left: Images */}
        <div>
          <img
            src={selectedImage}
            alt={product.name}
            style={{ width: "100%", maxHeight: 480, objectFit: "cover", borderRadius: 8, marginBottom: 12 }}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <img
              src={product.mainImage}
              alt="主图"
              onClick={() => setSelectedImage(product.mainImage)}
              style={{
                width: 64,
                height: 64,
                objectFit: "cover",
                borderRadius: 4,
                border: selectedImage === product.mainImage ? "2px solid #111" : "2px solid transparent",
                cursor: "pointer"
              }}
            />
            {product.images.map((img, i) => (
              <img
                key={i}
                src={img}
                alt=""
                onClick={() => setSelectedImage(img)}
                style={{
                  width: 64,
                  height: 64,
                  objectFit: "cover",
                  borderRadius: 4,
                  border: selectedImage === img ? "2px solid #111" : "2px solid transparent",
                  cursor: "pointer"
                }}
              />
            ))}
          </div>
        </div>

        {/* Right: Info */}
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{product.name}</h1>
          {product.subtitle && <p style={{ fontSize: 14, color: "#666", marginBottom: 16 }}>{product.subtitle}</p>}

          <div style={{ background: "#fef2f2", padding: 16, borderRadius: 8, marginBottom: 20 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#ef4444" }}>
              ¥{(displayPrice / 100).toFixed(2)}
            </div>
            {displayOriginalPrice && displayOriginalPrice > displayPrice && (
              <div style={{ fontSize: 14, color: "#999", textDecoration: "line-through" }}>
                ¥{(displayOriginalPrice / 100).toFixed(2)}
              </div>
            )}
          </div>

          {specTemplate.map((spec) => (
            <div key={spec.name} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>{spec.name}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {spec.values.map((value) => {
                  const isSelected = selectedSpecs[spec.name] === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleSpec(spec.name, value)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 4,
                        border: isSelected ? "1px solid #111" : "1px solid #ccc",
                        background: isSelected ? "#111" : "#fff",
                        color: isSelected ? "#fff" : "#333",
                        cursor: "pointer",
                        fontSize: 13
                      }}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: "#666" }}>库存: </span>
            <span style={{ fontSize: 13, color: "#333" }}>{displayStock}</span>
          </div>

          {selectedSku && selectedSku.stock <= 0 && (
            <div style={{ color: "#c00", fontSize: 14, marginBottom: 16 }}>该规格暂时缺货</div>
          )}

          <div style={{ marginBottom: 20, padding: 12, background: "#f8f9fa", borderRadius: 8 }}>
            <div style={{ fontSize: 13, color: "#666", marginBottom: 4 }}>店铺</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{product.merchant?.name || "-"}</div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button
              disabled={!selectedSku || selectedSku.stock <= 0}
              style={{
                flex: 1,
                padding: "12px 0",
                background: !selectedSku || selectedSku.stock <= 0 ? "#ccc" : "#ef4444",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                fontSize: 15,
                fontWeight: 600,
                cursor: !selectedSku || selectedSku.stock <= 0 ? "not-allowed" : "pointer"
              }}
            >
              立即购买
            </button>
          </div>
        </div>
      </div>

      {product.description && (
        <div style={{ marginTop: 40, background: "#fff", padding: 24, borderRadius: 8, border: "1px solid #e5e7eb" }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>商品详情</h3>
          <div style={{ fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{product.description}</div>
        </div>
      )}
    </div>
  );
}
