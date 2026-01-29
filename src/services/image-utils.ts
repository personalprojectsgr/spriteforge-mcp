import sharp from "sharp";
import * as fs from "fs/promises";
import * as path from "path";
import type { GeneratedImage } from "../types/index.js";

export async function getImageDimensions(base64: string): Promise<{ width: number; height: number }> {
  const buffer = Buffer.from(base64, "base64");
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width || 0,
    height: metadata.height || 0
  };
}

export async function resizeImage(
  base64: string,
  width: number,
  height: number,
  options?: {
    fit?: "cover" | "contain" | "fill" | "inside" | "outside";
    background?: string;
  }
): Promise<string> {
  const buffer = Buffer.from(base64, "base64");
  
  const resized = await sharp(buffer)
    .resize(width, height, {
      fit: options?.fit || "contain",
      background: options?.background || { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .toBuffer();
  
  return resized.toString("base64");
}

export async function convertFormat(
  base64: string,
  format: "png" | "jpg" | "webp",
  quality?: number
): Promise<string> {
  const buffer = Buffer.from(base64, "base64");
  let pipeline = sharp(buffer);

  switch (format) {
    case "png":
      pipeline = pipeline.png();
      break;
    case "jpg":
      pipeline = pipeline.jpeg({ quality: quality || 90 });
      break;
    case "webp":
      pipeline = pipeline.webp({ quality: quality || 90 });
      break;
  }

  const converted = await pipeline.toBuffer();
  return converted.toString("base64");
}

export async function assembleSpriteSheet(
  images: GeneratedImage[],
  options: {
    frameWidth: number;
    frameHeight: number;
    columns?: number;
    padding?: number;
    layout?: "horizontal" | "vertical" | "grid";
  }
): Promise<GeneratedImage> {
  const { frameWidth, frameHeight, padding = 0, layout = "horizontal" } = options;
  const frameCount = images.length;
  
  let columns: number;
  let rows: number;

  switch (layout) {
    case "horizontal":
      columns = frameCount;
      rows = 1;
      break;
    case "vertical":
      columns = 1;
      rows = frameCount;
      break;
    case "grid":
      columns = options.columns || Math.ceil(Math.sqrt(frameCount));
      rows = Math.ceil(frameCount / columns);
      break;
    default:
      columns = frameCount;
      rows = 1;
  }

  const sheetWidth = columns * frameWidth + (columns - 1) * padding;
  const sheetHeight = rows * frameHeight + (rows - 1) * padding;

  const compositeOperations: sharp.OverlayOptions[] = [];

  for (let i = 0; i < images.length; i++) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = col * (frameWidth + padding);
    const y = row * (frameHeight + padding);

    const buffer = Buffer.from(images[i].base64, "base64");
    const resized = await sharp(buffer)
      .resize(frameWidth, frameHeight, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    compositeOperations.push({
      input: resized,
      left: x,
      top: y
    });
  }

  const sheetBuffer = await sharp({
    create: {
      width: sheetWidth,
      height: sheetHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite(compositeOperations)
    .png()
    .toBuffer();

  return {
    base64: sheetBuffer.toString("base64"),
    format: "png",
    width: sheetWidth,
    height: sheetHeight
  };
}

export async function reducePalette(
  base64: string,
  colorCount: number
): Promise<string> {
  const buffer = Buffer.from(base64, "base64");
  
  const reduced = await sharp(buffer)
    .png({ palette: true, colours: colorCount })
    .toBuffer();
  
  return reduced.toString("base64");
}

export async function makeSeamless(base64: string): Promise<string> {
  const buffer = Buffer.from(base64, "base64");
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width || 256;
  const height = metadata.height || 256;

  const halfWidth = Math.floor(width / 2);
  const halfHeight = Math.floor(height / 2);

  const quadrants = await Promise.all([
    sharp(buffer).extract({ left: halfWidth, top: halfHeight, width: halfWidth, height: halfHeight }).toBuffer(),
    sharp(buffer).extract({ left: 0, top: halfHeight, width: halfWidth, height: halfHeight }).toBuffer(),
    sharp(buffer).extract({ left: halfWidth, top: 0, width: halfWidth, height: halfHeight }).toBuffer(),
    sharp(buffer).extract({ left: 0, top: 0, width: halfWidth, height: halfHeight }).toBuffer()
  ]);

  const seamless = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([
      { input: quadrants[0], left: 0, top: 0 },
      { input: quadrants[1], left: halfWidth, top: 0 },
      { input: quadrants[2], left: 0, top: halfHeight },
      { input: quadrants[3], left: halfWidth, top: halfHeight }
    ])
    .png()
    .toBuffer();

  return seamless.toString("base64");
}

export async function saveImage(
  image: GeneratedImage,
  outputPath: string
): Promise<string> {
  const dir = path.dirname(outputPath);
  await fs.mkdir(dir, { recursive: true });
  
  const buffer = Buffer.from(image.base64, "base64");
  await fs.writeFile(outputPath, buffer);
  
  return outputPath;
}

export async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export function generateFilename(
  prefix: string,
  format: string,
  suffix?: string
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const parts = [prefix, timestamp, random];
  if (suffix) parts.push(suffix);
  return `${parts.join("_")}.${format}`;
}
