import { z } from "zod";

export const updateInfoSchema = z.object({
  name: z.string().min(1, "店铺名称不能为空").max(50, "店铺名称最多50个字符"),
  logo: z.string().optional(),
  description: z.string().optional(),
  address: z.string().optional(),
  businessLicense: z.string().optional(),
  legalPersonName: z.string().optional(),
  legalPersonIdCard: z.string().optional(),
  registerNo: z.string().optional(),
  contactName: z.string().min(1, "联系人姓名不能为空"),
  contactPhone: z.string().min(1, "联系人手机号不能为空"),
  contactEmail: z.string().email("邮箱格式不正确").optional().or(z.literal("")),
});

export const updatePaymentSchema = z.object({
  bankAccountName: z.string().optional(),
  bankAccountNo: z.string().optional(),
  bankName: z.string().optional(),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, "请输入原密码"),
  newPassword: z.string().min(6, "新密码至少6位"),
  confirmPassword: z.string().min(1, "请确认新密码"),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "两次输入的密码不一致",
  path: ["confirmPassword"],
});

export type UpdateInfoInput = z.infer<typeof updateInfoSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
