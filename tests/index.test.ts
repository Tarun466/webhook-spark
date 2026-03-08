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

  it("should support custom dark color in SVG", () => {
    const svg = generateQRCode("test", { darkColor: '#ff0000' });
    expect(svg).toInclude('fill="#ff0000"');
    expect(svg).toInclude('fill="#ffffff"'); // default light color
  });

  it("should support custom light color in SVG", () => {
    const svg = generateQRCode("test", { lightColor: '#00ff00' });
    expect(svg).toInclude('fill="#00ff00"');
    expect(svg).toInclude('fill="#000000"'); // default dark color
  });

  it("should support both custom colors in SVG", () => {
    const svg = generateQRCode("test", { 
      darkColor: '#123456', 
      lightColor: '#abcdef' 
    });
    expect(svg).toInclude('fill="#123456"');
    expect(svg).toInclude('fill="#abcdef"');
  });

  it("should use default colors when not specified", () => {
    const svg = generateQRCode("test");
    expect(svg).toInclude('fill="#000000"');
    expect(svg).toInclude('fill="#ffffff"');
  });

  it("should support hex colors with shorthand", () => {
    const svg = generateQRCode("test", { 
      darkColor: '#f00', 
      lightColor: '#0f0' 
    });
    expect(svg).toInclude('fill="#f00"');
    expect(svg).toInclude('fill="#0f0"');
  });
});
