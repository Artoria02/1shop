import { z } from "zod";
import { MerchantType, MerchantStatus } from "@prisma/client";

export const merchantTypeValues = [MerchantType.ENTERPRISE, MerchantType.INDIVIDUAL] as const;
export const merchantStatusValues = [MerchantStatus.PENDING, MerchantStatus.APPROVED, MerchantStatus.REJECTED, MerchantStatus.DISABLED] as const;

export const applyMerchantSchema = z.object({
  name: z.string().min(1, "店铺名称不能为空").max(50, "店铺名称最多50个字符"),
  type: z.enum(merchantTypeValues),
  businessLicense: z.string().optional(),
  legalPersonName: z.string().optional(),
  legalPersonIdCard: z.string().optional(),
  registerNo: z.string().optional(),
  contactName: z.string().min(1, "联系人姓名不能为空"),
  contactPhone: z.string().min(1, "联系人手机号不能为空"),
  contactEmail: z.string().email("邮箱格式不正确").optional().or(z.literal("")),
  bankAccountName: z.string().optional(),
  bankAccountNo: z.string().optional(),
  bankName: z.string().optional(),
  logo: z.string().optional(),
  description: z.string().optional(),
  address: z.string().optional(),
  password: z.string().min(6, "密码至少6位").optional()
});

export const reviewMerchantSchema = z.object({
  status: z.enum([MerchantStatus.APPROVED, MerchantStatus.REJECTED, MerchantStatus.DISABLED]),
  reason: z.string().optional()
});

export type ApplyMerchantInput = z.infer<typeof applyMerchantSchema>;
export type ReviewMerchantInput = z.infer<typeof reviewMerchantSchema>;
