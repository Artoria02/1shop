import { requireSessionUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import { findById } from "@/server/services/product.service";
import { findActiveTree } from "@/server/services/category.service";
import { findMany as findBrands } from "@/server/services/brand.service";
import { NotFoundError } from "@/lib/errors";
import ProductForm from "../../_components/product-form";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSessionUser("MERCHANT");

  const { id } = await params;

  let product;
  try {
    product = await findById(id, user.merchantId);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    console.error("EditProductPage error:", e);
    throw e;
  }

  const categories = await findActiveTree();
  const brands = await findBrands();

  const flatCategories = categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    children: (cat as unknown as { children: { id: string; name: string }[] }).children?.map((child) => ({
      id: child.id,
      name: child.name
    }))
  }));

  const brandOptions = brands.map((b) => ({ id: b.id, name: b.name }));

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>编辑商品</h1>
      <ProductForm categories={flatCategories} brands={brandOptions} product={product} />
    </div>
  );
}
