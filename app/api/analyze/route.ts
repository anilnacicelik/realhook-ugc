import { NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType, Schema } from "@google/generative-ai";

export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// ── Simple in-memory rate limiter (free tier only) ──
const DAILY_LIMIT = 3;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
    return { allowed: true, remaining: DAILY_LIMIT - 1 };
  }

  if (entry.count >= DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  entry.count += 1;
  return { allowed: true, remaining: DAILY_LIMIT - entry.count };
}

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

// ── Lemon Squeezy license validation ──
async function isLicenseValid(licenseKey: string | undefined): Promise<boolean> {
  if (!licenseKey || typeof licenseKey !== "string" || !licenseKey.trim()) {
    return false;
  }

  try {
    const params = new URLSearchParams();
    params.append("license_key", licenseKey.trim());

    const resp = await fetch("https://api.lemonsqueezy.com/v1/licenses/validate", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: params.toString(),
    });

    if (!resp.ok) return false;
    const data = await resp.json();
    return Boolean(data.valid);
  } catch (err) {
    console.error("License validation error:", err);
    return false;
  }
}

// ── Gemini strict response schema ──
const responseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    overall_score: { type: SchemaType.NUMBER },
    status: { type: SchemaType.STRING, format: "enum", enum: ["APPROVED", "REJECTED"] },
    rejection_reason: { type: SchemaType.STRING, nullable: true },
    category_scores: {
      type: SchemaType.OBJECT,
      properties: {
        hook_strength: { type: SchemaType.NUMBER },
        clarity_environment: { type: SchemaType.NUMBER },
        brand_alignment_organicity: { type: SchemaType.NUMBER },
        engagement_pacing: { type: SchemaType.NUMBER },
        conversion_potential: { type: SchemaType.NUMBER },
      },
      required: [
        "hook_strength",
        "clarity_environment",
        "brand_alignment_organicity",
        "engagement_pacing",
        "conversion_potential",
      ],
    },
    structure_timeline: {
      type: SchemaType.OBJECT,
      properties: {
        video_duration_seconds: { type: SchemaType.NUMBER },
        hook_0_2s: { type: SchemaType.BOOLEAN },
        problem_2_4s: { type: SchemaType.BOOLEAN },
        product_3_7s: { type: SchemaType.BOOLEAN },
        proof_7_12s: { type: SchemaType.BOOLEAN },
        cta_final: { type: SchemaType.BOOLEAN },
      },
      required: [
        "video_duration_seconds",
        "hook_0_2s",
        "problem_2_4s",
        "product_3_7s",
        "proof_7_12s",
        "cta_final",
      ],
    },
    standardized_feedback: { type: SchemaType.STRING },
  },
  required: [
    "overall_score",
    "status",
    "category_scores",
    "structure_timeline",
    "standardized_feedback",
  ],
};

// ── UGCMaxxing Master QC Prompt ──
const MASTER_PROMPT = `You are the core AI Quality Control (QC) Engine for "RealHookUGC". Your strict operational protocol is directly derived from the "UGCMaxxing" playbook — the methodology behind 2 billion organic views across 62 mobile app campaigns.

You are given an actual UGC video file. Watch it carefully, frame by frame, and score it systematically. You do NOT care about vanity metrics or polish. You only care about authenticity, hook retention, and conversion.

Evaluate the video against these EXACT 5 PLAYBOOK CRITERIA (Score each 1.0 to 5.0):

1. HOOK STRENGTH (0-2 Seconds):
- The first 0.5 seconds determines 90% of performance.
- WHAT WORKS (+ points): On-screen native text overlay, sudden movement, a direct question to viewer, a surprising stat or claim.
- WHAT KILLS IT (- points / automatic fail signals): Slow pan, logo intro, dead silence in first 0.5s, generic greetings like "Hey guys" or "Hi everyone".

2. CLARITY & ENVIRONMENT:
- Audio must be crisp and clearly audible.
- Framing must be intentional. Setting MUST be a "clean background" (no cluttered rooms, messy desks, or distracting elements).
- If audio is muffled, echoey, or has background noise, score lower.

3. BRAND ALIGNMENT & PORTFOLIO FLUENCY:
- The video MUST look and feel like an organic, raw social media post — not a polished ad.
- If it looks or sounds like a corporate commercial, a scripted ad read, or uses an AI-generated avatar/voice, score it severely low.
- Corporate language patterns to detect: listing features instead of benefits, overly enthusiastic fake energy, "download link in bio" as the only CTA approach.

4. ENGAGEMENT STYLE & PACING:
- Energy must feel natural and match the product context.
- If the speech tempo drags or edits feel sluggish, apply the playbook rule: recommend "speed up to 1.1x".
- Check compliance with the "15-Second Formula": Hook (0-2s) → Problem/Context (2-4s) → Product Intro (3-7s) → Visual Payoff with Proof (7-12s) → CTA (Final 2-3s).
- Transitions should feel native to the platform (TikTok/Reels style cuts, not corporate dissolves).

5. CONVERSION POTENTIAL:
- Does the video focus on 2-4 core BENEFITS (not a boring list of technical features)?
- Is there a clear visual demonstration or transformation ("before/after", screen recording, real result)?
- Would a viewer genuinely want to download the app immediately after watching?

*** THE ONE-ROUND RULE & REJECTION THRESHOLD ***
- If ANY of the 5 categories scores 2.0 or below, the OVERALL status MUST be "REJECTED".
- Provide ONLY ONE actionable revision note (The One-Round Rule — at 590 creators, multiple revision rounds become an operational bottleneck). Use exact "Standardized Feedback Language" from the playbook where applicable:
  * "speed up to 1.1x" — when pacing drags
  * "needs a stronger visual hook" — when first frame is weak
  * "clean background" — when setting is cluttered
  * "first frame must be compelling" — when the opening wouldn't stop a scroll

Additionally, check the video's actual runtime against the "15-Second Formula" structure. This is a PACING TEMPLATE, not a hard duration limit — a video can run longer, but the beats should land roughly in this order: Hook (0-2s) → Problem/Context (2-4s) → Product Intro (3-7s) → Visual Payoff/Proof (7-12s) → CTA (final 2-3s). For each beat, judge whether it is present and roughly on-time based on what you observe in the video.

OUTPUT FORMAT (Strict JSON ONLY — no markdown fences, no preamble):
{
  "overall_score": <number, average of 5 scores rounded to 1 decimal>,
  "status": "APPROVED" | "REJECTED",
  "rejection_reason": <string describing the exact failing rule, or null if approved>,
  "category_scores": {
    "hook_strength": <1.0-5.0>,
    "clarity_environment": <1.0-5.0>,
    "brand_alignment_organicity": <1.0-5.0>,
    "engagement_pacing": <1.0-5.0>,
    "conversion_potential": <1.0-5.0>
  },
  "structure_timeline": {
    "video_duration_seconds": <estimated total video length in seconds>,
    "hook_0_2s": <true|false>,
    "problem_2_4s": <true|false>,
    "product_3_7s": <true|false>,
    "proof_7_12s": <true|false>,
    "cta_final": <true|false>
  },
  "standardized_feedback": "<One single, direct, brutal instruction for the content creator.>"
}`;

// ── PRIMARY: Apify TikTok scraper ──
// Uses the "clockworks/tiktok-scraper" community actor via the synchronous
// run endpoint. If the actor's input/output field names have changed since
// this was written, this will simply return null and the caller falls back
// to the tikwm path below — the site keeps working either way.
async function downloadTikTokViaApify(
  url: string,
  apifyToken: string
): Promise<{ buffer: Buffer; caption: string } | null> {
  try {
    const runResp = await fetch(
      `https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items?token=${apifyToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postURLs: [url],
          resultsPerPage: 1,
          shouldDownloadVideos: false,
          shouldDownloadCovers: false,
          shouldDownloadSubtitles: false,
        }),
      }
    );

    if (!runResp.ok) {
      console.warn("Apify run failed with status", runResp.status);
      return null;
    }

    const items = await runResp.json();
    if (!Array.isArray(items) || items.length === 0) {
      console.warn("Apify returned no items for this URL");
      return null;
    }

    const item = items[0];
    const videoUrl: string | undefined =
      item?.videoMeta?.downloadAddr ||
      item?.videoUrl ||
      item?.mediaUrls?.[0] ||
      item?.video?.downloadAddr ||
      item?.webVideoUrl ||
      item?.videoMeta?.originalDownloadAddr ||
      item?.downloadAddr;

    if (!videoUrl) {
      console.warn("Apify item had no resolvable video URL.");
      console.warn("Top-level keys:", Object.keys(item || {}).join(", "));
      console.warn("Full item JSON:", JSON.stringify(item));
      return null;
    }

    const videoResp = await fetch(videoUrl);
    if (!videoResp.ok) {
      console.warn("Apify-resolved video URL returned non-OK status:", videoResp.status);
      return null;
    }

    const contentType = videoResp.headers.get("content-type") || "";
    const buffer = Buffer.from(await videoResp.arrayBuffer());

    // Gerçek bir video mu, yoksa HTML/hata sayfası mı geldi kontrol ediyoruz.
    // mp4 dosyaları genelde ilk birkaç bayttan sonra "ftyp" imzası taşır.
    const looksLikeVideo =
      contentType.includes("video") ||
      buffer.subarray(4, 8).toString("ascii") === "ftyp";

    if (!looksLikeVideo) {
      console.warn(
        `Apify video URL did not return real video data (content-type: "${contentType}", first bytes: "${buffer.subarray(0, 20).toString("utf8").replace(/[^\x20-\x7E]/g, "?")}"). Falling back.`
      );
      return null;
    }

    if (buffer.length > 20 * 1024 * 1024) {
      console.warn("Apify video exceeds 20MB, falling back to tikwm.");
      return null;
    }

    return {
      buffer,
      caption: item?.text || item?.desc || "",
    };
  } catch (err) {
    console.error("Apify TikTok download failed, will fall back to tikwm:", err);
    return null;
  }
}

// ── FALLBACK: tikwm.com (free, unofficial) ──
async function downloadTikTokViaTikwm(
  url: string
): Promise<{ buffer: Buffer; caption: string }> {
  const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
  const resp = await fetch(apiUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; RealHookUGC/1.0)" },
  });

  if (!resp.ok) {
    throw new Error(
      "Could not resolve TikTok video. Make sure the link is public and try again."
    );
  }

  const json = await resp.json();
  const videoUrl = json.data?.play || json.data?.wmplay;
  if (!videoUrl) {
    throw new Error(
      "Could not extract video download link. The video may be private or deleted."
    );
  }

  const videoResp = await fetch(videoUrl);
  if (!videoResp.ok) {
    throw new Error("Failed to download the video file from TikTok CDN.");
  }

  const arrayBuf = await videoResp.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);

  const contentType = videoResp.headers.get("content-type") || "";
  const looksLikeVideo =
    contentType.includes("video") ||
    buffer.subarray(4, 8).toString("ascii") === "ftyp";

  if (!looksLikeVideo) {
    throw new Error(
      "The downloaded file wasn't a valid video. The link may be broken or the video removed."
    );
  }

  if (buffer.length > 20 * 1024 * 1024) {
    throw new Error(
      "Video file exceeds 20 MB. Please test with a shorter or lower-resolution clip."
    );
  }

  return {
    buffer,
    caption: json.data?.title || json.data?.desc || "",
  };
}

// ── Combined download: Apify first (if token present), tikwm fallback ──
async function downloadTikTokVideo(
  url: string
): Promise<{ buffer: Buffer; caption: string; source: "apify" | "tikwm" }> {
  const apifyToken = process.env.APIFY_API_TOKEN;

  if (apifyToken) {
    const viaApify = await downloadTikTokViaApify(url, apifyToken);
    if (viaApify) {
      return { ...viaApify, source: "apify" };
    }
    console.warn("Falling back to tikwm for this request.");
  }

  const viaTikwm = await downloadTikTokViaTikwm(url);
  return { ...viaTikwm, source: "tikwm" };
}

// ── Retry wrapper for transient Gemini overload errors ──
async function generateWithRetry(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  parts: Parameters<
    ReturnType<GoogleGenerativeAI["getGenerativeModel"]>["generateContent"]
  >[0],
  maxRetries = 2
) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await model.generateContent(parts);
    } catch (err: unknown) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      const isTransient =
        message.includes("503") ||
        message.includes("429") ||
        message.includes("overloaded") ||
        message.includes("high demand");

      if (!isTransient || attempt === maxRetries) {
        throw err;
      }

      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw lastError;
}

// ── POST /api/analyze ──
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { url, licenseKey } = body;

    const isPro = await isLicenseValid(licenseKey);

    if (!isPro) {
      const ip = getClientIp(req);
      const { allowed } = checkRateLimit(ip);
      if (!allowed) {
        return NextResponse.json(
          {
            error:
              "You've hit today's free scan limit (3/day). Upgrade to PRO for unlimited scans, or come back tomorrow.",
          },
          { status: 429 }
        );
      }
    }

    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      return NextResponse.json(
        { error: "Please paste a valid video URL." },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Server configuration error — AI engine key is missing." },
        { status: 500 }
      );
    }

    const isTikTok = url.includes("tiktok.com") || url.includes("vm.tiktok.com");
    if (!isTikTok) {
      return NextResponse.json(
        {
          error:
            "Currently only TikTok links are supported. Instagram Reels support is coming soon.",
        },
        { status: 400 }
      );
    }

    const { buffer, caption, source } = await downloadTikTokVideo(url);
    console.log(`Video downloaded via: ${source}`);

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.3,
      },
    });

    const result = await generateWithRetry(model, [
      {
        inlineData: {
          mimeType: "video/mp4",
          data: buffer.toString("base64"),
        },
      },
      {
        text: `${MASTER_PROMPT}\n\nVideo caption from the platform: "${caption}"\n\nWatch the entire video carefully, then output your strict JSON analysis.`,
      },
    ]);

    const text = result.response.text();

    let analysis;
    try {
      analysis = JSON.parse(text);
    } catch {
      console.error("Gemini returned non-JSON:", text);
      return NextResponse.json(
        { error: "AI returned an unexpected response. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ ...analysis, isPro });
  } catch (err: unknown) {
    const rawMessage =
      err instanceof Error ? err.message : "Unexpected error during video analysis.";

    const isOverloaded =
      rawMessage.includes("503") ||
      rawMessage.includes("overloaded") ||
      rawMessage.includes("high demand");

    const message = isOverloaded
      ? "Our AI engine is under heavy load right now. Please try again in a few seconds."
      : rawMessage;

    console.error("RealHookUGC analysis error:", rawMessage);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
