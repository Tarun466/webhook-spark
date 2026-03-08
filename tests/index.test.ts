import { describe, it, expect } from "bun:test";
import { generateQRCode, generateASCIIQR } from "../src/index.js";

describe("QR code generation", () => {
  it("should generate SVG QR code", () => {
    const svg = generateQRCode("https://example.com");
    expect(svg).toStartWith("<svg");
    expect(svg).toInclude("rect");
    expect(svg).toInclude("21"); // Default version 1 size
  });

  it("should generate ASCII QR code", () => {
    const ascii = generateASCIIQR("TEST");
    expect(ascii).toBeString();
    expect(ascii.split('\n')[0].length).toEqual(ascii.split('\n')[1].length);
  });

  it("should handle margin options", () => {
    const ascii = generateASCIIQR("MARGIN", { margin: 4 });
    const lines = ascii.split('\n');
    expect(lines.length).toBeGreaterThan(21 + 8);
    expect(lines[0]).toMatch(/^\s{8}██/);
  });

  it("should throw on empty input", () => {
    expect(() => generateQRCode("")).toThrow("Input text cannot be empty");
    expect(() => generateASCIIQR("")).toThrow("Input text cannot be empty");
  });
});
