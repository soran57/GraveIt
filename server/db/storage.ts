import fs from "fs";
import path from "path";

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export const storageProvider = {
  /**
   * Saves a file buffer locally and returns the public URL.
   */
  async uploadFile(fileBuffer: Buffer, contentType: string, filename: string): Promise<string> {
    const filepath = path.join(uploadsDir, filename);
    await fs.promises.writeFile(filepath, fileBuffer);
    
    // Return the relative URL served by Express
    return `/uploads/${filename}`;
  }
};
