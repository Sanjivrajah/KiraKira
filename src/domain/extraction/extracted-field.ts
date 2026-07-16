export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  unit: "pixels" | "normalized";
}

export interface AudioTimestampRange {
  startMilliseconds: number;
  endMilliseconds: number;
}

export interface ExtractedField {
  fieldPath: string;
  originalText?: string;
  normalizedValue: JsonValue;
  confidence: number;
  evidenceText?: string;
  pageNumber?: number;
  boundingBox?: BoundingBox;
  audioTimestampRange?: AudioTimestampRange;
}
