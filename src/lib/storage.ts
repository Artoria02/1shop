import { writeFile } from "fs/promises";
import { mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

export interface StorageProvider {
  saveFile(file: File, folder: string): Promise<string>;
}

class LocalStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor() {
    this.baseDir = join(process.cwd(), "public", "uploads");
  }

  async saveFile(file: File, folder: string): Promise<string> {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = this.getExtension(file.name);
    const filename = `${randomUUID()}${ext}`;
    const dir = join(this.baseDir, folder);
    const filepath = join(dir, filename);

    await mkdir(dir, { recursive: true });
    await writeFile(filepath, buffer);

    return `/uploads/${folder}/${filename}`;
  }

  private getExtension(filename: string): string {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (!ext) return "";
    return `.${ext}`;
  }
}

export const storage: StorageProvider = new LocalStorageProvider();

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function validateImage(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, error: `Unsupported file type: ${file.type}. Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}` };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Max: 5MB` };
  }
  return { valid: true };
}
