import { Buffer } from "node:buffer";

import sharp from "sharp";

export async function renderStandingsPng(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).png().toBuffer();
}
