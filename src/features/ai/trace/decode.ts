import jpeg from "jpeg-js";
import { PNG } from "pngjs";

/** A greyscale image: luminance from 0 (black) to 255 (white), row by row. */
export interface GrayImage {
    width: number;
    height: number;
    data: Uint8Array;
}

export type ImageKind = "png" | "jpeg" | "webp" | "gif" | "unknown";

/** The image couldn't be read (unsupported format, damaged or too large). */
export class ImageDecodeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ImageDecodeError";
    }
}

/** Decoded images larger than this are refused (about 5000 × 5000). */
const MAX_PIXELS = 25_000_000;

const ascii = (bytes: Uint8Array, start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));

/** The image format, from the file's first bytes (never from a Content-Type header). */
export function sniffImage(bytes: Uint8Array): ImageKind {
    if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(bytes, 1, 4) === "PNG") return "png";
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
    if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "webp";
    if (bytes.length >= 4 && ascii(bytes, 0, 4) === "GIF8") return "gif";
    return "unknown";
}

/**
 * Decodes a PNG or JPEG into luminance, with any transparency composited over white
 * (a transparent background reads as paper, not ink).
 */
export function decodeToGray(bytes: Uint8Array): GrayImage {
    const kind = sniffImage(bytes);
    let width: number;
    let height: number;
    let rgba: Uint8Array;

    try {
        if (kind === "png") {
            const png = PNG.sync.read(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
            ({ width, height } = png);
            rgba = png.data;
        } else if (kind === "jpeg") {
            const image = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true, maxResolutionInMP: 25, maxMemoryUsageInMB: 512 });
            ({ width, height } = image);
            rgba = image.data;
        } else {
            throw new ImageDecodeError(`unsupported image format (${kind})`);
        }
    } catch (error) {
        if (error instanceof ImageDecodeError) throw error;
        throw new ImageDecodeError(`the ${kind} image couldn't be decoded`);
    }

    if (!(width > 0 && height > 0) || width * height > MAX_PIXELS) throw new ImageDecodeError(`image size ${width}×${height} is out of range`);
    if (rgba.length < width * height * 4) throw new ImageDecodeError("the image data is incomplete");

    const data = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i++) {
        const o = i * 4;
        const alpha = rgba[o + 3] / 255;
        const luminance = 0.2126 * rgba[o] + 0.7152 * rgba[o + 1] + 0.0722 * rgba[o + 2];
        data[i] = Math.round(255 + (luminance - 255) * alpha);
    }
    return { width, height, data };
}

/** Shrinks the image (area average) so its longer side is at most `maxSide` pixels. */
export function downscale(image: GrayImage, maxSide: number): GrayImage {
    const { width, height, data } = image;
    const scale = maxSide / Math.max(width, height);
    if (scale >= 1) return image;

    const outWidth = Math.max(1, Math.round(width * scale));
    const outHeight = Math.max(1, Math.round(height * scale));
    const out = new Uint8Array(outWidth * outHeight);

    for (let ty = 0; ty < outHeight; ty++) {
        const y0 = Math.floor((ty * height) / outHeight);
        const y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * height) / outHeight));
        for (let tx = 0; tx < outWidth; tx++) {
            const x0 = Math.floor((tx * width) / outWidth);
            const x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * width) / outWidth));
            let sum = 0;
            for (let y = y0; y < y1; y++) {
                const row = y * width;
                for (let x = x0; x < x1; x++) sum += data[row + x];
            }
            out[ty * outWidth + tx] = Math.round(sum / ((y1 - y0) * (x1 - x0)));
        }
    }
    return { width: outWidth, height: outHeight, data: out };
}
