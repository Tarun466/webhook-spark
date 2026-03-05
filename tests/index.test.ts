import { describe, it, expect, mock, beforeEach } from "bun:test";
import {
  generateSparkline,
  generateSparklineWithOutliers,
  generateASCIIArt,
  sendWebhook,
  gauge,
  stats,
  sparkWithStatus,
  dashboard,
  kaomoji,
  kaomojiAll,
  kaomojiStatus,
  kaomojiThemes,
  heatmap,
  miniTable,
  kvTable,
  histogram,
  compare,
  socialFormat,
  thread,
  buildInPublic,
  socialCaption,
  tree,
  progressBar,
  calendarHeatmap,
  brailleSpark,
  candlestick,
  timeline,
  boxDiagram,
  multiSpark,
  diffBar,
  matrix,
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

describe("gauge", () => {
  it("should generate basic gauge with default options", () => {
    const result = gauge(75, 100);
    expect(result).toInclude("75%");
    expect(result).toInclude("\u2588");
    expect(result).toInclude("\u2591");
  });

  it("should use custom width and fill/empty characters", () => {
    const result = gauge(6, 20, { width: 10, fill: "#", empty: "." });
    expect(result).toInclude("###.......");
    expect(result).toInclude("30%");
  });

  it("should include label prefix", () => {
    const result = gauge(3.7, 4.2, { label: "BATT" });
    expect(result).toStartWith("BATT ");
    expect(result).toInclude("88%");
  });

  it("should append threshold status", () => {
    const result = gauge(92, 100, { thresholds: { warning: 70, critical: 90 } });
    expect(result).toInclude("CRITICAL");

    const warnResult = gauge(75, 100, { thresholds: { warning: 70, critical: 90 } });
    expect(warnResult).toInclude("WARNING");
    expect(warnResult).not.toInclude("CRITICAL");
  });
});

describe("stats", () => {
  it("should compute basic statistics", () => {
    const result = stats([10, 20, 30, 40, 50]);
    expect(result.min).toBe(10);
    expect(result.max).toBe(50);
    expect(result.avg).toBe(30);
    expect(result.median).toBe(30);
    expect(result.count).toBe(5);
    expect(result.sum).toBe(150);
    expect(result.stdDev).toBeGreaterThan(0);
  });

  it("should calculate percentiles", () => {
    const result = stats(Array.from({ length: 100 }, (_, i) => i + 1), { percentiles: [95, 99] });
    expect(result.percentiles[95]).toBeGreaterThanOrEqual(95);
    expect(result.percentiles[99]).toBeGreaterThanOrEqual(99);
  });

  it("should handle single-value array", () => {
    const result = stats([42]);
    expect(result.min).toBe(42);
    expect(result.max).toBe(42);
    expect(result.avg).toBe(42);
    expect(result.median).toBe(42);
    expect(result.stdDev).toBe(0);
  });

  it("should produce summary string", () => {
    const result = stats([10, 20, 30, 40, 50]);
    expect(result.summary).toInclude("min=10");
    expect(result.summary).toInclude("max=50");
    expect(result.summary).toInclude("avg=30");
    expect(result.summary).toInclude("p95=");
  });
});

describe("sparkWithStatus", () => {
  it("should return ok when all values below thresholds", () => {
    const result = sparkWithStatus([10, 20, 30], { warning: 50, critical: 80 });
    expect(result.status).toBe("ok");
    expect(result.emoji).toBe("\u2705");
    expect(result.color).toBe(0x2ecc71);
    expect(result.breachCount).toBe(0);
  });

  it("should detect warning threshold breach", () => {
    const result = sparkWithStatus([45, 50, 62, 78], { warning: 70, critical: 90 });
    expect(result.status).toBe("warning");
    expect(result.breachCount).toBe(1);
    expect(result.breachPercent).toBe(25);
  });

  it("should detect critical threshold breach", () => {
    const result = sparkWithStatus([45, 50, 62, 78, 95], { warning: 70, critical: 90 });
    expect(result.status).toBe("critical");
    expect(result.emoji).toBe("\ud83d\udd34");
    expect(result.color).toBe(0xe74c3c);
    expect(result.breachCount).toBe(2);
  });

  it("should support inverted mode (low = bad)", () => {
    const result = sparkWithStatus([15, 10, 5, 3], { warning: 10, critical: 5, invert: true });
    expect(result.status).toBe("critical");
    expect(result.breachCount).toBeGreaterThanOrEqual(2);
  });
});

describe("dashboard", () => {
  const testMetrics = [
    { name: "CPU", values: [45, 50, 62, 78], unit: "%", thresholds: { warning: 70, critical: 90 } },
    { name: "MEM", values: [78, 80, 82, 85], unit: "%", thresholds: { warning: 80, critical: 95 } },
    { name: "DISK", values: [62, 63, 63, 64], unit: "%", thresholds: { warning: 85, critical: 95 } },
    { name: "TEMP", values: [42, 44, 45, 43], unit: "\u00b0C", thresholds: { warning: 60, critical: 75 } },
  ];

  it("should render multi-metric full mode with sparklines", () => {
    const result = dashboard(testMetrics);
    const lines = result.split("\n");
    expect(lines.length).toBe(4);
    expect(lines[0]).toInclude("CPU");
    expect(lines[3]).toInclude("TEMP");
  });

  it("should render compact mode without sparklines", () => {
    const result = dashboard(testMetrics, { compact: true });
    const lines = result.split("\n");
    expect(lines.length).toBe(4);
    // Compact lines are shorter (no sparkline chars)
    for (const line of lines) {
      expect(line).not.toInclude("\u2581");
    }
  });

  it("should show mixed statuses across metrics", () => {
    const result = dashboard(testMetrics);
    // CPU 78% → warning, MEM 85% → warning, DISK/TEMP → ok
    expect(result).toInclude("\u26a0\ufe0f");
    expect(result).toInclude("\u2705");
  });

  it("should align names with different lengths", () => {
    const mixedNames = [
      { name: "A", values: [50], unit: "%" },
      { name: "LONGNAME", values: [50], unit: "%" },
    ];
    const result = dashboard(mixedNames);
    const lines = result.split("\n");
    // First line should be padded to match longest name
    expect(lines[0]).toStartWith("A       ");
  });
});

// --- v0.4.0 Tests ---

describe("kaomoji", () => {
  it("should return a classic happy face", () => {
    const result = kaomoji("happy");
    expect(result).toBeString();
    expect(result).toBe("(*^▽^*)");
  });

  it("should return a cat face with cats theme", () => {
    const result = kaomoji("happy", { theme: "cats" });
    expect(result).toBe("ᓚᘏᗢ");
  });

  it("should map value to ok mood via kaomojiStatus", () => {
    const result = kaomojiStatus(50, 100);
    expect(result.mood).toBe("ok");
    expect(result.face).toBeString();
  });

  it("should detect critical via kaomojiStatus with custom thresholds", () => {
    const result = kaomojiStatus(95, 100, { thresholds: { warning: 70, critical: 90 } });
    expect(result.mood).toBe("critical");
  });

  it("should return multiple faces from kaomojiAll", () => {
    const faces = kaomojiAll("happy");
    expect(faces.length).toBeGreaterThanOrEqual(3);
    for (const f of faces) expect(f).toBeString();
  });

  it("should list all themes", () => {
    const themes = kaomojiThemes();
    expect(themes).toContain("classic");
    expect(themes).toContain("cats");
    expect(themes).toContain("bears");
    expect(themes).toContain("stars");
    expect(themes).toContain("minimal");
  });

  it("should fallback gracefully for unknown theme/mood combo", () => {
    // All moods should have entries in all themes
    const result = kaomoji("dead", { theme: "minimal" });
    expect(result).toBeString();
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("heatmap", () => {
  it("should render a 3x4 grid with 3 lines", () => {
    const result = heatmap([[2, 5, 8, 3], [1, 7, 9, 4], [3, 6, 7, 2]]);
    const lines = result.split("\n");
    expect(lines.length).toBe(3);
  });

  it("should use all middle chars for same values", () => {
    const result = heatmap([[5, 5], [5, 5]]);
    // All same → maps to middle index
    const chars = [" ", "░", "▒", "▓", "█"];
    const midChar = chars[2]; // ▒
    expect(result).toInclude(midChar);
  });

  it("should use custom chars", () => {
    const result = heatmap([[0, 5, 10]], { chars: [".", "o", "O", "@", "#"] });
    expect(result).toInclude(".");
    expect(result).toInclude("#");
  });

  it("should show row labels when enabled", () => {
    const result = heatmap([[1, 2], [3, 4]], {
      showLabels: true,
      rowLabels: ["Mon", "Tue"],
    });
    expect(result).toInclude("Mon");
    expect(result).toInclude("Tue");
  });

  it("should return empty string for empty data", () => {
    expect(heatmap([])).toBe("");
  });

  it("should handle jagged rows gracefully", () => {
    const result = heatmap([[1, 2, 3], [4]]);
    const lines = result.split("\n");
    expect(lines.length).toBe(2);
  });
});

describe("miniTable", () => {
  it("should render a kvTable with all keys and values", () => {
    const result = kvTable([
      { key: "CPU", value: "78%" },
      { key: "MEM", value: "4.2GB" },
      { key: "DISK", value: "120GB" },
    ]);
    expect(result).toInclude("CPU");
    expect(result).toInclude("78%");
    expect(result).toInclude("MEM");
    expect(result).toInclude("4.2GB");
    expect(result).toInclude("DISK");
  });

  it("should add separator line after header row", () => {
    const result = miniTable(
      [["Name", "Value"], ["CPU", "78%"]],
      { header: true }
    );
    expect(result).toInclude("├");
    expect(result).toInclude("┼");
  });

  it("should not include box chars with border none", () => {
    const result = miniTable(
      [["A", "B"], ["C", "D"]],
      { border: "none" }
    );
    expect(result).not.toInclude("│");
    expect(result).not.toInclude("┌");
    expect(result).not.toInclude("└");
  });

  it("should auto-size columns to longest cell", () => {
    const result = miniTable([
      ["Short", "X"],
      ["LongerLabel", "YY"],
    ]);
    // Both rows should have same-width structure
    const lines = result.split("\n");
    // Top and bottom borders should be same length
    expect(lines[0].length).toBe(lines[lines.length - 1].length);
  });

  it("should return empty string for empty rows", () => {
    expect(miniTable([])).toBe("");
  });

  it("should render rounded borders", () => {
    const result = miniTable([["A", "B"]], { border: "rounded" });
    expect(result).toInclude("╭");
    expect(result).toInclude("╯");
  });

  it("should return empty string for empty kvTable", () => {
    expect(kvTable([])).toBe("");
  });
});

describe("histogram", () => {
  it("should produce correct number of lines for 5 bins", () => {
    const result = histogram([1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 5, 5, 5, 5, 5], { bins: 5 });
    const lines = result.split("\n");
    expect(lines.length).toBe(5);
  });

  it("should handle all-same values with 1 effective bin", () => {
    const result = histogram([7, 7, 7, 7], { bins: 3 });
    const lines = result.split("\n");
    // All values go into first bin since range is 0
    expect(lines.length).toBe(3);
    expect(result).toInclude("█");
  });

  it("should show percentages when enabled", () => {
    const result = histogram([1, 2, 3], { bins: 3, percentages: true });
    expect(result).toInclude("%");
  });

  it("should use custom fill character", () => {
    const result = histogram([1, 2, 3, 4, 5], { bins: 5, fill: "#" });
    expect(result).toInclude("#");
    expect(result).not.toInclude("█");
  });

  it("should handle single value", () => {
    const result = histogram([42], { bins: 3 });
    expect(result).toBeString();
    expect(result.split("\n").length).toBe(3);
  });

  it("should handle negative values", () => {
    const result = histogram([-5, -3, 0, 2, 4], { bins: 3 });
    expect(result).toInclude("-");
  });

  it("should return empty string for empty array", () => {
    expect(histogram([])).toBe("");
  });
});

describe("compare", () => {
  it("should detect upward change", () => {
    const result = compare("Before", 45, "After", 78);
    expect(result.delta).toBe(33);
    expect(result.direction).toBe("up");
    expect(result.arrow).toBe("↑");
    expect(result.deltaPercent).toBeGreaterThan(0);
    expect(result.display).toInclude("Before");
    expect(result.display).toInclude("After");
  });

  it("should detect downward change", () => {
    const result = compare("Before", 100, "After", 60);
    expect(result.delta).toBe(-40);
    expect(result.direction).toBe("down");
    expect(result.arrow).toBe("↓");
  });

  it("should detect same values", () => {
    const result = compare("A", 50, "B", 50);
    expect(result.delta).toBe(0);
    expect(result.direction).toBe("same");
    expect(result.arrow).toBe("→");
  });

  it("should compute avg-based delta for arrays", () => {
    const result = compare("Week1", [10, 20, 30], "Week2", [15, 25, 35]);
    expect(result.delta).toBe(5);
    expect(result.direction).toBe("up");
  });

  it("should render compact mode as single line", () => {
    const result = compare("Plan", 100, "Actual", 87, { mode: "compact", unit: "%" });
    expect(result.display).not.toInclude("\n");
    expect(result.display).toInclude("Plan");
    expect(result.display).toInclude("Actual");
    expect(result.display).toInclude("%");
  });

  it("should render spark mode with sparklines for arrays", () => {
    const result = compare("Week1", [10, 20, 30], "Week2", [15, 25, 35], { mode: "spark" });
    expect(result.display).toInclude("avg=");
    expect(result.display).toInclude("↑");
  });

  it("should handle val1=0 without division error", () => {
    const result = compare("Before", 0, "After", 10);
    expect(result.delta).toBe(10);
    expect(result.direction).toBe("up");
    expect(result.deltaPercent).toBe(100);
  });

  it("should handle both values zero", () => {
    const result = compare("A", 0, "B", 0);
    expect(result.delta).toBe(0);
    expect(result.direction).toBe("same");
    expect(result.deltaPercent).toBe(0);
  });
});

// --- v0.5.0 Tests ---

describe("socialFormat", () => {
  it("should return text under X limit without truncation", () => {
    const result = socialFormat("Hello world", { platform: "x" });
    expect(result.text).toBe("Hello world");
    expect(result.truncated).toBe(false);
    expect(result.limit).toBe(280);
    expect(result.platform).toBe("x");
  });

  it("should truncate long text for X", () => {
    const longText = "A".repeat(300);
    const result = socialFormat(longText, { platform: "x" });
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(280);
    expect(result.text).toEndWith("...");
  });

  it("should append hashtags", () => {
    const result = socialFormat("Status update", {
      platform: "x",
      hashtags: ["buildinpublic", "devops"],
    });
    expect(result.text).toInclude("#buildinpublic");
    expect(result.text).toInclude("#devops");
  });

  it("should not double-hash already prefixed tags", () => {
    const result = socialFormat("Hi", { hashtags: ["#test"] });
    expect(result.text).toInclude("#test");
    expect(result.text).not.toInclude("##test");
  });

  it("should respect Bluesky 300 char limit", () => {
    const result = socialFormat("A".repeat(350), { platform: "bluesky" });
    expect(result.limit).toBe(300);
    expect(result.text.length).toBeLessThanOrEqual(300);
    expect(result.truncated).toBe(true);
  });

  it("should respect Instagram 2200 char limit", () => {
    const result = socialFormat("Short post", { platform: "instagram" });
    expect(result.limit).toBe(2200);
    expect(result.truncated).toBe(false);
  });

  it("should use custom maxLength override", () => {
    const result = socialFormat("A".repeat(200), { maxLength: 100 });
    expect(result.limit).toBe(100);
    expect(result.text.length).toBeLessThanOrEqual(100);
  });

  it("should use custom truncation marker", () => {
    const result = socialFormat("A".repeat(300), { platform: "x", truncationMarker: " [more]" });
    expect(result.text).toEndWith("[more]");
  });
});

describe("thread", () => {
  it("should return single post for short text", () => {
    const result = thread("Hello world", { platform: "x" });
    expect(result.count).toBe(1);
    expect(result.posts[0]).toBe("Hello world");
  });

  it("should split long text into multiple posts", () => {
    const paragraphs = Array.from({ length: 10 }, (_, i) =>
      `Paragraph ${i + 1}: ${"word ".repeat(30)}`
    ).join("\n\n");
    const result = thread(paragraphs, { platform: "x" });
    expect(result.count).toBeGreaterThan(1);
    for (const post of result.posts) {
      expect(post.length).toBeLessThanOrEqual(280);
    }
  });

  it("should add numbering to multi-post threads", () => {
    const paragraphs = Array.from({ length: 10 }, (_, i) =>
      `Paragraph ${i + 1}: ${"word ".repeat(30)}`
    ).join("\n\n");
    const result = thread(paragraphs, { platform: "x", numbering: true });
    expect(result.posts[0]).toInclude("(1/");
    expect(result.posts[result.count - 1]).toInclude(`(${result.count}/${result.count})`);
  });

  it("should not add numbering to single post", () => {
    const result = thread("Short", { numbering: true });
    expect(result.posts[0]).toBe("Short");
  });

  it("should include header in first post", () => {
    const result = thread("Body text here", { header: "THREAD:" });
    expect(result.posts[0]).toStartWith("THREAD:");
  });

  it("should include footer in last post", () => {
    const result = thread("Body text", { footer: "Follow for more!" });
    expect(result.posts[result.count - 1]).toInclude("Follow for more!");
  });

  it("should return empty array for empty text", () => {
    const result = thread("");
    expect(result.count).toBe(0);
    expect(result.posts.length).toBe(0);
  });

  it("should respect Mastodon 500 char limit", () => {
    const long = "A ".repeat(400);
    const result = thread(long, { platform: "mastodon" });
    for (const post of result.posts) {
      expect(post.length).toBeLessThanOrEqual(500);
    }
  });
});

describe("buildInPublic", () => {
  const testMetrics = [
    { name: "Users", values: [100, 120, 150, 180], unit: "", thresholds: { warning: 200, critical: 500 } },
    { name: "Revenue", values: [50, 75, 90, 110], unit: "$", thresholds: { warning: 200, critical: 1000 } },
    { name: "Uptime", values: [99.9, 99.8, 99.95, 99.99], unit: "%", thresholds: { warning: 99, critical: 95 } },
  ];

  it("should include project name", () => {
    const result = buildInPublic(testMetrics, { project: "webhook-spark" });
    expect(result).toInclude("webhook-spark");
  });

  it("should include metric names and values", () => {
    const result = buildInPublic(testMetrics);
    expect(result).toInclude("Users");
    expect(result).toInclude("Revenue");
    expect(result).toInclude("Uptime");
    expect(result).toInclude("180");
    expect(result).toInclude("110$");
  });

  it("should include trend arrows", () => {
    const result = buildInPublic(testMetrics);
    expect(result).toMatch(/[↑↓→]/);
  });

  it("should include sparklines by default", () => {
    const result = buildInPublic(testMetrics);
    expect(result).toMatch(/[▁▂▃▄▅▆▇█]/);
  });

  it("should omit sparklines when disabled", () => {
    const result = buildInPublic(testMetrics, { includeSparklines: false });
    expect(result).not.toMatch(/[▁▂▃▄▅▆▇█]/);
  });

  it("should include kaomoji", () => {
    const result = buildInPublic(testMetrics, { kaomoji: true });
    // Should have at least one kaomoji face (mood summary at end)
    expect(result.length).toBeGreaterThan(50);
  });

  it("should include hashtags", () => {
    const result = buildInPublic(testMetrics, { hashtags: ["buildinpublic", "saas"] });
    expect(result).toInclude("#buildinpublic");
    expect(result).toInclude("#saas");
  });

  it("should default to buildinpublic hashtag", () => {
    const result = buildInPublic(testMetrics);
    expect(result).toInclude("#buildinpublic");
  });
});

describe("socialCaption", () => {
  it("should join sections with separator", () => {
    const result = socialCaption([
      { title: "What", body: "Built a thing" },
      { title: "Why", body: "Because reasons" },
    ]);
    expect(result).toInclude("What");
    expect(result).toInclude("Built a thing");
    expect(result).toInclude("Why");
    expect(result).toInclude("Because reasons");
  });

  it("should include emoji prefix on titled sections", () => {
    const result = socialCaption([
      { title: "Metrics", body: "CPU 78%", emoji: "📊" },
    ]);
    expect(result).toInclude("📊 Metrics");
  });

  it("should append hashtags", () => {
    const result = socialCaption(
      [{ body: "Hello" }],
      { hashtags: ["devops", "monitoring"] }
    );
    expect(result).toInclude("#devops");
    expect(result).toInclude("#monitoring");
  });

  it("should append CTA", () => {
    const result = socialCaption(
      [{ body: "Check this out" }],
      { cta: "Link in bio!" }
    );
    expect(result).toInclude("Link in bio!");
  });

  it("should truncate for Instagram limit", () => {
    const longBody = "A".repeat(2500);
    const result = socialCaption([{ body: longBody }], { platform: "instagram" });
    expect(result.length).toBeLessThanOrEqual(2200);
    expect(result).toEndWith("...");
  });

  it("should use custom separator", () => {
    const result = socialCaption(
      [{ body: "Part 1" }, { body: "Part 2" }],
      { separator: "\n---\n" }
    );
    expect(result).toInclude("---");
  });

  it("should handle single section without title", () => {
    const result = socialCaption([{ body: "Just a caption" }]);
    expect(result).toBe("Just a caption");
  });
});

// --- v0.6.0 Tests ---

describe("tree", () => {
  it("should render a flat list", () => {
    const result = tree([{ label: "a" }, { label: "b" }, { label: "c" }]);
    expect(result).toInclude("a");
    expect(result).toInclude("b");
    expect(result).toInclude("c");
    const lines = result.split("\n");
    expect(lines.length).toBe(3);
  });

  it("should render nested children", () => {
    const result = tree([{
      label: "src",
      children: [{ label: "index.ts" }, { label: "utils.ts" }]
    }]);
    expect(result).toInclude("src");
    expect(result).toInclude("index.ts");
    expect(result).toInclude("utils.ts");
    const lines = result.split("\n");
    expect(lines.length).toBe(3);
  });

  it("should use ascii style", () => {
    const result = tree([{ label: "root", children: [{ label: "child" }] }, { label: "sibling" }], { style: "ascii" });
    expect(result).toInclude("|-- root");
  });

  it("should use rounded style by default", () => {
    const result = tree([{ label: "a" }, { label: "b" }]);
    expect(result).toInclude("├");
    expect(result).toInclude("└");
  });

  it("should use bold style", () => {
    const result = tree([{ label: "a" }], { style: "bold" });
    expect(result).toInclude("┗");
  });

  it("should use double style", () => {
    const result = tree([{ label: "a" }], { style: "double" });
    expect(result).toInclude("╚");
  });

  it("should handle deeply nested trees", () => {
    const result = tree([{
      label: "1",
      children: [{ label: "1.1", children: [{ label: "1.1.1" }] }]
    }]);
    expect(result.split("\n").length).toBe(3);
    expect(result).toInclude("1.1.1");
  });

  it("should handle multiple roots", () => {
    const result = tree([{ label: "a" }, { label: "b" }]);
    expect(result.split("\n").length).toBe(2);
  });

  it("should return empty string for empty input", () => {
    expect(tree([])).toBe("");
  });

  it("should support prefix option", () => {
    const result = tree([{ label: "item" }], { prefix: ">> " });
    expect(result).toStartWith(">> ");
  });
});

describe("progressBar", () => {
  it("should render basic pipeline", () => {
    const result = progressBar([
      { label: "Build", status: "done" },
      { label: "Test", status: "active" },
      { label: "Deploy", status: "pending" },
    ]);
    expect(result).toInclude("Build");
    expect(result).toInclude("Test");
    expect(result).toInclude("Deploy");
  });

  it("should show correct icons for line style", () => {
    const result = progressBar([
      { label: "A", status: "done" },
      { label: "B", status: "failed" },
    ], { style: "line" });
    expect(result).toInclude("✅");
    expect(result).toInclude("❌");
  });

  it("should use dots style", () => {
    const result = progressBar([
      { label: "A", status: "done" },
      { label: "B", status: "pending" },
    ], { style: "dots" });
    expect(result).toInclude("●");
    expect(result).toInclude("○");
  });

  it("should use blocks style", () => {
    const result = progressBar([
      { label: "A", status: "done" },
    ], { style: "blocks" });
    expect(result).toInclude("█");
  });

  it("should use arrows style", () => {
    const result = progressBar([
      { label: "A", status: "active" },
    ], { style: "arrows" });
    expect(result).toInclude("►");
  });

  it("should use custom separator", () => {
    const result = progressBar([
      { label: "A", status: "done" },
      { label: "B", status: "done" },
    ], { separator: " → " });
    expect(result).toInclude("→");
  });

  it("should handle single step", () => {
    const result = progressBar([{ label: "Only", status: "active" }]);
    expect(result).toInclude("Only");
    expect(result).not.toInclude("▸");
  });

  it("should return empty for empty input", () => {
    expect(progressBar([])).toBe("");
  });

  it("should handle all statuses", () => {
    const result = progressBar([
      { label: "A", status: "done" },
      { label: "B", status: "active" },
      { label: "C", status: "pending" },
      { label: "D", status: "failed" },
    ]);
    expect(result.split(" ▸ ").length).toBe(4);
  });

  it("should include all labels in output", () => {
    const result = progressBar([
      { label: "Init", status: "done" },
      { label: "Process", status: "done" },
      { label: "Finish", status: "pending" },
    ]);
    expect(result).toInclude("Init");
    expect(result).toInclude("Process");
    expect(result).toInclude("Finish");
  });
});

describe("calendarHeatmap", () => {
  const sampleData = [
    { date: "2025-01-06", value: 3 },
    { date: "2025-01-07", value: 5 },
    { date: "2025-01-08", value: 1 },
    { date: "2025-01-09", value: 7 },
    { date: "2025-01-10", value: 2 },
  ];

  it("should render a heatmap with 7 rows (days of week)", () => {
    const result = calendarHeatmap(sampleData);
    const lines = result.split("\n");
    // month header + 7 day rows
    expect(lines.length).toBe(8);
  });

  it("should show month labels by default", () => {
    const result = calendarHeatmap(sampleData);
    expect(result).toInclude("Jan");
  });

  it("should hide month labels when disabled", () => {
    const result = calendarHeatmap(sampleData, { showMonths: false });
    expect(result).not.toInclude("Jan");
  });

  it("should return empty for empty data", () => {
    expect(calendarHeatmap([])).toBe("");
  });

  it("should use custom chars", () => {
    const result = calendarHeatmap(sampleData, { chars: [".", "o", "O", "@", "#"] });
    // Should contain at least some of our custom chars
    expect(result).toMatch(/[.oO@#]/);
  });

  it("should show day labels when enabled", () => {
    const result = calendarHeatmap(sampleData, { showDays: true });
    expect(result).toInclude("Mo");
  });

  it("should handle single entry", () => {
    const result = calendarHeatmap([{ date: "2025-06-15", value: 10 }]);
    expect(result).toBeString();
    expect(result.length).toBeGreaterThan(0);
  });

  it("should handle entries spanning multiple months", () => {
    const data = [
      { date: "2025-01-15", value: 1 },
      { date: "2025-02-15", value: 5 },
      { date: "2025-03-15", value: 10 },
    ];
    const result = calendarHeatmap(data);
    expect(result).toInclude("Jan");
    expect(result).toInclude("Feb");
    expect(result).toInclude("Mar");
  });

  it("should handle all same values", () => {
    const data = [
      { date: "2025-01-06", value: 5 },
      { date: "2025-01-07", value: 5 },
    ];
    const result = calendarHeatmap(data);
    expect(result).toBeString();
  });

  it("should sort entries by date", () => {
    const data = [
      { date: "2025-01-10", value: 10 },
      { date: "2025-01-06", value: 1 },
    ];
    const result = calendarHeatmap(data);
    expect(result).toBeString();
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("brailleSpark", () => {
  it("should render a basic braille sparkline", () => {
    const result = brailleSpark([1, 3, 5, 7, 9, 7, 5, 3]);
    expect(result).toBeString();
    expect(result.length).toBeGreaterThan(0);
    // Should contain braille chars (U+2800-U+28FF)
    for (const ch of result) {
      if (ch !== "\n") {
        const code = ch.charCodeAt(0);
        expect(code).toBeGreaterThanOrEqual(0x2800);
        expect(code).toBeLessThanOrEqual(0x28FF);
      }
    }
  });

  it("should return empty for empty input", () => {
    expect(brailleSpark([])).toBe("");
  });

  it("should handle single value", () => {
    const result = brailleSpark([5]);
    expect(result).toBeString();
    expect(result.length).toBeGreaterThan(0);
  });

  it("should handle all same values", () => {
    const result = brailleSpark([5, 5, 5, 5]);
    expect(result).toBeString();
  });

  it("should support multi-row height", () => {
    const result = brailleSpark([1, 5, 10, 5, 1], { height: 2 });
    const lines = result.split("\n");
    expect(lines.length).toBe(2);
  });

  it("should support filled mode", () => {
    const result = brailleSpark([1, 3, 5, 7], { filled: true });
    expect(result).toBeString();
    expect(result.length).toBeGreaterThan(0);
  });

  it("should support custom min/max", () => {
    const result = brailleSpark([50, 60, 70], { min: 0, max: 100 });
    expect(result).toBeString();
  });

  it("should handle two values (one braille char)", () => {
    const result = brailleSpark([0, 10]);
    expect(result).toBeString();
    expect(result.replace(/\n/g, "").length).toBe(1);
  });

  it("should handle odd number of values", () => {
    const result = brailleSpark([1, 2, 3]);
    expect(result).toBeString();
    // ceil(3/2) = 2 chars
    expect(result.replace(/\n/g, "").length).toBe(2);
  });

  it("should produce different output for ascending vs descending", () => {
    const asc = brailleSpark([1, 2, 3, 4]);
    const desc = brailleSpark([4, 3, 2, 1]);
    expect(asc).not.toBe(desc);
  });
});

describe("candlestick", () => {
  const sampleCandles = [
    { open: 10, high: 15, low: 5, close: 12 },
    { open: 12, high: 18, low: 10, close: 8 },
    { open: 8, high: 14, low: 6, close: 13 },
  ];

  it("should render a chart with correct height", () => {
    const result = candlestick(sampleCandles, { height: 10 });
    const lines = result.split("\n");
    expect(lines.length).toBe(10);
  });

  it("should use default height of 10", () => {
    const result = candlestick(sampleCandles);
    const lines = result.split("\n");
    expect(lines.length).toBe(10);
  });

  it("should return empty for empty input", () => {
    expect(candlestick([])).toBe("");
  });

  it("should handle single candle", () => {
    const result = candlestick([{ open: 10, high: 15, low: 5, close: 12 }]);
    expect(result).toBeString();
    expect(result.split("\n").length).toBe(10);
  });

  it("should show bull char for close >= open", () => {
    const result = candlestick([{ open: 5, high: 10, low: 1, close: 8 }]);
    expect(result).toInclude("█"); // default bull char
  });

  it("should show bear char for close < open", () => {
    const result = candlestick([{ open: 8, high: 10, low: 1, close: 5 }]);
    expect(result).toInclude("░"); // default bear char
  });

  it("should use custom bull/bear chars", () => {
    const result = candlestick(
      [{ open: 5, high: 10, low: 1, close: 8 }],
      { bullChar: "#", bearChar: "." }
    );
    expect(result).toInclude("#");
  });

  it("should handle doji (open == close)", () => {
    const result = candlestick([{ open: 10, high: 15, low: 5, close: 10 }]);
    expect(result).toBeString();
  });

  it("should handle all same values", () => {
    const result = candlestick([{ open: 5, high: 5, low: 5, close: 5 }]);
    expect(result).toBeString();
  });

  it("should handle multiple candles with varying range", () => {
    const candles = [
      { open: 100, high: 150, low: 80, close: 120 },
      { open: 120, high: 200, low: 100, close: 90 },
    ];
    const result = candlestick(candles, { height: 8 });
    expect(result.split("\n").length).toBe(8);
  });
});

describe("timeline", () => {
  const sampleEvents = [
    { label: "Build", start: 0, duration: 5 },
    { label: "Test", start: 5, duration: 5 },
    { label: "Deploy", start: 10, duration: 5 },
  ];

  it("should render events with correct number of lines", () => {
    const result = timeline(sampleEvents);
    const lines = result.split("\n");
    // 1 scale line + 3 event lines
    expect(lines.length).toBe(4);
  });

  it("should include event labels", () => {
    const result = timeline(sampleEvents);
    expect(result).toInclude("Build");
    expect(result).toInclude("Test");
    expect(result).toInclude("Deploy");
  });

  it("should return empty for empty input", () => {
    expect(timeline([])).toBe("");
  });

  it("should hide scale when disabled", () => {
    const result = timeline(sampleEvents, { showScale: false });
    const lines = result.split("\n");
    expect(lines.length).toBe(3); // just event lines
  });

  it("should use custom fill and empty chars", () => {
    const result = timeline(sampleEvents, { fill: "#", empty: "." });
    expect(result).toInclude("#");
    expect(result).toInclude(".");
  });

  it("should show unit in scale", () => {
    const result = timeline(sampleEvents, { unit: "days" });
    expect(result).toInclude("days");
  });

  it("should handle single event", () => {
    const result = timeline([{ label: "Only", start: 0, duration: 10 }]);
    expect(result).toInclude("Only");
  });

  it("should handle overlapping events", () => {
    const events = [
      { label: "A", start: 0, duration: 10 },
      { label: "B", start: 5, duration: 10 },
    ];
    const result = timeline(events);
    expect(result).toInclude("A");
    expect(result).toInclude("B");
  });

  it("should respect custom width", () => {
    const result = timeline(sampleEvents, { width: 20 });
    const lines = result.split("\n");
    // Should have event lines with bars
    expect(lines.length).toBeGreaterThan(1);
    expect(result).toInclude("Build");
  });

  it("should handle events starting at different offsets", () => {
    const events = [
      { label: "Early", start: 0, duration: 3 },
      { label: "Late", start: 7, duration: 3 },
    ];
    const result = timeline(events);
    expect(result).toBeString();
  });
});

describe("boxDiagram", () => {
  const sampleBoxes = [
    { label: "Ingest" },
    { label: "Transform" },
    { label: "Load" },
  ];

  it("should render horizontal flowchart with 3 lines", () => {
    const result = boxDiagram(sampleBoxes);
    const lines = result.split("\n");
    expect(lines.length).toBe(3); // top, middle, bottom
  });

  it("should include all labels", () => {
    const result = boxDiagram(sampleBoxes);
    expect(result).toInclude("Ingest");
    expect(result).toInclude("Transform");
    expect(result).toInclude("Load");
  });

  it("should return empty for empty input", () => {
    expect(boxDiagram([])).toBe("");
  });

  it("should render vertical direction", () => {
    const result = boxDiagram(sampleBoxes, { direction: "vertical" });
    const lines = result.split("\n");
    // 3 boxes x 3 lines each + 2 arrows = 11
    expect(lines.length).toBe(11);
    expect(result).toInclude("▼");
  });

  it("should use single style by default", () => {
    const result = boxDiagram([{ label: "A" }]);
    expect(result).toInclude("┌");
    expect(result).toInclude("┘");
  });

  it("should use rounded style", () => {
    const result = boxDiagram([{ label: "A" }], { style: "rounded" });
    expect(result).toInclude("╭");
    expect(result).toInclude("╯");
  });

  it("should use double style", () => {
    const result = boxDiagram([{ label: "A" }], { style: "double" });
    expect(result).toInclude("╔");
    expect(result).toInclude("╝");
  });

  it("should use bold style", () => {
    const result = boxDiagram([{ label: "A" }], { style: "bold" });
    expect(result).toInclude("┏");
    expect(result).toInclude("┛");
  });

  it("should include arrow between boxes", () => {
    const result = boxDiagram([{ label: "A" }, { label: "B" }]);
    expect(result).toInclude("▶");
  });

  it("should handle single box without arrows", () => {
    const result = boxDiagram([{ label: "Solo" }]);
    expect(result).not.toInclude("▶");
    expect(result).toInclude("Solo");
  });
});

describe("multiSpark", () => {
  const sampleSeries = [
    { label: "CPU", values: [10, 30, 50, 70, 90], unit: "%" },
    { label: "Memory", values: [40, 45, 50, 55, 60], unit: "%" },
    { label: "Disk", values: [10, 10, 11, 11, 12], unit: "%" },
  ];

  it("should render one line per series", () => {
    const result = multiSpark(sampleSeries);
    const lines = result.split("\n");
    expect(lines.length).toBe(3);
  });

  it("should include all labels", () => {
    const result = multiSpark(sampleSeries);
    expect(result).toInclude("CPU");
    expect(result).toInclude("Memory");
    expect(result).toInclude("Disk");
  });

  it("should show peak values by default", () => {
    const result = multiSpark(sampleSeries);
    expect(result).toInclude("peak=90%");
    expect(result).toInclude("peak=60%");
    expect(result).toInclude("peak=12%");
  });

  it("should hide peak when disabled", () => {
    const result = multiSpark(sampleSeries, { showPeak: false });
    expect(result).not.toInclude("peak=");
  });

  it("should show trend when enabled", () => {
    const result = multiSpark(sampleSeries, { showTrend: true });
    expect(result).toMatch(/[↑↓→]/);
  });

  it("should return empty for empty input", () => {
    expect(multiSpark([])).toBe("");
  });

  it("should align labels by padding", () => {
    const result = multiSpark(sampleSeries);
    const lines = result.split("\n");
    // CPU should be padded to match Memory length
    expect(lines[0]).toStartWith("CPU   ");
  });

  it("should include sparkline characters", () => {
    const result = multiSpark(sampleSeries);
    expect(result).toMatch(/[▁▂▃▄▅▆▇█]/);
  });

  it("should respect width option", () => {
    const result = multiSpark([
      { label: "A", values: [1,2,3,4,5,6,7,8,9,10] }
    ], { width: 5 });
    // Should only use last 5 values for sparkline
    expect(result).toBeString();
  });

  it("should handle series without unit", () => {
    const result = multiSpark([{ label: "X", values: [1, 5, 10] }]);
    expect(result).toInclude("peak=10");
    expect(result).not.toInclude("peak=10%");
  });
});

describe("diffBar", () => {
  const sampleItems = [
    { label: "CPU", before: 60, after: 85 },
    { label: "Mem", before: 80, after: 75 },
    { label: "Disk", before: 50, after: 50 },
  ];

  it("should render one line per item", () => {
    const result = diffBar(sampleItems);
    const lines = result.split("\n");
    expect(lines.length).toBe(3);
  });

  it("should include all labels", () => {
    const result = diffBar(sampleItems);
    expect(result).toInclude("CPU");
    expect(result).toInclude("Mem");
    expect(result).toInclude("Disk");
  });

  it("should show up arrow for increases", () => {
    const result = diffBar([{ label: "A", before: 10, after: 20 }]);
    expect(result).toInclude("↑");
  });

  it("should show down arrow for decreases", () => {
    const result = diffBar([{ label: "A", before: 20, after: 10 }]);
    expect(result).toInclude("↓");
  });

  it("should show right arrow for no change", () => {
    const result = diffBar([{ label: "A", before: 50, after: 50 }]);
    expect(result).toInclude("→");
  });

  it("should return empty for empty input", () => {
    expect(diffBar([])).toBe("");
  });

  it("should include divider character", () => {
    const result = diffBar(sampleItems);
    expect(result).toInclude("▕");
  });

  it("should show delta values by default", () => {
    const result = diffBar([{ label: "A", before: 10, after: 20 }]);
    expect(result).toInclude("10→20");
  });

  it("should show percentage by default", () => {
    const result = diffBar([{ label: "A", before: 10, after: 20 }]);
    expect(result).toInclude("100%");
  });

  it("should support custom unit", () => {
    const result = diffBar([{ label: "A", before: 10, after: 20 }], { unit: "ms" });
    expect(result).toInclude("10ms→20ms");
  });
});

describe("matrix", () => {
  it("should render 5 rows for single character", () => {
    const result = matrix("A");
    const lines = result.split("\n");
    expect(lines.length).toBe(5);
  });

  it("should render text with block style by default", () => {
    const result = matrix("HI");
    expect(result).toInclude("█");
  });

  it("should support dots style", () => {
    const result = matrix("A", { style: "dots" });
    expect(result).toInclude("●");
  });

  it("should support braille style", () => {
    const result = matrix("A", { style: "braille" });
    expect(result).toInclude("⣿");
  });

  it("should return empty for empty string", () => {
    expect(matrix("")).toBe("");
  });

  it("should handle numbers", () => {
    const result = matrix("123");
    expect(result).toBeString();
    expect(result.split("\n").length).toBe(5);
  });

  it("should handle spaces", () => {
    const result = matrix("A B");
    expect(result.split("\n").length).toBe(5);
  });

  it("should be case insensitive", () => {
    const upper = matrix("HELLO");
    const lower = matrix("hello");
    expect(upper).toBe(lower);
  });

  it("should handle unknown characters as spaces", () => {
    const result = matrix("@");
    expect(result).toBeString();
    expect(result.split("\n").length).toBe(5);
  });

  it("should support scale option", () => {
    const result = matrix("A", { scale: 2 });
    const lines = result.split("\n");
    expect(lines.length).toBe(10); // 5 rows * 2 scale
  });
});