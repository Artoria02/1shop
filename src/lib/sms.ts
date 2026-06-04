const isDev = process.env.NODE_ENV !== "production";

export async function sendSms(phone: string, content: string): Promise<void> {
  if (isDev) {
    console.log(`[SMS DEV] To: ${phone} | Content: ${content}`);
    return;
  }

  // TODO: 接入短信服务商 SDK（阿里云 / 腾讯云）
  throw new Error("SMS service not configured for production");
}
