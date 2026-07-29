import { getSessionUser } from "@/lib/auth";
import { findById } from "@/server/services/merchant.service";
import PaymentForm from "./_components/payment-form";

export default async function PaymentSettingsPage() {
  const user = await getSessionUser("MERCHANT");
  if (!user?.merchantId) return null;

  const merchant = await findById(user.merchantId);

  return <PaymentForm merchant={merchant} />;
}
