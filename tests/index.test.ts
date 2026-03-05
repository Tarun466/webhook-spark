import { describe, it, expect, mock, beforeEach } from "bun:test";
import {
  generateSparkline,
  generateSparklineWithOutliers,
  generateASCIIArt,
  sendWebhook,
} from "../src/index.js";
import type {
  SparklineConfig,
  ASCIIArtConfig,
  WebhookPayload,
  WebhookConfig,
} from "../src/index.js";

describe("sparkline generation", () => {
  it("should generate a basic sparkline from numeric data", () => {
    const data = [1, 2, 3, 4, 5];
    const options: SparklineConfig = { width: 5, height: 8, dataPoints: data };
    const result = generateSparkline(data, options);
    expect(result).toBeString();
    expect(result.length).toBe(5);
    expect(result).toMatch(/^[▁▂▃▄▅▆▇█]+$/);
  });

  it("should throw on empty data array", () => {
    const options: SparklineConfig = { width: 5, height: 8, dataPoints: [] };
    expect(() => generateSparkline([], options)).toThrow("Data points array cannot be empty");
  });

  it("should handle all identical values", () => {
    const data = [42, 42, 42, 42];
    const options: SparklineConfig = { width: 4, height: 8, dataPoints: data };
    const result = generateSparkline(data, options);
    expect(result).toBeString();
    expect(result.length).toBe(4);
    expect(result).toBe("▅▅▅▅");
  });

  it("should respect min/max clamping", () => {
    const data = [0, 10, 20, 30, 40];
    const options: SparklineConfig = {
      width: 5,
      height: 8,
      minValue: 10,
      maxValue: 30,
      dataPoints: data,
    };
    const result = generateSparkline(data, options);
    expect(result).toBeString();
    expect(result.length).toBe(5);
    expect(result[0]).toBe("▂");
    expect(result[4]).toBe("█");
  });

  it("should detect outliers", () => {
    const data = [1, 2, 100, 3, 4];
    const options = {
      width: 5,
      height: 8,
      outlierBounds: { upper: 10 },
    } as any;
    const result = generateSparklineWithOutliers(data, options);
    expect(result.sparkline).toBeString();
    expect(result.outliers.indices).toEqual([2]);
    expect(result.outliers.values).toEqual([100]);
  });
});

describe("ASCII art generation", () => {
  it("should generate ASCII art with custom character set", () => {
    const data = [1, 2, 3, 4, 5];
    const config: ASCIIArtConfig = {
      characterSet: "·∙●○◉◎",
      invert: false,
    };
    const result = generateASCIIArt(data, config);
    expect(result).toBeString();
    expect(result.length).toBe(5);
    expect(result).toMatch(/^[·∙●○◉◎]+$/);
  });

  it("should apply padding", () => {
    const data = [1, 2, 3];
    const config: ASCIIArtConfig = {
      characterSet: "▁▂▃▄▅▆▇█",
      padding: { left: 2, right: 2, top: 1, bottom: 1 },
    };
    const result = generateASCIIArt(data, config);
    expect(result).toStartWith("\n");
    expect(result).toEndWith("\n");
    expect(result).toInclude("  ▁▄█  ");
  });
});

describe("webhook sending", () => {
  beforeEach(() => {
    mock.module("https", () => ({
      request: (options: any, callback: any) => {
        const mockRes = {
          statusCode: 200,
          statusMessage: "OK",
          on: (event: string, handler: any) => {
            if (event === "data") handler(Buffer.from("{}"));
            if (event === "end") handler();
          },
        };
        callback(mockRes);
        return {
          on: () => {},
          write: () => {},
          end: () => {},
        };
      },
    }));
  });

  it("should validate payload before sending", async () => {
    const payload: WebhookPayload = {
      timestamp: new Date(),
      metricName: "cpu_usage",
      sparkline: "▁▃█",
      rawValues: [1, 2, 3],
    };
    const config: WebhookConfig = {
      endpoint: "https://discord.com/api/webhooks/123",
      provider: "discord",
    };
    const response = await sendWebhook(payload, config);
    expect(response.success).toBeTrue();
    expect(response.statusCode).toBe(200);
  });

  it("should throw validation error for invalid payload", async () => {
    const payload = {
      timestamp: "not a date",
      metricName: "",
      sparkline: "",
      rawValues: [],
    } as unknown as WebhookPayload;
    const config: WebhookConfig = {
      endpoint: "https://discord.com/api/webhooks/123",
      provider: "discord",
    };
    await expect(sendWebhook(payload, config)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("should throw validation error for invalid config", async () => {
    const payload: WebhookPayload = {
      timestamp: new Date(),
      metricName: "cpu_usage",
      sparkline: "▁▃█",
      rawValues: [1, 2, 3],
    };
    const config = {
      endpoint: "not-a-url",
      provider: "discord",
    } as unknown as WebhookConfig;
    await expect(sendWebhook(payload, config)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });
});

describe("edge cases", () => {
  it("should handle negative values in sparkline", () => {
    const data = [-5, 0, 5];
    const options: SparklineConfig = { width: 3, height: 8, dataPoints: data };
    const result = generateSparkline(data, options);
    expect(result).toBeString();
    expect(result.length).toBe(3);
    expect(result[0]).toBe("▁");
    expect(result[2]).toBe("█");
  });

  it("should handle very large arrays with interpolation", () => {
    const data = Array.from({ length: 100 }, (_, i) => i);
    const options: SparklineConfig = { width: 10, height: 8, dataPoints: data };
    const result = generateSparkline(data, options);
    expect(result).toBeString();
    expect(result.length).toBe(10);
  });

  it("should throw on invalid character set", () => {
    const data = [1, 2, 3];
    const config: ASCIIArtConfig = {
      characterSet: "a" as any,
      invert: false,
    };
    expect(() => generateASCIIArt(data, config)).toThrow("Character set must contain at least 2 characters");
  });
});