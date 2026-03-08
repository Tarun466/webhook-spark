import type * as http from "http";
import type * as https from "https";

export interface SparklineConfig {
  readonly minValue?: number;
  readonly maxValue?: number;
  readonly width: number;
  readonly height: number;
  readonly includeAxis?: boolean;
  readonly dataPoints: readonly number[];
}

export type QRCodeErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export interface QRImageOptions {
  readonly errorCorrection?: QRCodeErrorCorrectionLevel;
  readonly margin?: number;
  readonly size?: number;
  readonly darkColor?: string;
  readonly lightColor?: string;
}

export interface ASCIIQROptions {
  readonly errorCorrection?: QRCodeErrorCorrectionLevel;
  readonly margin?: number;
  readonly inverted?: boolean;
  readonly blockChar?: string;
  readonly whiteChar?: string;
}

export interface WebhookPayload {
  readonly timestamp: Date;
  readonly metricName: string;
  readonly sparkline: string;
  readonly rawValues: readonly number[];
  readonly metadata?: Record<string, unknown>;
}

export type WebhookProvider = "discord" | "slack" | "telegram";

export interface WebhookConfig {
  readonly endpoint: string;
  readonly provider: WebhookProvider;
  readonly authHeaders?: Record<string, string>;
  readonly timeoutMs?: number;
  readonly retryAttempts?: number;
  readonly telegram?: TelegramConfig;
}

// Rest of existing types remain unchanged...