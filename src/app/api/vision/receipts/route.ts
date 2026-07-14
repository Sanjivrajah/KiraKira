import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  extractReceiptFromImage,
  ReceiptExtractionConfigurationError,
} from "@/lib/openai/receipt-extraction";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const supportedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"] as const);
type SupportedImageType = "image/jpeg" | "image/png" | "image/webp";

export async function POST(request: Request) {
  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: "Send the receipt as multipart form data." }, { status: 400 });
    }
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "Choose a receipt image to continue." }, { status: 400 });
    }
    if (!supportedImageTypes.has(image.type as SupportedImageType)) {
      return NextResponse.json({ error: "Use a JPG, PNG, or WEBP image." }, { status: 415 });
    }
    if (image.size === 0 || image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Use an image between 1 byte and 10 MB." }, { status: 413 });
    }

    const extraction = await extractReceiptFromImage({
      bytes: new Uint8Array(await image.arrayBuffer()),
      mediaType: image.type as SupportedImageType,
    });
    return NextResponse.json({ extraction });
  } catch (error) {
    if (error instanceof ReceiptExtractionConfigurationError) {
      return NextResponse.json({ error: "Receipt extraction is not configured." }, { status: 503 });
    }
    if (error instanceof OpenAI.APIError) {
      console.error("OpenAI receipt extraction failed", {
        status: error.status,
        requestId: error.requestID,
        code: error.code,
      });
      return NextResponse.json({ error: "We could not read this receipt right now. Try again." }, { status: 502 });
    }

    console.error("Receipt extraction failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "We could not process this receipt." }, { status: 500 });
  }
}
