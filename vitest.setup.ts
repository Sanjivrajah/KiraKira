import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

// Component and legacy repository tests exercise the explicit demo adapter.
// Production/runtime behavior defaults to Supabase when this toggle is absent.
process.env.NEXT_PUBLIC_AUTH_MODE = "demo";

window.scrollTo = () => undefined;

beforeEach(() => {
  localStorage.clear();
});

afterEach(cleanup);
