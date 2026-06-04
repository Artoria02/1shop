"use client";

import { Fragment, useState, useCallback, useActionState } from "react";
import { createProductAction, updateProductAction } from "@/server/actions/merchant.product.actions";
import type { findById } from "@/server/services/product.service";

interface SpecDef {
  name: string;
  values: string[];
}

interface SkuRow {
  skuCode: string;
  specs: Record<string, string>;
  price: string;
  originalPrice: string;
  stock: string;
  image: string;
}

interface CategoryOption {
  id: string;
  name: string;
  children?: CategoryOption[];
}

interface BrandOption {
  id: string;
  name: string;
}

export default function ProductForm({
  categories,
  brands,
  product
}: {
  categories: CategoryOption[];
  brands: BrandOption[];
  product?: Awaited<ReturnType<typeof findById>>;
}) {
  const isEdit = !!product;
  const action = isEdit ? updateProductAction : createProductAction;
  const [state, formAction, pending] = useActionState(action, {});
  const [uploadError, setUploadError] = useState("");

  const [name, setName] = useState(product?.name || "");
  const [subtitle, setSubtitle] = useState(product?.subtitle || "");
  const [categoryId, setCategoryId] = useState(product?.categoryId || "");
  const [brandId, setBrandId] = useState(product?.brandId || "");
  const [description, setDescription] = useState(product?.description || "");
  const [mainImage, setMainImage] = useState(product?.mainImage || "");
  const [images, setImages] = useState<string[]>(product?.images || []);
  const [specs, setSpecs] = useState<SpecDef[]>(
    (product?.specTemplate as SpecDef[] | undefined) || []
  );
  const [skuRows, setSkuRows] = useState<SkuRow[]>(
    product?.skus.map((s) => ({
      skuCode: s.skuCode,
      specs: s.specs as Record<string, string>,
      price: String(s.price),
      originalPrice: s.originalPrice ? String(s.originalPrice) : "",
      stock: String(s.stock),
      image: s.image || ""
    })) || []
  );

  const generateCombinations = useCallback(() => {
    if (specs.length === 0) return;

    const activeSpecs = specs.filter((s) => s.name && s.values.length > 0);
    if (activeSpecs.length === 0) return;

    const combinations: Record<string, string>[] = [];

    function helper(index: number, current: Record<string, string>) {
      if (index === activeSpecs.length) {
        combinations.push({ ...current });
        return;
      }
      const spec = activeSpecs[index];
      for (const val of spec.values) {
        current[spec.name] = val;
        helper(index + 1, current);
      }
    }

    helper(0, {});

    const newRows: SkuRow[] = combinations.map((combo) => {
      const existing = skuRows.find((r) =>
        Object.entries(combo).every(([k, v]) => r.specs[k] === v)
      );
      return (
        existing || {
          skuCode: "",
          specs: combo,
          price: "",
          originalPrice: "",
          stock: "0",
          image: ""
        }
      );
    });

    setSkuRows(newRows);
  }, [specs, skuRows]);

  const addSpec = () => setSpecs([...specs, { name: "", values: [] }]);
  const removeSpec = (idx: number) => {
    const next = specs.filter((_, i) => i !== idx);
    setSpecs(next);
  };
  const updateSpecName = (idx: number, name: string) => {
    const next = [...specs];
    next[idx].name = name;
    setSpecs(next);
  };
  const updateSpecValues = (idx: number, valuesText: string) => {
    const next = [...specs];
    next[idx].values = valuesText.split(/[,，]/).map((v) => v.trim()).filter(Boolean);
    setSpecs(next);
  };

  const updateSkuField = (idx: number, field: keyof SkuRow, value: string) => {
    const next = [...skuRows];
    next[idx] = { ...next[idx], [field]: value };
    setSkuRows(next);
  };

  const uploadImage = async (file: File, folder: string): Promise<string | null> => {
    setUploadError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (!json.success) {
        setUploadError(json.error?.message || "上传失败，请重新登录后重试");
        return null;
      }
      return json.data.url;
    } catch {
      setUploadError("网络错误，上传失败");
      return null;
    }
  };

  const handleMainImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImage(file, "products");
    if (url) setMainImage(url);
  };

  const handleDetailImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImage(file, "products");
    if (url) setImages([...images, url]);
  };

  const handleSkuImage = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImage(file, "products");
    if (url) updateSkuField(idx, "image", url);
  };

  const activeSpecs = specs.filter((s) => s.name && s.values.length > 0);
  const serializedSkus = JSON.stringify(
    skuRows.map((r) => ({
      skuCode: r.skuCode || Object.values(r.specs).join("-"),
      specs: r.specs,
      price: parseInt(r.price, 10) || 0,
      originalPrice: r.originalPrice ? parseInt(r.originalPrice, 10) : undefined,
      stock: parseInt(r.stock, 10) || 0,
      image: r.image || undefined
    }))
  );

  if (state.success) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>{state.message || "操作成功"}</h2>
        <p style={{ color: "#666", fontSize: 14 }}>
          {state.message?.includes("审核") ? "平台管理员将尽快审核您的商品。" : "您可以继续编辑或提交审核。"}
        </p>
        <a href="/merchant/products" style={{ color: "#2563eb", fontSize: 14 }}>返回商品列表</a>
      </div>
    );
  }

  return (
    <form id="product-form" action={formAction}>
      <input type="hidden" name="mainImage" value={mainImage} />
      <input type="hidden" name="images" value={JSON.stringify(images)} />
      <input type="hidden" name="specTemplate" value={JSON.stringify(activeSpecs)} />
      <input type="hidden" name="skus" value={serializedSkus} />
      {isEdit && product && <input type="hidden" name="id" value={product.id} />}

      {uploadError && (
        <div style={{ color: "#c00", fontSize: 13, marginBottom: 16, padding: 10, background: "#fff0f0", borderRadius: 4 }}>{uploadError}</div>
      )}

      {state.error && (
        <div style={{ color: "#c00", fontSize: 13, marginBottom: 16, padding: 10, background: "#fff0f0", borderRadius: 4 }}>{state.error}</div>
      )}

      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>基础信息</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 4 }}>商品名称 *</label>
            <input name="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4 }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 4 }}>副标题</label>
            <input name="subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} maxLength={200} style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4 }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 4 }}>类目 *</label>
            <select name="categoryId" required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4 }}>
              <option value="">请选择</option>
              {categories.map((cat) => (
                <Fragment key={cat.id}>
                  <option value={cat.id}>{cat.name}</option>
                  {cat.children?.map((child) => (
                    <option key={child.id} value={child.id}>  — {child.name}</option>
                  ))}
                </Fragment>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 4 }}>品牌</label>
            <select name="brandId" value={brandId} onChange={(e) => setBrandId(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4 }}>
              <option value="">请选择</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>商品图片</h3>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 4 }}>主图 *</label>
          <input type="file" accept="image/*" onChange={handleMainImage} />
          {mainImage && <img src={mainImage} alt="主图" style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 4, marginTop: 8 }} />}
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 4 }}>详情图（最多9张）</label>
          <input type="file" accept="image/*" onChange={handleDetailImage} disabled={images.length >= 9} />
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            {images.map((img, i) => (
              <div key={i} style={{ position: "relative" }}>
                <img src={img} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 4 }} />
                <button
                  type="button"
                  onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                  style={{ position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: "50%", border: "none", background: "#ef4444", color: "#fff", fontSize: 10, cursor: "pointer" }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 4 }}>商品详情</label>
        <textarea name="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={5} style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4 }} />
      </div>

      <div style={{ marginBottom: 24, background: "#f8f9fa", padding: 16, borderRadius: 8 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>规格模板</h3>
        {specs.map((spec, idx) => (
          <div key={idx} style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
            <input
              placeholder="规格名（如：颜色）"
              value={spec.name}
              onChange={(e) => updateSpecName(idx, e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc" }}
            />
            <input
              placeholder="规格值，用逗号分隔（如：红,蓝,黑）"
              defaultValue={spec.values.join(",")}
              onBlur={(e) => updateSpecValues(idx, e.target.value)}
              style={{ flex: 1, padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc" }}
            />
            <button type="button" onClick={() => removeSpec(idx)} style={{ padding: "4px 10px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>删除</button>
          </div>
        ))}
        <button type="button" onClick={addSpec} style={{ padding: "6px 14px", background: "#111", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>+ 添加规格</button>
        <button type="button" onClick={generateCombinations} style={{ marginLeft: 12, padding: "6px 14px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>生成 SKU 矩阵</button>
      </div>

      {skuRows.length > 0 && (
        <div style={{ marginBottom: 24, background: "#fff", padding: 16, borderRadius: 8, border: "1px solid #e5e7eb" }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>SKU 列表</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8f9fa", textAlign: "left" }}>
                <th style={{ padding: "8px 10px", borderBottom: "1px solid #e5e7eb" }}>规格组合</th>
                <th style={{ padding: "8px 10px", borderBottom: "1px solid #e5e7eb" }}>SKU编码 *</th>
                <th style={{ padding: "8px 10px", borderBottom: "1px solid #e5e7eb" }}>售价（分）*</th>
                <th style={{ padding: "8px 10px", borderBottom: "1px solid #e5e7eb" }}>划线价（分）</th>
                <th style={{ padding: "8px 10px", borderBottom: "1px solid #e5e7eb" }}>库存 *</th>
                <th style={{ padding: "8px 10px", borderBottom: "1px solid #e5e7eb" }}>SKU图</th>
              </tr>
            </thead>
            <tbody>
              {skuRows.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "8px 10px" }}>{Object.entries(row.specs).map(([k, v]) => `${k}:${v}`).join(" / ")}</td>
                  <td style={{ padding: "8px 10px" }}>
                    <input value={row.skuCode} onChange={(e) => updateSkuField(idx, "skuCode", e.target.value)} style={{ width: 100, padding: "4px 6px", border: "1px solid #ccc", borderRadius: 4 }} />
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <input type="number" value={row.price} onChange={(e) => updateSkuField(idx, "price", e.target.value)} style={{ width: 80, padding: "4px 6px", border: "1px solid #ccc", borderRadius: 4 }} />
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <input type="number" value={row.originalPrice} onChange={(e) => updateSkuField(idx, "originalPrice", e.target.value)} style={{ width: 80, padding: "4px 6px", border: "1px solid #ccc", borderRadius: 4 }} />
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <input type="number" value={row.stock} onChange={(e) => updateSkuField(idx, "stock", e.target.value)} style={{ width: 80, padding: "4px 6px", border: "1px solid #ccc", borderRadius: 4 }} />
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <input type="file" accept="image/*" onChange={(e) => handleSkuImage(idx, e)} />
                    {row.image && <img src={row.image} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4, marginTop: 4 }} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <button
          type="submit"
          name="action"
          value="draft"
          disabled={pending}
          style={{ padding: "10px 24px", background: "#f3f4f6", color: "#333", border: "1px solid #ccc", borderRadius: 4, cursor: "pointer" }}
        >
          {pending ? "保存中..." : "保存草稿"}
        </button>
        <button
          type="submit"
          name="action"
          value="submit"
          disabled={pending}
          style={{ padding: "10px 24px", background: "#111", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
        >
          {pending ? "提交中..." : "提交审核"}
        </button>
      </div>
    </form>
  );
}
