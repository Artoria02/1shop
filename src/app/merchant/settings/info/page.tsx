import { getSessionUser } from "@/lib/auth";
import { findById } from "@/server/services/merchant.service";
import InfoForm from "./_components/info-form";

export default async function InfoSettingsPage() {
  const user = await getSessionUser("MERCHANT");
  if (!user?.merchantId) return null;

  const merchant = await findById(user.merchantId);

  return <InfoForm merchant={merchant} />;
}
