import * as https from "https";
import * as crypto from "crypto";
import * as url from "url";
import type { BlueskyConfig, XConfig, SocialPostResult } from "./types.js";

function httpsPost(
  endpoint: string,
  body: string,
  headers: Record<string, string>,
  timeoutMs: number = 15000
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new url.URL(endpoint);
    const req = https.request(
      {
        hostname: parsed.hostname,
        port: 443,
        path: parsed.pathname + parsed.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          ...headers,
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode || 0,
            body: Buffer.concat(chunks).toString("utf-8"),
          });
        });
      }
    );
    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
    req.write(body);
    req.end();
  });
}

/**
 * Post to Bluesky via AT Protocol.
 * Requires a handle (e.g. "user.bsky.social") and an app password.
 */
export async function postToBluesky(
  text: string,
  config: BlueskyConfig
): Promise<SocialPostResult> {
  const service = config.service ?? "https://bsky.social";

  try {
    // Step 1: Create session
    const sessionRes = await httpsPost(
      `${service}/xrpc/com.atproto.server.createSession`,
      JSON.stringify({
        identifier: config.handle,
        password: config.appPassword,
      }),
      {}
    );

    if (sessionRes.statusCode !== 200) {
      const err = JSON.parse(sessionRes.body);
      return {
        success: false,
        platform: "bluesky",
        error: `Auth failed: ${err.message ?? err.error ?? sessionRes.body}`,
      };
    }

    const session = JSON.parse(sessionRes.body);
    const accessJwt = session.accessJwt;
    const did = session.did;

    // Step 2: Create post record
    const now = new Date().toISOString();
    const postRes = await httpsPost(
      `${service}/xrpc/com.atproto.repo.createRecord`,
      JSON.stringify({
        repo: did,
        collection: "app.bsky.feed.post",
        record: {
          $type: "app.bsky.feed.post",
          text,
          createdAt: now,
        },
      }),
      { Authorization: `Bearer ${accessJwt}` }
    );

    if (postRes.statusCode !== 200) {
      const err = JSON.parse(postRes.body);
      return {
        success: false,
        platform: "bluesky",
        error: `Post failed: ${err.message ?? err.error ?? postRes.body}`,
      };
    }

    const result = JSON.parse(postRes.body);
    const rkey = result.uri?.split("/").pop() ?? "";
    const handle = config.handle.replace(/^@/, "");
    const postUrl = `https://bsky.app/profile/${handle}/post/${rkey}`;

    return {
      success: true,
      platform: "bluesky",
      postId: result.uri,
      postUrl,
    };
  } catch (err) {
    return {
      success: false,
      platform: "bluesky",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Post to X (Twitter) via API v2 with OAuth 1.0a signing.
 * Requires API key/secret + access token/secret from developer portal.
 */
export async function postToX(
  text: string,
  config: XConfig
): Promise<SocialPostResult> {
  const endpoint = "https://api.twitter.com/2/tweets";

  try {
    const authHeader = buildOAuth1Header(
      "POST",
      endpoint,
      config.apiKey,
      config.apiSecret,
      config.accessToken,
      config.accessSecret
    );

    const body = JSON.stringify({ text });
    const res = await httpsPost(endpoint, body, {
      Authorization: authHeader,
    });

    if (res.statusCode === 201 || res.statusCode === 200) {
      const data = JSON.parse(res.body);
      const tweetId = data.data?.id;
      return {
        success: true,
        platform: "x",
        postId: tweetId,
        postUrl: tweetId ? `https://x.com/i/status/${tweetId}` : undefined,
      };
    }

    const err = JSON.parse(res.body);
    return {
      success: false,
      platform: "x",
      error: `Post failed (${res.statusCode}): ${err.detail ?? err.title ?? res.body}`,
    };
  } catch (err) {
    return {
      success: false,
      platform: "x",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// --- OAuth 1.0a signing for X/Twitter ---

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) =>
    "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

function buildOAuth1Header(
  method: string,
  endpoint: string,
  consumerKey: string,
  consumerSecret: string,
  token: string,
  tokenSecret: string
): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString("hex");

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: token,
    oauth_version: "1.0",
  };

  // Build parameter string (sorted)
  const paramEntries = Object.entries(oauthParams)
    .map(([k, v]) => [percentEncode(k), percentEncode(v)])
    .sort((a, b) => a[0].localeCompare(b[0]));

  const paramString = paramEntries.map(([k, v]) => `${k}=${v}`).join("&");

  // Build signature base string
  const baseString = [
    method.toUpperCase(),
    percentEncode(endpoint),
    percentEncode(paramString),
  ].join("&");

  // Build signing key
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;

  // HMAC-SHA1 signature
  const signature = crypto
    .createHmac("sha1", signingKey)
    .update(baseString)
    .digest("base64");

  oauthParams.oauth_signature = signature;

  // Build Authorization header
  const headerParts = Object.entries(oauthParams)
    .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
    .join(", ");

  return `OAuth ${headerParts}`;
}
