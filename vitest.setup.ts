import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

// Component and legacy repository tests exercise the explicit demo adapter.
// Production/runtime behavior defaults to Supabase when this toggle is absent.
process.env.NEXT_PUBLIC_AUTH_MODE = "demo";

window.scrollTo = () => undefined;

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

beforeEach(() => {
  localStorage.clear();
});

afterEach(cleanup);
