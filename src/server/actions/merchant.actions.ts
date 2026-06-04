"use server";

import { applyMerchantSchema } from "@/server/validations/merchant.validation";
import { createApplication } from "@/server/services/merchant.service";
import { getSessionUser } from "@/lib/auth";
import { ValidationError } from "@/lib/errors";

export type ApplyState = { error?: string; success?: boolean; merchantId?: string };

export async function applyMerchantAction(_prev: ApplyState, formData: FormData): Promise<ApplyState> {
  try {
    const raw = {
      name: formData.get("name") as string,
      type: formData.get("type") as "ENTERPRISE" | "INDIVIDUAL",
      businessLicense: (formData.get("businessLicense") as string) || undefined,
      legalPersonName: (formData.get("legalPersonName") as string) || undefined,
      legalPersonIdCard: (formData.get("legalPersonIdCard") as string) || undefined,
      registerNo: (formData.get("registerNo") as string) || undefined,
      contactName: formData.get("contactName") as string,
      contactPhone: formData.get("contactPhone") as string,
      contactEmail: (formData.get("contactEmail") as string) || undefined,
      bankAccountName: (formData.get("bankAccountName") as string) || undefined,
      bankAccountNo: (formData.get("bankAccountNo") as string) || undefined,
      bankName: (formData.get("bankName") as string) || undefined,
      logo: (formData.get("logo") as string) || undefined,
      description: (formData.get("description") as string) || undefined,
      address: (formData.get("address") as string) || undefined,
      password: (formData.get("password") as string) || undefined
    };

    const parsed = applyMerchantSchema.safeParse(raw);
    if (!parsed.success) {
      const firstError = parsed.error.issues?.[0];
      return { error: firstError?.message || "表单校验失败" };
    }

    const user = await getSessionUser();
    if (!user && !raw.password) {
      return { error: "请设置登录密码" };
    }
    const merchant = await createApplication({
      ...parsed.data,
      userId: user?.userId
    });

    return { success: true, merchantId: merchant.id };
  } catch (e) {
    if (e instanceof ValidationError) return { error: e.message };
    return { error: e instanceof Error ? e.message : "提交失败" };
  }
}
