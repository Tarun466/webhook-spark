import type { SparklineConfig, SparklineCharacterSet, ASCIIArtConfig, GaugeOptions, StatsOptions, StatsResult, ThresholdConfig, SparkStatusResult, DashboardMetric, DashboardOptions, KaomojiMood, KaomojiTheme, KaomojiOptions, KaomojiStatusOptions, KaomojiResult, HeatmapOptions, MiniTableOptions, HistogramOptions, CompareOptions, CompareResult, SocialPlatform, SocialFormatOptions, SocialFormatResult, ThreadOptions, ThreadResult, BuildInPublicOptions, SocialCaptionSection, SocialCaptionOptions, TreeNode, TreeOptions, TreeStyle, ProgressStep, ProgressBarOptions, ProgressBarStyle, CalendarEntry, CalendarHeatmapOptions, BrailleSparkOptions, CandleData, CandlestickOptions, TimelineEvent, TimelineOptions, BoxNode, BoxDiagramOptions, BoxDiagramStyle, SparkSeries, MultiSparkOptions, DiffBarItem, DiffBarOptions, MatrixOptions } from "./types.js";

const DEFAULT_CHARACTER_SET: SparklineCharacterSet = "▁▂▃▄▅▆▇█";
const BLOCK_CHARACTERS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

export interface SparklineOptions {
  readonly minValue?: number;
  readonly maxValue?: number;
  readonly width: number;
  readonly height: number;
  readonly includeAxis?: boolean;
  readonly characterSet?: SparklineCharacterSet;
  readonly invert?: boolean;
  readonly outlierBounds?: {
    readonly lower?: number;
    readonly upper?: number;
  };
}

function normalizeValue(
  value: number,
  dataMin: number,
  dataMax: number,
  height: number,
  minClamp?: number,
  maxClamp?: number
): number {
  let clamped = value;
  if (minClamp !== undefined) clamped = Math.max(clamped, minClamp);
  if (maxClamp !== undefined) clamped = Math.min(clamped, maxClamp);

  if (dataMax === dataMin) return Math.floor(height / 2);

  const normalized = (clamped - dataMin) / (dataMax - dataMin);
  const scaled = normalized * (height - 1);
  return Math.max(0, Math.min(height - 1, scaled));
}

function interpolateData(
  data: readonly number[],
  width: number,
  dataMin: number,
  dataMax: number,
  height: number,
  minClamp?: number,
  maxClamp?: number
): number[] {
  if (data.length === 0) return Array(width).fill(0);
  if (data.length === width) {
    return data.map(v => normalizeValue(v, dataMin, dataMax, height, minClamp, maxClamp));
  }

  const result: number[] = [];
  for (let i = 0; i < width; i++) {
    const pos = (i / (width - 1)) * (data.length - 1);
    const leftIdx = Math.floor(pos);
    const rightIdx = Math.ceil(pos);
    const fraction = pos - leftIdx;

    if (leftIdx === rightIdx) {
      const val = data[leftIdx];
      result.push(normalizeValue(val, dataMin, dataMax, height, minClamp, maxClamp));
    } else {
      const leftVal = data[leftIdx];
      const rightVal = data[rightIdx];
      const interpolated = leftVal + (rightVal - leftVal) * fraction;
      result.push(normalizeValue(interpolated, dataMin, dataMax, height, minClamp, maxClamp));
    }
  }
  return result;
}

function detectOutliers(
  data: readonly number[],
  lowerBound?: number,
  upperBound?: number
): { indices: number[]; values: number[] } {
  const outliers: number[] = [];
  const outlierValues: number[] = [];

  data.forEach((value, index) => {
    if (lowerBound !== undefined && value < lowerBound) {
      outliers.push(index);
      outlierValues.push(value);
    } else if (upperBound !== undefined && value > upperBound) {
      outliers.push(index);
      outlierValues.push(value);
    }
  });

  return { indices: outliers, values: outlierValues };
}

function getCharactersFromSet(set: SparklineCharacterSet, invert: boolean): string[] {
  if (set === "▁▂▃▄▅▆▇█") {
    return invert ? [...BLOCK_CHARACTERS].reverse() : BLOCK_CHARACTERS;
  }

  const chars = Array.from(set);
  if (chars.length < 2) {
    throw new Error("Character set must contain at least 2 characters");
  }
  return invert ? chars.reverse() : chars;
}

function mapToCharacter(value: number, height: number, characters: string[]): string {
  const step = (height - 1) / (characters.length - 1);
  const index = Math.min(characters.length - 1, Math.floor(value / step));
  return characters[index];
}

export function generateSparkline(
  dataPoints: readonly number[],
  options: SparklineOptions
): string {
  if (dataPoints.length === 0) {
    throw new Error("Data points array cannot be empty");
  }
  if (options.width <= 0) {
    throw new Error("Width must be positive");
  }
  if (options.height <= 0) {
    throw new Error("Height must be positive");
  }

  const {
    minValue,
    maxValue,
    width,
    height,
    includeAxis = false,
    characterSet = DEFAULT_CHARACTER_SET,
    invert = false,
    outlierBounds
  } = options;

  const dataMin = Math.min(...dataPoints);
  const dataMax = Math.max(...dataPoints);

  const characters = getCharactersFromSet(characterSet, invert);
  const normalized = interpolateData(dataPoints, width, dataMin, dataMax, height, minValue, maxValue);
  const sparkline = normalized.map(v => mapToCharacter(v, height, characters)).join("");

  if (includeAxis) {
    const axisLine = "─".repeat(width);
    return `${sparkline}\n${axisLine}`;
  }

  return sparkline;
}

export function generateSparklineWithOutliers(
  dataPoints: readonly number[],
  options: SparklineOptions
): { sparkline: string; outliers: { indices: number[]; values: number[] } } {
  const sparkline = generateSparkline(dataPoints, options);
  const outliers = detectOutliers(dataPoints, options.outlierBounds?.lower, options.outlierBounds?.upper);
  return { sparkline, outliers };
}

/**
 * Simple sparkline from just an array of numbers.
 * Returns a single line of block characters (▁▂▃▄▅▆▇█).
 */
export function spark(values: readonly number[]): string {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return BLOCK_CHARACTERS[3].repeat(values.length);
  return values.map(v => {
    const idx = Math.round(((v - min) / (max - min)) * (BLOCK_CHARACTERS.length - 1));
    return BLOCK_CHARACTERS[idx];
  }).join("");
}

/**
 * Horizontal bar chart as text lines.
 * Each entry: "label ████████ value"
 */
export function barChart(
  entries: readonly { label: string; value: number }[],
  options?: { maxBarWidth?: number; showValues?: boolean }
): string {
  if (entries.length === 0) return "";
  const maxWidth = options?.maxBarWidth ?? 20;
  const showValues = options?.showValues ?? true;
  const maxVal = Math.max(...entries.map(e => e.value));
  const maxLabelLen = Math.max(...entries.map(e => e.label.length));

  return entries.map(e => {
    const barLen = maxVal === 0 ? 0 : Math.round((e.value / maxVal) * maxWidth);
    const bar = "█".repeat(barLen);
    const label = e.label.padEnd(maxLabelLen);
    return showValues ? `${label} ${bar} ${e.value}` : `${label} ${bar}`;
  }).join("\n");
}

/**
 * Trend indicator: ↑ ↓ → based on last N values.
 */
export function trend(values: readonly number[], window: number = 3): string {
  if (values.length < 2) return "→";
  const recent = values.slice(-window);
  const first = recent[0];
  const last = recent[recent.length - 1];
  const diff = last - first;
  const threshold = Math.abs(first) * 0.05 || 0.01;
  if (diff > threshold) return "↑";
  if (diff < -threshold) return "↓";
  return "→";
}

export function generateASCIIArt(
  dataPoints: readonly number[],
  config: ASCIIArtConfig
): string {
  const { characterSet, invert = false, padding } = config;
  const characters = getCharactersFromSet(characterSet, invert);

  const dataMin = Math.min(...dataPoints);
  const dataMax = Math.max(...dataPoints);
  const height = characters.length - 1;

  const normalized = dataPoints.map(v => {
    if (dataMax === dataMin) return Math.floor(height / 2);
    return ((v - dataMin) / (dataMax - dataMin)) * height;
  });

  let result = normalized.map(v => {
    const index = Math.min(characters.length - 1, Math.floor(v));
    return characters[index];
  }).join("");

  if (padding) {
    const leftPad = " ".repeat(padding.left);
    const rightPad = " ".repeat(padding.right);
    const topPad = "\n".repeat(padding.top);
    const bottomPad = "\n".repeat(padding.bottom);
    result = `${topPad}${leftPad}${result}${rightPad}${bottomPad}`;
  }

  return result;
}

/**
 * Progress/level gauge bar.
 * gauge(75, 100) → "████████████████░░░░ 75%"
 */
export function gauge(value: number, max: number, options?: GaugeOptions): string {
  const width = options?.width ?? 20;
  const fill = options?.fill ?? "\u2588";
  const empty = options?.empty ?? "\u2591";
  const showPercent = options?.showPercent ?? true;
  const showValue = options?.showValue ?? false;
  const label = options?.label;
  const thresholds = options?.thresholds;

  const ratio = Math.max(0, Math.min(1, value / max));
  const filled = Math.round(ratio * width);
  const bar = fill.repeat(filled) + empty.repeat(width - filled);
  const pct = Math.round(ratio * 100);

  const parts: string[] = [];
  if (label) parts.push(label);
  parts.push(bar);
  if (showPercent) parts.push(`${pct}%`);
  if (showValue) parts.push(`${value}/${max}`);

  if (thresholds) {
    if (thresholds.critical !== undefined && pct >= thresholds.critical) {
      parts.push("CRITICAL");
    } else if (thresholds.warning !== undefined && pct >= thresholds.warning) {
      parts.push("WARNING");
    }
  }

  return parts.join(" ");
}

/**
 * Summary statistics for a numeric array.
 */
export function stats(values: readonly number[], options?: StatsOptions): StatsResult {
  const decimals = options?.decimals ?? 2;
  const pctiles = options?.percentiles ?? [95];

  const count = values.length;
  if (count === 0) {
    return { min: 0, max: 0, avg: 0, median: 0, stdDev: 0, percentiles: {}, count: 0, sum: 0, summary: "no data" };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((s, v) => s + v, 0);
  const avg = sum / count;
  const min = sorted[0];
  const max = sorted[count - 1];

  const mid = Math.floor(count / 2);
  const median = count % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / count;
  const stdDev = Math.sqrt(variance);

  const percentiles: Record<number, number> = {};
  for (const p of pctiles) {
    const idx = (p / 100) * (count - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    const frac = idx - lo;
    percentiles[p] = lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * frac;
  }

  const r = (n: number) => Number(n.toFixed(decimals));

  const pctStr = pctiles.map(p => `p${p}=${r(percentiles[p])}`).join(" ");
  const summary = `min=${r(min)} max=${r(max)} avg=${r(avg)} ${pctStr}`;

  return { min: r(min), max: r(max), avg: r(avg), median: r(median), stdDev: r(stdDev), percentiles, count, sum: r(sum), summary };
}

/**
 * Sparkline with threshold status evaluation.
 */
export function sparkWithStatus(
  values: readonly number[],
  thresholds: ThresholdConfig
): SparkStatusResult {
  const sparkline = spark(values);
  const { warning, critical, invert = false } = thresholds;

  let breachCount = 0;
  let maxSeverity: "ok" | "warning" | "critical" = "ok";

  for (const v of values) {
    const isCritBreach = critical !== undefined && (invert ? v <= critical : v >= critical);
    const isWarnBreach = warning !== undefined && (invert ? v <= warning : v >= warning);

    if (isCritBreach) {
      breachCount++;
      maxSeverity = "critical";
    } else if (isWarnBreach) {
      breachCount++;
      if (maxSeverity !== "critical") maxSeverity = "warning";
    }
  }

  const breachPercent = values.length > 0 ? Math.round((breachCount / values.length) * 100) : 0;

  const statusMap = {
    ok: { emoji: "\u2705", color: 0x2ecc71 },
    warning: { emoji: "\u26a0\ufe0f", color: 0xf39c12 },
    critical: { emoji: "\ud83d\udd34", color: 0xe74c3c },
  };

  return {
    sparkline,
    status: maxSeverity,
    emoji: statusMap[maxSeverity].emoji,
    color: statusMap[maxSeverity].color,
    breachCount,
    breachPercent,
  };
}

/**
 * Multi-metric compact dashboard display.
 */
export function dashboard(
  metrics: readonly DashboardMetric[],
  options?: DashboardOptions
): string {
  const compact = options?.compact ?? false;
  const defaultSparkWidth = options?.sparkWidth ?? 8;
  const align = options?.align ?? true;
  const separator = options?.separator ?? "\n";

  const maxNameLen = align ? Math.max(...metrics.map(m => m.name.length)) : 0;

  const lines = metrics.map(m => {
    const name = align ? m.name.padEnd(maxNameLen) : m.name;
    const lastVal = m.values[m.values.length - 1];
    const unit = m.unit ?? "";
    const valStr = `${lastVal}${unit}`;

    if (m.thresholds) {
      const result = sparkWithStatus(m.values, m.thresholds);
      if (compact) {
        return `${name} ${valStr} ${result.emoji}`;
      }
      const sw = m.sparkWidth ?? defaultSparkWidth;
      const trimmedValues = m.values.slice(-sw);
      const sparkStr = spark(trimmedValues);
      return `${name} ${valStr.padStart(6)} ${sparkStr} ${result.emoji}`;
    }

    if (compact) {
      return `${name} ${valStr}`;
    }
    const sw = m.sparkWidth ?? defaultSparkWidth;
    const trimmedValues = m.values.slice(-sw);
    const sparkStr = spark(trimmedValues);
    return `${name} ${valStr.padStart(6)} ${sparkStr}`;
  });

  return lines.join(separator);
}

// --- v0.4.0: Kaomoji, Heatmap, Table, Histogram, Compare ---

const KAOMOJI_DICT: Record<KaomojiTheme, Record<KaomojiMood, readonly string[]>> = {
  classic: {
    happy: ["(*^▽^*)", "(´｡• ᵕ •｡`)", "(✿◠‿◠)", "(❁´◡`❁)"],
    ok: ["(・_・)", "(¬_¬)", "(─‿─)"],
    warning: ["(・_・;)", "(°△°|||)", "(⊙_⊙;)"],
    critical: ["(╥_╥)", "(×_×;)", "(☍﹏⁰)"],
    sad: ["(╥﹏╥)", "(T_T)", "(;_;)"],
    angry: ["(╬▔皿▔)╯", "(ノಠ益ಠ)ノ", "(`Д´)"],
    love: ["(♥‿♥)", "(◕‿◕)♡", "(´,,•ω•,,)♡"],
    surprised: ["(⊙_⊙)", "(°o°)", "(○o○)"],
    sleeping: ["(-.-)Zzz", "(¦3[▓▓]", "(∪｡∪)｡｡｡zzz"],
    working: ["(•̀ᴗ•́)و", "(╯°□°)╯", "( •_•)>⌐■-■"],
    celebrating: ["☆*:.｡.o(≧▽≦)o.｡.:*☆", "ヽ(>∀<☆)ノ", "\\(★ω★)/"],
    confused: ["(？_？)", "(⊙.⊙)?", "(¬‿¬ )"],
    dead: ["(×_×)", "(✖╭╮✖)", "(☠_☠)"],
  },
  cats: {
    happy: ["ᓚᘏᗢ", "(=^・ω・^=)", "(=①ω①=)"],
    ok: ["(=・ω・=)", "(=^-ω-^=)", "(=｀ω´=)"],
    warning: ["(=ↀωↀ=)", "(=xェx=)", "(=;ェ;=)"],
    critical: ["(=✖ω✖=)", "(=☓ω☓=)", "(=✘ω✘=)"],
    sad: ["(=T_T=)", "(=;ω;=)", "(=TェT=)"],
    angry: ["(=`ω´=)ノ", "(=`皿´=)", "(=▼ω▼=)"],
    love: ["(=♡ω♡=)", "(=^-ω-^=)♡", "(=◕ᆺ◕=)♡"],
    surprised: ["(=⊙ω⊙=)", "(=OωO=)", "(=°ω°=)"],
    sleeping: ["(=- ω -=)zzZ", "(=^-ω-^=)zzz", "(=- ェ -=)"],
    working: ["(=•̀ω•́=)و", "(=^ω^=)✧", "(=ↀωↀ=)✧"],
    celebrating: ["(=^▽^=)☆", "(=✧ω✧=)☆", "ヽ(=^▽^=)ノ"],
    confused: ["(=？ω？=)", "(=⊙ω⊙=)?", "(=~ω~=)"],
    dead: ["(=✖_✖=)", "(=×ω×=)", "(=☠ω☠=)"],
  },
  bears: {
    happy: ["ʕ•ᴥ•ʔ", "ʕ·ᴥ·ʔ", "ʕ♡ᴥ♡ʔ"],
    ok: ["ʕ-ᴥ-ʔ", "ʕ·ᴥ·ʔ", "ʕᵔᴥᵔʔ"],
    warning: ["ʕ⊙ᴥ⊙ʔ", "ʕ;ᴥ;ʔ", "ʕ°ᴥ°ʔ!"],
    critical: ["ʕ×ᴥ×ʔ", "ʕ✖ᴥ✖ʔ", "ʕ╥ᴥ╥ʔ"],
    sad: ["ʕ╥ᴥ╥ʔ", "ʕTᴥTʔ", "ʕ;ᴥ;ʔ"],
    angry: ["ʕ`ᴥ´ʔ", "ʕ▼ᴥ▼ʔ", "ʕ◣ᴥ◢ʔ"],
    love: ["ʕ♡ᴥ♡ʔ", "ʕ´ᴥ`ʔ♡", "ʕ◕ᴥ◕ʔ♡"],
    surprised: ["ʕ⊙ᴥ⊙ʔ!", "ʕ°ᴥ°ʔ", "ʕOᴥOʔ"],
    sleeping: ["ʕ-ᴥ-ʔzzz", "ʕ￣ᴥ￣ʔzZ", "ʕ˘ᴥ˘ʔzzz"],
    working: ["ʕ•̀ᴥ•́ʔ✧", "ʕ•ᴥ•ʔو", "ʕ·ᴥ·ʔ✧"],
    celebrating: ["ʕ☆ᴥ☆ʔ!", "ヽʕ•ᴥ•ʔノ", "ʕ≧ᴥ≦ʔ☆"],
    confused: ["ʕ？ᴥ？ʔ", "ʕ~ᴥ~ʔ?", "ʕ⊙ᴥ⊙ʔ?"],
    dead: ["ʕ×ᴥ×ʔ", "ʕ✖ᴥ✖ʔ", "ʕ☠ᴥ☠ʔ"],
  },
  stars: {
    happy: ["☆(◒‿◒)☆", "✧(≧▽≦)✧", "★(•‿•)★"],
    ok: ["☆(・_・)☆", "✧(─‿─)✧", "★(•_•)★"],
    warning: ["☆(・_・;)☆", "✧(°△°)✧", "★(⊙_⊙)★"],
    critical: ["☆(╥_╥)☆", "✧(×_×)✧", "★(✖_✖)★"],
    sad: ["☆(T_T)☆", "✧(;_;)✧", "★(╥﹏╥)★"],
    angry: ["☆(╬▔皿▔)☆", "✧(ノ°□°)✧", "★(`Д´)★"],
    love: ["☆(♥‿♥)☆", "✧(◕‿◕)♡✧", "★(´♡`)★"],
    surprised: ["☆(⊙o⊙)☆", "✧(°o°)✧", "★(○_○)★"],
    sleeping: ["☆(-.-)zzz☆", "✧(∪.∪)zzz✧", "★(¦3)zzz★"],
    working: ["☆(•̀ᴗ•́)و☆", "✧(╯°□°)╯✧", "★(•_•)>⌐■★"],
    celebrating: ["☆ヽ(≧▽≦)ノ☆", "✧\\(★ω★)/✧", "★(✧ω✧)★"],
    confused: ["☆(？_？)☆", "✧(⊙_⊙)?✧", "★(¬_¬)★"],
    dead: ["☆(×_×)☆", "✧(✖_✖)✧", "★(☠_☠)★"],
  },
  minimal: {
    happy: [":)", ":]", ":D"],
    ok: [":|", ":-|", ":/"],
    warning: [":S", ":/", ":?"],
    critical: ["D:", ">:(", "X("],
    sad: [":(", ";(", ":'("],
    angry: [">:(", ">(", ":@"],
    love: ["<3", ":*", ";)"],
    surprised: [":O", ":0", "=O"],
    sleeping: ["-_-zzz", "(-_-)zzz", "=.=zzz"],
    working: [":P", ";P", "B)"],
    celebrating: ["\\o/", ":D!", "*:D*"],
    confused: [":S", "?_?", ":/"],
    dead: ["x_x", "X_X", "x.x"],
  },
};

/**
 * Get a kaomoji face for a given mood.
 */
export function kaomoji(mood: KaomojiMood, options?: KaomojiOptions): string {
  const theme = options?.theme ?? "classic";
  const faces = KAOMOJI_DICT[theme]?.[mood];
  if (!faces || faces.length === 0) {
    return KAOMOJI_DICT.classic[mood]?.[0] ?? "(・_・)";
  }
  return faces[0];
}

/**
 * Get all kaomoji faces for a given mood.
 */
export function kaomojiAll(mood: KaomojiMood, options?: KaomojiOptions): readonly string[] {
  const theme = options?.theme ?? "classic";
  const faces = KAOMOJI_DICT[theme]?.[mood];
  if (!faces || faces.length === 0) {
    return KAOMOJI_DICT.classic[mood] ?? ["(・_・)"];
  }
  return faces;
}

/**
 * Map a numeric value to a kaomoji mood + face based on thresholds.
 */
export function kaomojiStatus(value: number, max: number, options?: KaomojiStatusOptions): KaomojiResult {
  const theme = options?.theme ?? "classic";
  const thresholds = options?.thresholds;
  const pct = max === 0 ? 0 : (value / max) * 100;

  let mood: KaomojiMood;

  if (thresholds) {
    const critPct = thresholds.critical ?? 90;
    const warnPct = thresholds.warning ?? 70;
    const invert = thresholds.invert ?? false;

    if (invert) {
      if (pct <= critPct) mood = "critical";
      else if (pct <= warnPct) mood = "warning";
      else mood = "happy";
    } else {
      if (pct >= critPct) mood = "critical";
      else if (pct >= warnPct) mood = "warning";
      else if (pct >= 40) mood = "ok";
      else mood = "happy";
    }
  } else {
    if (pct >= 90) mood = "critical";
    else if (pct >= 70) mood = "warning";
    else if (pct >= 40) mood = "ok";
    else mood = "happy";
  }

  return { face: kaomoji(mood, { theme }), mood };
}

/**
 * List all available kaomoji themes.
 */
export function kaomojiThemes(): readonly KaomojiTheme[] {
  return ["classic", "cats", "bears", "stars", "minimal"];
}

/**
 * 2D grid heatmap using shade characters.
 */
export function heatmap(data: readonly (readonly number[])[], options?: HeatmapOptions): string {
  if (data.length === 0) return "";

  const chars = options?.chars ?? [" ", "░", "▒", "▓", "█"];
  const showLabels = options?.showLabels ?? false;
  const rowLabels = options?.rowLabels;
  const colLabels = options?.colLabels;

  // Find min/max across all data
  let dataMin = options?.min ?? Infinity;
  let dataMax = options?.max ?? -Infinity;
  if (options?.min === undefined || options?.max === undefined) {
    for (const row of data) {
      for (const v of row) {
        if (options?.min === undefined && v < dataMin) dataMin = v;
        if (options?.max === undefined && v > dataMax) dataMax = v;
      }
    }
  }
  if (dataMin === Infinity) dataMin = 0;
  if (dataMax === -Infinity) dataMax = 0;

  const maxCols = Math.max(...data.map(r => r.length));
  const labelPad = showLabels && rowLabels ? Math.max(...rowLabels.map(l => l.length)) + 1 : 0;
  const lines: string[] = [];

  // Column labels
  if (showLabels && colLabels) {
    const prefix = " ".repeat(labelPad);
    const colLine = colLabels.slice(0, maxCols).map(l => l.padStart(2)).join(" ");
    lines.push(prefix + colLine);
  }

  // Data rows
  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    let prefix = "";
    if (showLabels && rowLabels && r < rowLabels.length) {
      prefix = rowLabels[r].padEnd(labelPad);
    }

    const cells = [];
    for (let c = 0; c < maxCols; c++) {
      const v = c < row.length ? row[c] : dataMin;
      const ratio = dataMax === dataMin ? 0.5 : (v - dataMin) / (dataMax - dataMin);
      const idx = Math.min(chars.length - 1, Math.max(0, Math.round(ratio * (chars.length - 1))));
      cells.push(` ${chars[idx]}`);
    }

    lines.push(prefix + cells.join(""));
  }

  return lines.join("\n");
}

/**
 * Compact box-drawing table.
 */
export function miniTable(rows: readonly (readonly string[])[], options?: MiniTableOptions): string {
  if (rows.length === 0) return "";

  const border = options?.border ?? "single";
  const hasHeader = options?.header ?? false;
  const alignments = options?.align ?? [];
  const maxWidth = options?.maxWidth;

  // Calculate column widths
  const numCols = Math.max(...rows.map(r => r.length));
  const colWidths: number[] = Array(numCols).fill(0);
  for (const row of rows) {
    for (let c = 0; c < row.length; c++) {
      colWidths[c] = Math.max(colWidths[c], row[c].length);
    }
  }

  // Apply maxWidth truncation
  if (maxWidth) {
    const overhead = numCols + 1; // border chars
    const available = maxWidth - overhead - numCols * 2; // padding
    if (available > 0) {
      const maxPerCol = Math.floor(available / numCols);
      for (let c = 0; c < numCols; c++) {
        colWidths[c] = Math.min(colWidths[c], maxPerCol);
      }
    }
  }

  const chars = border === "double"
    ? { tl: "╔", tr: "╗", bl: "╚", br: "╝", h: "═", v: "║", tee: "╦", btee: "╩", ltee: "╠", rtee: "╣", cross: "╬" }
    : border === "rounded"
    ? { tl: "╭", tr: "╮", bl: "╰", br: "╯", h: "─", v: "│", tee: "┬", btee: "┴", ltee: "├", rtee: "┤", cross: "┼" }
    : border === "none"
    ? null
    : { tl: "┌", tr: "┐", bl: "└", br: "┘", h: "─", v: "│", tee: "┬", btee: "┴", ltee: "├", rtee: "┤", cross: "┼" };

  if (!chars) {
    // No border
    return rows.map(row => {
      return row.map((cell, c) => {
        const w = colWidths[c] ?? cell.length;
        const truncated = cell.length > w ? cell.slice(0, w) : cell;
        return padCell(truncated, w, alignments[c]);
      }).join("  ");
    }).join("\n");
  }

  const hLine = (left: string, mid: string, right: string) => {
    return left + colWidths.map(w => chars.h.repeat(w + 2)).join(mid) + right;
  };

  const dataRow = (row: readonly string[]) => {
    const cells = [];
    for (let c = 0; c < numCols; c++) {
      const raw = c < row.length ? row[c] : "";
      const w = colWidths[c];
      const truncated = raw.length > w ? raw.slice(0, w) : raw;
      cells.push(` ${padCell(truncated, w, alignments[c])} `);
    }
    return chars.v + cells.join(chars.v) + chars.v;
  };

  const lines: string[] = [];
  lines.push(hLine(chars.tl, chars.tee, chars.tr));

  for (let r = 0; r < rows.length; r++) {
    lines.push(dataRow(rows[r]));
    if (hasHeader && r === 0 && rows.length > 1) {
      lines.push(hLine(chars.ltee, chars.cross, chars.rtee));
    }
  }

  lines.push(hLine(chars.bl, chars.btee, chars.br));
  return lines.join("\n");
}

function padCell(text: string, width: number, align?: "left" | "right" | "center"): string {
  if (align === "right") return text.padStart(width);
  if (align === "center") {
    const left = Math.floor((width - text.length) / 2);
    return " ".repeat(left) + text + " ".repeat(width - text.length - left);
  }
  return text.padEnd(width);
}

/**
 * Key-value table with single border.
 */
export function kvTable(entries: readonly { key: string; value: string }[]): string {
  if (entries.length === 0) return "";
  const rows = entries.map(e => [e.key, e.value]);
  return miniTable(rows, { border: "single" });
}

/**
 * Frequency distribution histogram.
 */
export function histogram(values: readonly number[], options?: HistogramOptions): string {
  if (values.length === 0) return "";

  const numBins = options?.bins ?? 8;
  const barWidth = options?.barWidth ?? 20;
  const showCounts = options?.showCounts ?? true;
  const fill = options?.fill ?? "█";
  const showBounds = options?.showBounds ?? true;
  const percentages = options?.percentages ?? false;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const binSize = range === 0 ? 1 : range / numBins;

  // Count frequencies
  const counts: number[] = Array(numBins).fill(0);
  for (const v of values) {
    let bin = range === 0 ? 0 : Math.floor((v - min) / binSize);
    if (bin >= numBins) bin = numBins - 1;
    counts[bin]++;
  }

  const maxCount = Math.max(...counts);
  const total = values.length;

  // Build labels
  const labels = counts.map((_, i) => {
    if (!showBounds) return `${i}`;
    const lo = (min + i * binSize).toFixed(1);
    const hi = (min + (i + 1) * binSize).toFixed(1);
    return `${lo}-${hi}`;
  });

  const maxLabelLen = Math.max(...labels.map(l => l.length));

  return counts.map((count, i) => {
    const barLen = maxCount === 0 ? 0 : Math.round((count / maxCount) * barWidth);
    const bar = fill.repeat(barLen).padEnd(barWidth);
    const label = labels[i].padStart(maxLabelLen);
    const suffix = percentages
      ? `${((count / total) * 100).toFixed(1)}%`
      : `${count}`;
    return showCounts ? `${label} ${bar} ${suffix}` : `${label} ${bar}`;
  }).join("\n");
}

/**
 * Side-by-side value comparison with delta and direction.
 */
export function compare(
  label1: string, val1: number | readonly number[],
  label2: string, val2: number | readonly number[],
  options?: CompareOptions
): CompareResult {
  const barWidth = options?.barWidth ?? 30;
  const showDelta = options?.showDelta ?? true;
  const showPercent = options?.showPercent ?? true;
  const unit = options?.unit ?? "";
  const mode = options?.mode ?? "bars";

  const num1 = typeof val1 === "number" ? val1 : (val1.length === 0 ? 0 : val1.reduce((s, v) => s + v, 0) / val1.length);
  const num2 = typeof val2 === "number" ? val2 : (val2.length === 0 ? 0 : val2.reduce((s, v) => s + v, 0) / val2.length);

  const delta = num2 - num1;
  const deltaPercent = num1 === 0 ? (num2 === 0 ? 0 : 100) : (delta / Math.abs(num1)) * 100;
  const direction: "up" | "down" | "same" = delta > 0 ? "up" : delta < 0 ? "down" : "same";
  const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "→";

  const deltaStr = delta >= 0 ? `+${delta}` : `${delta}`;
  const pctStr = `(${deltaPercent >= 0 ? "+" : ""}${deltaPercent.toFixed(1)}%)`;

  let display: string;

  if (mode === "compact") {
    const parts = [`${label1} ${num1}${unit} vs ${label2} ${num2}${unit}`];
    if (showDelta) parts.push(`${arrow}${deltaStr}`);
    if (showPercent) parts.push(pctStr);
    display = parts.join(" ");
  } else if (mode === "spark" && Array.isArray(val1) && Array.isArray(val2)) {
    const s1 = spark(val1 as readonly number[]);
    const s2 = spark(val2 as readonly number[]);
    const avg1 = num1.toFixed(1);
    const avg2 = num2.toFixed(1);
    const lines = [`${label1} ${s1}  avg=${avg1}`, `${label2} ${s2}  avg=${avg2}`];
    const deltaParts = [arrow];
    if (showDelta) deltaParts.push(deltaStr);
    if (showPercent) deltaParts.push(pctStr);
    lines.push(deltaParts.join(" "));
    display = lines.join("\n");
  } else {
    // bars mode
    const maxVal = Math.max(Math.abs(num1), Math.abs(num2));
    const maxLabel = Math.max(label1.length, label2.length);
    const bar1Len = maxVal === 0 ? 0 : Math.round((Math.abs(num1) / maxVal) * barWidth);
    const bar2Len = maxVal === 0 ? 0 : Math.round((Math.abs(num2) / maxVal) * barWidth);
    const bar1 = "█".repeat(bar1Len);
    const bar2 = "█".repeat(bar2Len);
    const lines = [
      `${label1.padEnd(maxLabel)} ${bar1} ${num1}${unit}`,
      `${label2.padEnd(maxLabel)} ${bar2} ${num2}${unit}`,
    ];
    const deltaParts = [arrow];
    if (showDelta) deltaParts.push(deltaStr);
    if (showPercent) deltaParts.push(pctStr);
    lines.push(deltaParts.join(" "));
    display = lines.join("\n");
  }

  return { display, delta, deltaPercent: Number(deltaPercent.toFixed(1)), direction, arrow };
}

// --- v0.5.0: Social Media Content Engine ---

const PLATFORM_LIMITS: Record<SocialPlatform, number> = {
  x: 280,
  bluesky: 300,
  instagram: 2200,
  youtube: 5000,
  mastodon: 500,
  threads: 500,
};

/**
 * Format text for a social media platform with character limits.
 */
export function socialFormat(text: string, options?: SocialFormatOptions): SocialFormatResult {
  const platform = options?.platform ?? "x";
  const limit = options?.maxLength ?? PLATFORM_LIMITS[platform];
  const hashtags = options?.hashtags;
  const marker = options?.truncationMarker ?? "...";

  let body = text;

  // Append hashtags
  const hashtagStr = hashtags && hashtags.length > 0
    ? "\n\n" + hashtags.map(t => t.startsWith("#") ? t : `#${t}`).join(" ")
    : "";

  const full = body + hashtagStr;

  if (full.length <= limit) {
    return { text: full, length: full.length, limit, truncated: false, platform };
  }

  // Truncate body to fit hashtags + marker
  const available = limit - hashtagStr.length - marker.length;
  if (available <= 0) {
    // Hashtags alone exceed limit, truncate everything
    const truncated = full.slice(0, limit - marker.length) + marker;
    return { text: truncated, length: truncated.length, limit, truncated: true, platform };
  }

  // Try to break at word boundary
  let cutBody = body.slice(0, available);
  const lastSpace = cutBody.lastIndexOf(" ");
  if (lastSpace > available * 0.6) {
    cutBody = cutBody.slice(0, lastSpace);
  }

  const result = cutBody + marker + hashtagStr;
  return { text: result, length: result.length, limit, truncated: true, platform };
}

/**
 * Split long text into a thread of numbered posts.
 */
export function thread(text: string, options?: ThreadOptions): ThreadResult {
  const platform = options?.platform ?? "x";
  const limit = options?.maxLength ?? PLATFORM_LIMITS[platform];
  const numbering = options?.numbering ?? true;
  const header = options?.header;
  const footer = options?.footer;

  if (text.length === 0) {
    return { posts: [], count: 0, platform };
  }

  // Split into paragraphs first, then sentences
  const paragraphs = text.split(/\n\n+/);
  const posts: string[] = [];
  let current = header ? header + "\n\n" : "";

  for (const para of paragraphs) {
    const paraWithBreak = current.length > 0 ? "\n\n" + para : para;
    // Reserve space for numbering suffix
    const numberingReserve = numbering ? 8 : 0; // " (X/YY)"

    if (current.length + paraWithBreak.length + numberingReserve <= limit) {
      current += paraWithBreak;
    } else {
      // Current paragraph doesn't fit — push current post and start new one
      if (current.length > 0) {
        posts.push(current);
        current = "";
      }

      // If single paragraph exceeds limit, split by sentences
      if (para.length + numberingReserve > limit) {
        const sentences = para.match(/[^.!?]+[.!?]+\s*/g) ?? [para];
        for (const sentence of sentences) {
          if (current.length + sentence.length + numberingReserve <= limit) {
            current += sentence;
          } else {
            if (current.length > 0) posts.push(current);
            // If single sentence exceeds limit, hard-split by words
            if (sentence.length + numberingReserve > limit) {
              const words = sentence.split(/\s+/);
              current = "";
              for (const word of words) {
                const test = current.length > 0 ? current + " " + word : word;
                if (test.length + numberingReserve <= limit) {
                  current = test;
                } else {
                  if (current.length > 0) posts.push(current);
                  current = word;
                }
              }
            } else {
              current = sentence;
            }
          }
        }
      } else {
        current = para;
      }
    }
  }

  // Add footer to last post if it fits, otherwise make new post
  if (footer) {
    const footerStr = "\n\n" + footer;
    const numberingReserve = numbering ? 8 : 0;
    if (current.length + footerStr.length + numberingReserve <= limit) {
      current += footerStr;
    } else {
      if (current.length > 0) posts.push(current);
      current = footer;
    }
  }

  if (current.length > 0) {
    posts.push(current);
  }

  // Add numbering
  if (numbering && posts.length > 1) {
    const total = posts.length;
    const numbered = posts.map((p, i) => `${p} (${i + 1}/${total})`);
    return { posts: numbered, count: numbered.length, platform };
  }

  return { posts, count: posts.length, platform };
}

/**
 * Generate a "building in public" social media post from metrics.
 */
export function buildInPublic(
  metrics: readonly DashboardMetric[],
  options?: BuildInPublicOptions
): string {
  const project = options?.project;
  const period = options?.period ?? "today";
  const hashtags = options?.hashtags ?? ["buildinpublic"];
  const useKaomoji = options?.kaomoji ?? true;
  const kaomojiTheme = options?.kaomojiTheme ?? "classic";
  const includeSparklines = options?.includeSparklines ?? true;

  const lines: string[] = [];

  // Header
  if (project) {
    lines.push(`${project} update (${period}):`);
  } else {
    lines.push(`Status update (${period}):`);
  }
  lines.push("");

  // Metrics
  for (const m of metrics) {
    const lastVal = m.values[m.values.length - 1];
    const unit = m.unit ?? "";
    const trendArrow = trend(m.values);
    let line = `${trendArrow} ${m.name}: ${lastVal}${unit}`;

    if (includeSparklines && m.values.length >= 2) {
      const s = spark(m.values.slice(-8));
      line += ` ${s}`;
    }

    if (useKaomoji && m.thresholds) {
      const max = m.thresholds.critical ?? 100;
      const result = kaomojiStatus(lastVal, max, { theme: kaomojiTheme, thresholds: m.thresholds });
      line += ` ${result.face}`;
    }

    lines.push(line);
  }

  // Overall mood
  if (useKaomoji && metrics.length > 0) {
    const critCount = metrics.filter(m => {
      if (!m.thresholds) return false;
      const last = m.values[m.values.length - 1];
      return m.thresholds.critical !== undefined && last >= m.thresholds.critical;
    }).length;

    const mood: KaomojiMood = critCount > 0 ? "working" : "celebrating";
    lines.push("");
    lines.push(kaomoji(mood, { theme: kaomojiTheme }));
  }

  // Hashtags
  if (hashtags.length > 0) {
    lines.push("");
    lines.push(hashtags.map(t => t.startsWith("#") ? t : `#${t}`).join(" "));
  }

  return lines.join("\n");
}

/**
 * Build a structured social media caption from sections.
 */
export function socialCaption(
  sections: readonly SocialCaptionSection[],
  options?: SocialCaptionOptions
): string {
  const platform = options?.platform ?? "instagram";
  const hashtags = options?.hashtags;
  const cta = options?.cta;
  const separator = options?.separator ?? "\n\n";
  const limit = PLATFORM_LIMITS[platform];

  const parts: string[] = [];

  for (const section of sections) {
    const lines: string[] = [];
    if (section.title) {
      const prefix = section.emoji ? `${section.emoji} ` : "";
      lines.push(`${prefix}${section.title}`);
    }
    lines.push(section.body);
    parts.push(lines.join("\n"));
  }

  if (cta) {
    parts.push(cta);
  }

  let result = parts.join(separator);

  if (hashtags && hashtags.length > 0) {
    const hashtagStr = hashtags.map(t => t.startsWith("#") ? t : `#${t}`).join(" ");
    result += separator + hashtagStr;
  }

  // Truncate if over limit
  if (result.length > limit) {
    result = result.slice(0, limit - 3) + "...";
  }

  return result;
}

// --- v0.6.0: Deep Viz ---

const TREE_CHARS: Record<TreeStyle, { branch: string; last: string; pipe: string; empty: string }> = {
  ascii:   { branch: "|-- ", last: "`-- ", pipe: "|   ", empty: "    " },
  rounded: { branch: "├── ", last: "└── ", pipe: "│   ", empty: "    " },
  bold:    { branch: "┣━━ ", last: "┗━━ ", pipe: "┃   ", empty: "    " },
  double:  { branch: "╠══ ", last: "╚══ ", pipe: "║   ", empty: "    " },
};

/**
 * Render a tree/hierarchy as ASCII art.
 */
export function tree(nodes: readonly TreeNode[], options?: TreeOptions): string {
  if (nodes.length === 0) return "";
  const style = options?.style ?? "rounded";
  const prefix = options?.prefix ?? "";
  const chars = TREE_CHARS[style];

  const lines: string[] = [];

  function render(items: readonly TreeNode[], pfx: string): void {
    for (let i = 0; i < items.length; i++) {
      const node = items[i];
      const isLast = i === items.length - 1;
      const connector = isLast ? chars.last : chars.branch;
      lines.push(pfx + connector + node.label);
      if (node.children && node.children.length > 0) {
        const childPfx = pfx + (isLast ? chars.empty : chars.pipe);
        render(node.children, childPfx);
      }
    }
  }

  render(nodes, prefix);
  return lines.join("\n");
}

const PROGRESS_ICONS: Record<string, Record<string, string>> = {
  line:   { done: "✅", active: "🔄", pending: "⬜", failed: "❌" },
  dots:   { done: "●", active: "◉", pending: "○", failed: "✖" },
  blocks: { done: "█", active: "▓", pending: "░", failed: "▒" },
  arrows: { done: "✓", active: "►", pending: "·", failed: "✗" },
};

/**
 * Multi-step progress/pipeline bar.
 */
export function progressBar(steps: readonly ProgressStep[], options?: ProgressBarOptions): string {
  if (steps.length === 0) return "";
  const style: ProgressBarStyle = options?.style ?? "line";
  const sep = options?.separator ?? " ▸ ";
  const icons = PROGRESS_ICONS[style];

  return steps.map(s => {
    const icon = icons[s.status] ?? icons.pending;
    return `${icon} ${s.label}`;
  }).join(sep);
}

/**
 * GitHub-style calendar heatmap from date-indexed entries.
 */
export function calendarHeatmap(data: readonly CalendarEntry[], options?: CalendarHeatmapOptions): string {
  if (data.length === 0) return "";

  const chars = options?.chars ?? [" ", "░", "▒", "▓", "█"];
  const showMonths = options?.showMonths ?? true;
  const showDays = options?.showDays ?? false;

  // Parse dates and find range
  const entries = data.map(d => ({ date: new Date(d.date + "T00:00:00"), value: d.value }));
  entries.sort((a, b) => a.date.getTime() - b.date.getTime());

  const minVal = Math.min(...entries.map(e => e.value));
  const maxVal = Math.max(...entries.map(e => e.value));

  // Build a map for fast lookup
  const dateMap = new Map<string, number>();
  for (const e of entries) {
    const key = `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, "0")}-${String(e.date.getDate()).padStart(2, "0")}`;
    dateMap.set(key, e.value);
  }

  // Determine the week range
  const startDate = new Date(entries[0].date);
  const endDate = new Date(entries[entries.length - 1].date);

  // Adjust startDate to Monday
  const startDay = startDate.getDay();
  const mondayOffset = startDay === 0 ? -6 : 1 - startDay;
  startDate.setDate(startDate.getDate() + mondayOffset);

  // Build weeks
  const weeks: (number | null)[][] = [];
  const weekMonths: number[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const week: (number | null)[] = [];
    const weekMonth = current.getMonth();
    for (let d = 0; d < 7; d++) {
      const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
      if (current > endDate || current < entries[0].date) {
        week.push(null);
      } else {
        week.push(dateMap.get(key) ?? 0);
      }
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
    weekMonths.push(weekMonth);
  }

  const dayLabels = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function charFor(v: number | null): string {
    if (v === null) return " ";
    if (maxVal === minVal) return chars[Math.floor(chars.length / 2)];
    const ratio = (v - minVal) / (maxVal - minVal);
    const idx = Math.min(chars.length - 1, Math.max(0, Math.round(ratio * (chars.length - 1))));
    return chars[idx];
  }

  const lines: string[] = [];
  const leftPad = showDays ? 3 : 0;

  // Month header
  if (showMonths) {
    let monthLine = " ".repeat(leftPad);
    let lastMonth = -1;
    for (let w = 0; w < weeks.length; w++) {
      const m = weekMonths[w];
      if (m !== lastMonth) {
        monthLine += monthNames[m].padEnd(1);
        lastMonth = m;
      } else {
        monthLine += " ";
      }
    }
    lines.push(monthLine);
  }

  // 7 rows (Mon-Sun)
  for (let d = 0; d < 7; d++) {
    let row = showDays ? dayLabels[d] + " " : "";
    for (let w = 0; w < weeks.length; w++) {
      row += charFor(weeks[w][d]);
    }
    lines.push(row);
  }

  return lines.join("\n");
}

// Braille dot positions: column 0 = bits 0,1,2,6; column 1 = bits 3,4,5,7
// Row 0: bit 0 (col0), bit 3 (col1)
// Row 1: bit 1 (col0), bit 4 (col1)
// Row 2: bit 2 (col0), bit 5 (col1)
// Row 3: bit 6 (col0), bit 7 (col1)
const BRAILLE_BASE = 0x2800;
const BRAILLE_DOTS = [
  [0x01, 0x08], // row 0
  [0x02, 0x10], // row 1
  [0x04, 0x20], // row 2
  [0x40, 0x80], // row 3
];

/**
 * High-resolution sparkline using Braille Unicode characters.
 */
export function brailleSpark(values: readonly number[], options?: BrailleSparkOptions): string {
  if (values.length === 0) return "";

  const height = options?.height ?? 1;
  const filled = options?.filled ?? false;
  const minVal = options?.min ?? Math.min(...values);
  const maxVal = options?.max ?? Math.max(...values);

  const rows = height * 4; // 4 dots per braille char vertically
  const cols = Math.ceil(values.length / 2); // 2 dots per braille char horizontally

  // Normalize values to row indices (0 = bottom, rows-1 = top)
  const normalized = values.map(v => {
    if (maxVal === minVal) return Math.floor(rows / 2);
    const ratio = (v - minVal) / (maxVal - minVal);
    return Math.min(rows - 1, Math.max(0, Math.round(ratio * (rows - 1))));
  });

  // Build grid: grid[charRow][charCol] = braille offset
  const charRows = height;
  const grid: number[][] = Array.from({ length: charRows }, () => Array(cols).fill(0));

  for (let i = 0; i < values.length; i++) {
    const colInChar = i % 2; // 0 or 1
    const charCol = Math.floor(i / 2);
    const dotRow = normalized[i]; // 0=bottom

    if (filled) {
      // Fill from bottom up to dotRow
      for (let r = 0; r <= dotRow; r++) {
        const charRow = charRows - 1 - Math.floor(r / 4);
        const subRow = 3 - (r % 4);
        if (charRow >= 0 && charRow < charRows) {
          grid[charRow][charCol] |= BRAILLE_DOTS[subRow][colInChar];
        }
      }
    } else {
      // Single dot
      const charRow = charRows - 1 - Math.floor(dotRow / 4);
      const subRow = 3 - (dotRow % 4);
      if (charRow >= 0 && charRow < charRows) {
        grid[charRow][charCol] |= BRAILLE_DOTS[subRow][colInChar];
      }
    }
  }

  // Render
  const lines: string[] = [];
  for (let r = 0; r < charRows; r++) {
    let line = "";
    for (let c = 0; c < cols; c++) {
      line += String.fromCharCode(BRAILLE_BASE + grid[r][c]);
    }
    lines.push(line);
  }

  return lines.join("\n");
}

/**
 * ASCII candlestick / OHLC financial chart.
 */
export function candlestick(candles: readonly CandleData[], options?: CandlestickOptions): string {
  if (candles.length === 0) return "";

  const height = options?.height ?? 10;
  const bullChar = options?.bullChar ?? "█";
  const bearChar = options?.bearChar ?? "░";
  const wickChar = options?.wickChar ?? "│";

  // Find global min/max across all candles
  const globalMin = Math.min(...candles.map(c => c.low));
  const globalMax = Math.max(...candles.map(c => c.high));
  const range = globalMax - globalMin || 1;

  function toRow(val: number): number {
    return Math.round(((val - globalMin) / range) * (height - 1));
  }

  // Build columns
  const columns: string[][] = [];
  for (const candle of candles) {
    const col: string[] = Array(height).fill(" ");
    const openRow = toRow(candle.open);
    const closeRow = toRow(candle.close);
    const highRow = toRow(candle.high);
    const lowRow = toRow(candle.low);
    const isBull = candle.close >= candle.open;
    const bodyChar = isBull ? bullChar : bearChar;
    const bodyTop = Math.max(openRow, closeRow);
    const bodyBot = Math.min(openRow, closeRow);

    // Draw wick
    for (let r = lowRow; r <= highRow; r++) {
      col[r] = wickChar;
    }
    // Draw body over wick
    for (let r = bodyBot; r <= bodyTop; r++) {
      col[r] = bodyChar;
    }

    columns.push(col);
  }

  // Render top-down
  const lines: string[] = [];
  for (let r = height - 1; r >= 0; r--) {
    let line = "";
    for (let c = 0; c < columns.length; c++) {
      line += columns[c][r] + " ";
    }
    lines.push(line.trimEnd());
  }

  return lines.join("\n");
}

/**
 * Gantt-style timeline chart.
 */
export function timeline(events: readonly TimelineEvent[], options?: TimelineOptions): string {
  if (events.length === 0) return "";

  const totalWidth = options?.width ?? 40;
  const fill = options?.fill ?? "█";
  const empty = options?.empty ?? "░";
  const showScale = options?.showScale ?? true;
  const unit = options?.unit ?? "";

  // Find max end
  const maxEnd = Math.max(...events.map(e => e.start + e.duration));
  const maxLabelLen = Math.max(...events.map(e => e.label.length));

  const lines: string[] = [];

  // Scale header
  if (showScale) {
    let scale = " ".repeat(maxLabelLen + 2);
    const step = Math.max(1, Math.ceil(maxEnd / 4));
    for (let t = 0; t <= maxEnd; t += step) {
      const pos = Math.round((t / maxEnd) * totalWidth);
      const label = String(t);
      // Place label at position
      while (scale.length < maxLabelLen + 2 + pos) scale += " ";
      scale = scale.slice(0, maxLabelLen + 2 + pos) + label + scale.slice(maxLabelLen + 2 + pos + label.length);
    }
    if (unit) scale += "  " + unit;
    lines.push(scale);
  }

  // Event bars
  for (const event of events) {
    const label = event.label.padEnd(maxLabelLen);
    const startPos = Math.round((event.start / maxEnd) * totalWidth);
    const endPos = Math.round(((event.start + event.duration) / maxEnd) * totalWidth);
    let bar = "";
    for (let i = 0; i < totalWidth; i++) {
      bar += (i >= startPos && i < endPos) ? fill : empty;
    }
    lines.push(`${label}  ${bar}`);
  }

  return lines.join("\n");
}

const BOX_CHARS: Record<BoxDiagramStyle, { tl: string; tr: string; bl: string; br: string; h: string; v: string }> = {
  single:  { tl: "┌", tr: "┐", bl: "└", br: "┘", h: "─", v: "│" },
  double:  { tl: "╔", tr: "╗", bl: "╚", br: "╝", h: "═", v: "║" },
  rounded: { tl: "╭", tr: "╮", bl: "╰", br: "╯", h: "─", v: "│" },
  bold:    { tl: "┏", tr: "┓", bl: "┗", br: "┛", h: "━", v: "┃" },
};

/**
 * Box-and-arrow flowchart diagram.
 */
export function boxDiagram(boxes: readonly BoxNode[], options?: BoxDiagramOptions): string {
  if (boxes.length === 0) return "";

  const style: BoxDiagramStyle = options?.style ?? "single";
  const direction = options?.direction ?? "horizontal";
  const arrowChar = options?.arrowChar ?? (direction === "horizontal" ? "──▶" : "▼");
  const padding = options?.padding ?? 1;
  const bc = BOX_CHARS[style];

  if (direction === "vertical") {
    const maxLen = Math.max(...boxes.map(b => b.label.length));
    const boxWidth = maxLen + padding * 2;
    const lines: string[] = [];

    for (let i = 0; i < boxes.length; i++) {
      const label = boxes[i].label;
      const padded = " ".repeat(padding) + label.padEnd(maxLen) + " ".repeat(padding);
      lines.push(bc.tl + bc.h.repeat(boxWidth) + bc.tr);
      lines.push(bc.v + padded + bc.v);
      lines.push(bc.bl + bc.h.repeat(boxWidth) + bc.br);
      if (i < boxes.length - 1) {
        const mid = Math.floor(boxWidth / 2);
        lines.push(" ".repeat(mid + 1) + arrowChar);
      }
    }
    return lines.join("\n");
  }

  // Horizontal
  const maxLen = Math.max(...boxes.map(b => b.label.length));
  const boxWidth = maxLen + padding * 2;
  const gap = ` ${arrowChar} `;

  const topLine: string[] = [];
  const midLine: string[] = [];
  const botLine: string[] = [];

  for (let i = 0; i < boxes.length; i++) {
    const label = boxes[i].label;
    const padded = " ".repeat(padding) + label.padEnd(maxLen) + " ".repeat(padding);
    topLine.push(bc.tl + bc.h.repeat(boxWidth) + bc.tr);
    midLine.push(bc.v + padded + bc.v);
    botLine.push(bc.bl + bc.h.repeat(boxWidth) + bc.br);
    if (i < boxes.length - 1) {
      const arrowPad = " ".repeat(gap.length);
      topLine.push(arrowPad);
      midLine.push(gap);
      botLine.push(arrowPad);
    }
  }

  return [topLine.join(""), midLine.join(""), botLine.join("")].join("\n");
}

/**
 * Multiple sparklines aligned with labels for comparison.
 */
export function multiSpark(series: readonly SparkSeries[], options?: MultiSparkOptions): string {
  if (series.length === 0) return "";

  const width = options?.width;
  const showPeak = options?.showPeak ?? true;
  const showTrend = options?.showTrend ?? false;

  const maxLabelLen = Math.max(...series.map(s => s.label.length));

  return series.map(s => {
    const label = s.label.padEnd(maxLabelLen);
    const vals = width ? s.values.slice(-width) : s.values;
    const sparkStr = spark(vals);
    const parts = [label, " ", sparkStr];

    if (showPeak) {
      const peak = Math.max(...s.values);
      const unit = s.unit ?? "";
      parts.push(`  peak=${peak}${unit}`);
    }

    if (showTrend) {
      parts.push(` ${trend(s.values)}`);
    }

    return parts.join("");
  }).join("\n");
}

/**
 * Diverging / butterfly bar chart for before/after comparison.
 */
export function diffBar(items: readonly DiffBarItem[], options?: DiffBarOptions): string {
  if (items.length === 0) return "";

  const barWidth = options?.barWidth ?? 10;
  const showDelta = options?.showDelta ?? true;
  const showPercent = options?.showPercent ?? true;
  const unit = options?.unit ?? "";

  const maxLabelLen = Math.max(...items.map(i => i.label.length));
  const maxVal = Math.max(...items.map(i => Math.max(i.before, i.after)));

  return items.map(item => {
    const label = item.label.padStart(maxLabelLen);
    const beforeLen = maxVal === 0 ? 0 : Math.round((item.before / maxVal) * barWidth);
    const afterLen = maxVal === 0 ? 0 : Math.round((item.after / maxVal) * barWidth);

    const beforeBar = "█".repeat(beforeLen).padStart(barWidth);
    const afterBar = "█".repeat(afterLen).padEnd(barWidth);

    const delta = item.after - item.before;
    const pct = item.before === 0 ? (item.after === 0 ? 0 : 100) : Math.round((delta / Math.abs(item.before)) * 100);
    const arrow = delta > 0 ? "↑" : delta < 0 ? "↓" : "→";

    const parts = [`${label}  ${beforeBar}▕${afterBar}`];
    if (showDelta) parts.push(`${item.before}${unit}→${item.after}${unit}`);
    if (showPercent) parts.push(`${arrow}${Math.abs(pct)}%`);

    return parts.join("  ");
  }).join("\n");
}

// --- Matrix (LED dot-matrix display) ---

// 3x5 font table: each character is 5 rows of 3-char wide strings
const MATRIX_FONT_3x5: Record<string, string[]> = {
  "A": ["█▀█","█▀█","███","█ █","█ █"],
  "B": ["██▀","█▀█","██▀","█▀█","██▀"],
  "C": ["▀██","█  ","█  ","█  ","▀██"],
  "D": ["██▀","█ █","█ █","█ █","██▀"],
  "E": ["███","█  ","██ ","█  ","███"],
  "F": ["███","█  ","██ ","█  ","█  "],
  "G": ["▀██","█  ","█▀█","█ █","▀██"],
  "H": ["█ █","█ █","███","█ █","█ █"],
  "I": ["███"," █ "," █ "," █ ","███"],
  "J": ["███","  █","  █","█ █","▀█▀"],
  "K": ["█ █","█▀ ","██ ","█▀ ","█ █"],
  "L": ["█  ","█  ","█  ","█  ","███"],
  "M": ["█ █","███","█▀█","█ █","█ █"],
  "N": ["█ █","██ ","█▀█","█ █","█ █"],
  "O": ["▀█▀","█ █","█ █","█ █","▀█▀"],
  "P": ["██▀","█ █","██▀","█  ","█  "],
  "Q": ["▀█▀","█ █","█ █","█▀█","▀█▀"],
  "R": ["██▀","█ █","██▀","█▀ ","█ █"],
  "S": ["▀██","█  ","▀█▀","  █","██▀"],
  "T": ["███"," █ "," █ "," █ "," █ "],
  "U": ["█ █","█ █","█ █","█ █","▀█▀"],
  "V": ["█ █","█ █","█ █","▀█▀"," █ "],
  "W": ["█ █","█ █","█▀█","███","█ █"],
  "X": ["█ █","█ █"," █ ","█ █","█ █"],
  "Y": ["█ █","█ █","▀█▀"," █ "," █ "],
  "Z": ["███","  █"," █ ","█  ","███"],
  "0": ["▀█▀","█ █","█ █","█ █","▀█▀"],
  "1": [" █ ","██ "," █ "," █ ","███"],
  "2": ["▀█▀","  █","▀█▀","█  ","███"],
  "3": ["██▀","  █","▀█▀","  █","██▀"],
  "4": ["█ █","█ █","███","  █","  █"],
  "5": ["███","█  ","██▀","  █","██▀"],
  "6": ["▀██","█  ","██▀","█ █","▀█▀"],
  "7": ["███","  █"," █ ","█  ","█  "],
  "8": ["▀█▀","█ █","▀█▀","█ █","▀█▀"],
  "9": ["▀█▀","█ █","▀██","  █","██▀"],
  " ": ["   ","   ","   ","   ","   "],
  "!": [" █ "," █ "," █ ","   "," █ "],
  ".": ["   ","   ","   ","   "," █ "],
  "-": ["   ","   ","███","   ","   "],
  ":": ["   "," █ ","   "," █ ","   "],
  "/": ["  █"," ▀ "," █ "," ▀ ","█  "],
  "?": ["▀█▀","  █"," █ ","   "," █ "],
  "#": [" █ ","███"," █ ","███"," █ "],
};

/**
 * Render text as large LED dot-matrix characters.
 */
export function matrix(text: string, options?: MatrixOptions): string {
  if (text.length === 0) return "";

  const style = options?.style ?? "blocks";
  const scale = options?.scale ?? 1;

  const upper = text.toUpperCase();
  const font = MATRIX_FONT_3x5;
  const rows = 5;

  // Collect character data
  const charData: string[][] = [];
  for (const ch of upper) {
    const glyph = font[ch] ?? font[" "];
    charData.push(glyph);
  }

  // Apply style transform
  function transformChar(ch: string): string {
    if (style === "dots") {
      return ch === "█" ? "●" : ch === "▀" ? "◦" : ch === " " ? " " : ch;
    }
    if (style === "braille") {
      return ch === "█" ? "⣿" : ch === "▀" ? "⠛" : ch === " " ? "⠀" : ch;
    }
    // blocks (default) - keep as-is
    return ch;
  }

  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    let line = "";
    for (let c = 0; c < charData.length; c++) {
      const row = charData[c][r];
      for (const ch of row) {
        const transformed = transformChar(ch);
        line += transformed.repeat(scale);
      }
      if (c < charData.length - 1) line += " ".repeat(scale); // gap between chars
    }
    // Repeat row for vertical scale
    for (let s = 0; s < scale; s++) {
      lines.push(line);
    }
  }

  return lines.join("\n");
}