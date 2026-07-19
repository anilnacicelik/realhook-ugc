import { NextResponse } from "next/server";
import OpenAI from "openai";

// OpenAI istemcisini başlatıyoruz
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "dummy_key",
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { error: "Video URL is required" },
        { status: 400 }
      );
    }

    // Eğer kullanıcı henüz .env.local dosyasını doldurmadıysa sistem çökmek yerine uyarı/mock dönsün
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "dummy_key") {
      console.warn("OPENAI_API_KEY bulunamadı. Örnek (Mock) veri dönülüyor.");
      return NextResponse.json({
        overall_score: 2.1,
        status: "REJECTED",
        rejection_reason: "Failed The 0.5-Second Rule & Corporate Ad Language",
        category_scores: {
          hook_strength: 1.5,
          clarity_environment: 4.0,
          brand_alignment_organicity: 1.5,
          engagement_pacing: 2.0,
          conversion_potential: 1.5,
        },
        standardized_feedback: "needs a stronger visual hook — cut the corporate greeting, speed up to 1.1x, and add native text on the first frame.",
      });
    }

    /* 
      1. GERÇEK PRODÜKSİYON SENARYOSU: 
      Burada Apify API kullanılarak gelen URL'den videonun metni (transcript) 
      ve video kareleri çekilir. Şimdi yapay zekayı doğrudan UGCMaxxing kurallarına
      göre analiz yapması için tetikliyoruz:
    */

    const systemPrompt = `You are the core AI Quality Control (QC) Engine for "RealHookUGC". Your strict operational protocol is directly derived from the "UGCMaxxing" playbook (2 billion organic views methodology).

Your job is to analyze mobile app UGC videos and score them systematically. You do NOT care about vanity metrics or polish. You only care about authenticity, hook retention, and conversion.

Evaluate the video (represented by this link/content: ${url}) against these EXACT 5 PLAYBOOK CRITERIA (Score each 1.0 to 5.0):

1. HOOK STRENGTH (0-2 Seconds):
- The first 0.5 seconds determines 90% of performance.
- WHAT WORKS (+ points): On-screen native text, sudden movement, a direct hook question, a surprising stat.
- WHAT KILLS IT (- points / automatic fail): Slow pan, logo intro, dead silence, saying "Hey guys / Merhaba arkadaşlar".

2. CLARITY & ENVIRONMENT:
- Audio must be crisp and clear. Setting MUST be a "clean background" (no cluttered rooms).

3. BRAND ALIGNMENT & PORTFOLIO FLUENCY:
- The video MUST look like an organic, raw social media post.
- If it looks or sounds like a polished corporate commercial or an AI-generated avatar, score it severely low. No corporate language!

4. ENGAGEMENT STYLE & PACING:
- Evaluate pacing. If the speech or edit drags, apply the playbook rule: "speed up to 1.1x".
- Check the "15-Second Formula": Hook (0-2s) -> Problem (2-4s) -> Product Intro (3-7s) -> Visual Payoff/Proof (7-12s) -> CTA (Final 2-3s).

5. CONVERSION POTENTIAL:
- Focus on 2-4 core benefits (NOT a list of boring features). Would the viewer download the app immediately?

*** THE ONE-ROUND RULE & REJECTION THRESHOLD ***
- If ANY of the 5 categories scores 2.0 or below, the OVERALL status MUST be "REJECTED".
- Provide ONLY ONE actionable note for revision (The One-Round Rule). Use exact "Standardized Feedback Language":
  * "speed up to 1.1x" (if pacing drags)
  * "needs a stronger visual hook" (if first frame is weak)
  * "clean background" (if setting is cluttered)
  * "first frame must be compelling" (if thumbnail/start wouldn't stop a scroll)

OUTPUT FORMAT (Strict JSON ONLY):
{
  "overall_score": [Average score rounded to 1 decimal, e.g., 4.2],
  "status": ["APPROVED" or "REJECTED"],
  "rejection_reason": [Null if approved, or specify exact failing rule],
  "category_scores": {
    "hook_strength": [1.0-5.0],
    "clarity_environment": [1.0-5.0],
    "brand_alignment_organicity": [1.0-5.0],
    "engagement_pacing": [1.0-5.0],
    "conversion_potential": [1.0-5.0]
  },
  "standardized_feedback": "One single, direct, brutal instruction for the creator based on the playbook vocabulary."
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `Analyze this mobile app UGC video URL according to the UGCMaxxing playbook rules and output strictly valid JSON: ${url}` 
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3, // Daha tutarlı ve acımasız denetim için düşük sıcaklık
    });

    const aiResult = JSON.parse(completion.choices[0].message.content || "{}");

    return NextResponse.json(aiResult);

  } catch (error: any) {
    console.error("Analysis API Error:", error);
    return NextResponse.json(
      { error: "Failed to analyze video content" },
      { status: 500 }
    );
  }
}