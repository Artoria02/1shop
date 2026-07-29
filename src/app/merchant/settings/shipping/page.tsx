import { getSessionUser } from "@/lib/auth";
import { findById } from "@/server/services/merchant.service";
import ShippingForm from "./_components/shipping-form";

export default async function ShippingSettingsPage() {
  const user = await getSessionUser("MERCHANT");
  if (!user?.merchantId) return null;

  const merchant = await findById(user.merchantId);

  return <ShippingForm merchant={merchant} />;
}
