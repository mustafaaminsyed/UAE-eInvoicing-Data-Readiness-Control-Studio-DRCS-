import "@testing-library/jest-dom";
import { vi } from "vitest";

// Test-only safety defaults to avoid boot-time Supabase client errors when local env vars are absent.
// This does not alter production runtime behavior.
vi.stubEnv("VITE_SUPABASE_URL", process.env.VITE_SUPABASE_URL || "https://test-project.supabase.co");
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "test-publishable-key");

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
