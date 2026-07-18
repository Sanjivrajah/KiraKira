import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  receiptExtractionSchema,
  validateReceiptArithmetic,
  type ReceiptExtraction,
} from "./receipt-schema";

const RECEIPT_EXTRACTION_PROMPT = `You extract reviewable transaction candidates from Malaysian receipts and supplier invoices.

Rules:
- Copy only values visible in the image. Use null when a value is absent or unreadable.
- Never infer a TIN, invoice number, date, amount, tax, payment method, or merchant name from context alone.
- Preserve short verbatim evidence text for each extracted field so the owner can review it.
- Dates must use YYYY-MM-DD when the full date is visible; otherwise return null and list the field as missing.
- Monetary values must be numeric and must not include currency symbols.
- Use MYR for RM or Malaysian ringgit. Otherwise copy the visible ISO currency code or return null.
- Category is a short owner-facing expense category based only on visible purchased items; use null when unclear.
- If the image contains more than one receipt, invoice, or separately totaled transaction, do not combine them. Add the warning "Multiple receipts or separately totaled transactions were detected."
- List ambiguous, unreadable, missing, or contradictory fields. Do not repair arithmetic silently.
- Confidence is review priority only, not proof that a value is true.`;

let openAIClient: OpenAI | undefined;

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ReceiptExtractionConfigurationError("OPENAI_API_KEY is not configured.");
  }
  openAIClient ??= new OpenAI({ apiKey });
  return openAIClient;
}

export class ReceiptExtractionConfigurationError extends Error {}

export async function extractReceiptFromImage({
  bytes,
  mediaType,
}: {
  bytes: Uint8Array;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
}): Promise<ReceiptExtraction> {
  const imageUrl = `data:${mediaType};base64,${Buffer.from(bytes).toString("base64")}`;
  const response = await getOpenAIClient().responses.parse({
    model: process.env.OPENAI_VISION_MODEL || "gpt-5.4",
    store: false,
    input: [{
      role: "user",
      content: [
        { type: "input_text", text: RECEIPT_EXTRACTION_PROMPT },
        { type: "input_image", image_url: imageUrl, detail: "high" },
      ],
    }],
    text: {
      format: zodTextFormat(receiptExtractionSchema, "receipt_extraction"),
    },
  });

  if (!response.output_parsed) {
    throw new Error("The model did not return a receipt extraction.");
  }

  const extraction = receiptExtractionSchema.parse(response.output_parsed);
  return {
    ...extraction,
    warnings: validateReceiptArithmetic(extraction),
  };
}
