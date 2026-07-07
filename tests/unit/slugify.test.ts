import { describe, it, expect } from "vitest";
import { slugify, uniqueSlug } from "@/lib/utils/slugify";

describe("slugify", () => {
  it("lowercases and dashes spaces", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });
  it("strips diacritics", () => {
    expect(slugify("Cómo publicar en 2025")).toBe("como-publicar-en-2025");
  });
  it("removes unsafe characters", () => {
    expect(slugify("What's up?! 2025!")).toBe("whats-up-2025");
  });
  it("trims dashes", () => {
    expect(slugify("  ---foo---  ")).toBe("foo");
  });
  it("falls back to a hash when input is empty", () => {
    const s = slugify("");
    expect(s).toMatch(/^post-[a-z0-9]{6}$/);
  });
  it("caps at 64 chars", () => {
    const long = "a".repeat(200);
    expect(slugify(long).length).toBe(64);
  });
});

describe("uniqueSlug", () => {
  it("returns base if not taken", () => {
    expect(uniqueSlug("foo", ["bar", "baz"])).toBe("foo");
  });
  it("appends suffix until unique", () => {
    expect(uniqueSlug("foo", ["foo", "foo-2"])).toBe("foo-3");
  });
  it("handles many taken", () => {
    expect(uniqueSlug("x", ["x", "x-2", "x-3", "x-4"])).toBe("x-5");
  });
});
