import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Vercel Hobby: max 60 saniye timeout
export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// ── Simple in-memory rate limiter ──
// Not persistent across cold starts / multiple instances, but stops casual abuse.
// Matches the "3 free daily scans" promise on the landing page.
const DAILY_LIMIT = 3;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    // 24 saatlik yeni pencere
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

// Geçici Gemini yoğunluk/limit hatalarında (503/429) sessizce yeniden dener
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

      // Exponential backoff: 1s, 2s
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw lastError;
}

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

// ── TikTok video indirme ──
async function downloadTikTokVideo(
  url: string
): Promise<{ buffer: Buffer; caption: string }> {
  // tikwm.com ücretsiz API — TikTok CDN video linkini çözer
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

  // json.data.play = watermark'sız mp4, json.data.wmplay = watermark'lı (daha küçük)
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

  // Gemini inline data limiti ~20 MB
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

// ── POST /api/analyze ──
export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const { allowed, remaining } = checkRateLimit(ip);

    if (!allowed) {
      return NextResponse.json(
        {
          error:
            "You've hit today's free scan limit (3/day). Upgrade to PRO for unlimited scans, or come back tomorrow.",
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { url } = body;

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

    // Platform kontrolü
    const isTikTok =
      url.includes("tiktok.com") || url.includes("vm.tiktok.com");

    if (!isTikTok) {
      return NextResponse.json(
        {
          error:
            "Currently only TikTok links are supported. Instagram Reels support is coming soon.",
        },
        { status: 400 }
      );
    }

    // 1) Videoyu TikTok'tan gerçekten indir
    const { buffer, caption } = await downloadTikTokVideo(url);

    // 2) Gemini'ye videoyu base64 olarak gönder — gerçek kare kare analiz
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
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

    return NextResponse.json(analysis);
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
