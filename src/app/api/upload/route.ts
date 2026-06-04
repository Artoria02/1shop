import { NextRequest } from "next/server";
import { success, fail } from "@/lib/api-response";
import { storage, validateImage } from "@/lib/storage";
import { requireSessionUser } from "@/lib/auth";
import { ForbiddenError, ValidationError, UnauthorizedError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUser();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "general";

    if (!file) {
      throw new ValidationError("No file provided");
    }

    const validation = validateImage(file);
    if (!validation.valid) {
      throw new ValidationError(validation.error || "Invalid file");
    }

    // Restrict folders by user kind
    const allowedFolders: Record<string, string[]> = {
      BUYER: ["avatars"],
      MERCHANT_STAFF: ["merchants", "products"],
      PLATFORM_ADMIN: ["merchants", "products", "brands", "categories"]
    };

    const userAllowed = allowedFolders[user.end] || [];
    if (!userAllowed.includes(folder)) {
      throw new ForbiddenError(`Upload to folder '${folder}' is not allowed for your role`);
    }

    const url = await storage.saveFile(file, folder);
    return success({ url });
  } catch (error) {
    if (error instanceof ValidationError) {
      return fail(error.message, error.code, 422);
    }
    if (error instanceof ForbiddenError) {
      return fail(error.message, error.code, 403);
    }
    if (error instanceof UnauthorizedError) {
      return fail(error.message, error.code, 401);
    }
    console.error("Upload error:", error);
    return fail(error instanceof Error ? error.message : "Upload failed", "UPLOAD_ERROR", 500);
  }
}
