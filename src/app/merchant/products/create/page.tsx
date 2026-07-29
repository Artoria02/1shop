import { requireSessionUser } from "@/lib/auth";
import { findActiveTree } from "@/server/services/category.service";
import { findMany as findBrands } from "@/server/services/brand.service";
import ProductForm from "../_components/product-form";

export default async function CreateProductPage() {
  const user = await requireSessionUser("MERCHANT");

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
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>发布商品</h1>
      <ProductForm categories={flatCategories} brands={brandOptions} />
    </div>
  );
}
