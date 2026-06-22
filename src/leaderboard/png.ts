import { Buffer } from "node:buffer";

import sharp from "sharp";

export async function renderLeaderboardPng(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).png().toBuffer();
}
