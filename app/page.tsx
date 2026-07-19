"use client";

import React, { useState } from "react";
import { 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  ArrowRight, 
  Copy, 
  Check, 
  Zap, 
  Lock, 
  Play 
} from "lucide-react";

// Tip tanımlamaları (API'den gelecek JSON şemamız)
interface AnalysisResult {
  overall_score: number;
  status: "APPROVED" | "REJECTED";
  rejection_reason?: string;
  category_scores: {
    hook_strength: number;
    clarity_environment: number;
    brand_alignment_organicity: number;
    engagement_pacing: number;
    conversion_potential: number;
  };
  standardized_feedback: string;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Analiz butonuna basıldığında çalışacak fonksiyon
  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setResult(null);

    // Gerçekçi bir tarama hissi için simüle edilmiş animasyon adımları
    setLoadingStep("Extracting video frames via Apify...");
    setTimeout(() => setLoadingStep("Scanning 0-0.5s visual hook..."), 1200);
    setTimeout(() => setLoadingStep("Hunting for 'Hey guys' & corporate ad language..."), 2500);
    setTimeout(() => setLoadingStep("Applying UGCMaxxing 1-5 scoring matrix..."), 3800);

    try {
      // BİR SONRAKİ ADIMDA YAZACAĞIMIZ BACKEND API'YE İSTEK
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) throw new Error("API Error");
      const data = await response.json();
      setResult(data);
    } catch (error) {
      // API henüz bağlı olmadığı için arayüzü test etmeni sağlayacak ÖRNEK (MOCK) ÇIKTI:
      setTimeout(() => {
        setResult({
          overall_score: 2.4,
          status: "REJECTED",
          rejection_reason: "Failed The 0.5-Second Rule & Portfolio Fluency",
          category_scores: {
            hook_strength: 1.5,
            clarity_environment: 4.0,
            brand_alignment_organicity: 1.8,
            engagement_pacing: 2.5,
            conversion_potential: 2.0,
          },
          standardized_feedback: "needs a stronger visual hook — cut the 1.5s intro greeting, speed up to 1.1x, and add native on-screen text instantly.",
        });
        setLoading(false);
      }, 4500);
      return;
    }

    setLoading(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-rose-500 selection:text-white">
      {/* Navbar */}
      <nav className="border-b border-slate-800/80 bg-slate-950/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-600/30">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <span>RealHook<span className="text-rose-500">UGC</span></span>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium">
            <span className="text-slate-400 hidden sm:inline">The 0.5-Second Engine for App Founders</span>
            <a href="#pro" className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg border border-slate-700 transition">
              PRO Login
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-4 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold uppercase tracking-wider mb-8">
          <Sparkles className="w-3.5 h-3.5" />
          Powered by the 2-Billion-View UGCMaxxing Playbook
        </div>
        
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-none mb-6">
          Does Your UGC Stop the Scroll in <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-orange-400">0.5 Seconds</span>, or Burn Your Budget?
        </h1>
        
        <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Stop guessing why your app ads fail. Paste a TikTok or Reels link. Our AI ruthlessly scores your visual hook, ad-language, and pacing against proven mobile app benchmarks.
        </p>

        {/* URL Input Form */}
        <form onSubmit={handleAnalyze} className="max-w-2xl mx-auto mb-6">
          <div className="relative flex items-center">
            <input
              type="url"
              required
              placeholder="Paste TikTok or Instagram Reels link here..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-5 py-4 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition pr-36 shadow-2xl disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading}
              className="absolute right-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold px-6 py-2.5 rounded-lg transition shadow-lg shadow-rose-600/30 flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? "Scanning..." : "Test Hook"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </form>

        <div className="flex items-center justify-center gap-6 text-xs text-slate-500 font-medium">
          <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" /> 3 Free Daily Scans</span>
          <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" /> No Credit Card Required</span>
          <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" /> Instant Playbook Feedback</span>
        </div>
      </section>

      {/* Loading Animation State */}
      {loading && (
        <section className="max-w-2xl mx-auto px-4 py-12 text-center">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 backdrop-blur animate-pulse">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center mx-auto mb-4 animate-spin">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-slate-200 mb-2">Auditing Video Content...</h3>
            <p className="text-sm font-mono text-rose-400">{loadingStep}</p>
          </div>
        </section>
      )}

      {/* Results Section */}
      {result && !loading && (
        <section className="max-w-3xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className={`border rounded-2xl p-6 sm:p-8 backdrop-blur shadow-2xl ${
            result.status === "APPROVED" 
              ? "bg-emerald-950/20 border-emerald-500/30 shadow-emerald-950/50" 
              : "bg-rose-950/20 border-rose-500/30 shadow-rose-950/50"
          }`}>
            
            {/* Header / Score Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80 mb-6">
              <div className="flex items-center gap-3">
                {result.status === "APPROVED" ? (
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 flex-shrink-0" />
                ) : (
                  <ShieldAlert className="w-10 h-10 text-rose-500 flex-shrink-0" />
                )}
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Playbook Verdict</span>
                  <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                    {result.status === "APPROVED" ? "APPROVED TO POST" : "REJECTED BY QC"}
                  </h2>
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-right self-start sm:self-auto">
                <span className="text-xs text-slate-400 block">Overall QC Score</span>
                <span className={`text-2xl font-black ${result.status === "APPROVED" ? "text-emerald-400" : "text-rose-400"}`}>
                  {result.overall_score} <span className="text-sm font-normal text-slate-500">/ 5.0</span>
                </span>
              </div>
            </div>

            {/* Rejection Reason if any */}
            {result.rejection_reason && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 mb-6 flex items-start gap-3 text-rose-300 text-sm">
                <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold block text-rose-200">Why It Failed:</strong>
                  {result.rejection_reason}
                </div>
              </div>
            )}

            {/* 5 Playbook Metrics Grid */}
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">The 5 Vetting Checks Breakdown</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {Object.entries(result.category_scores).map(([key, score]) => {
                const label = key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
                const isLow = score <= 2.0;
                return (
                  <div key={key} className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-sm text-slate-300 font-medium">{label}</span>
                    <span className={`text-sm font-bold px-2 py-0.5 rounded font-mono ${
                      isLow ? "bg-rose-500/20 text-rose-400" : "bg-slate-800 text-slate-200"
                    }`}>
                      {score} / 5.0
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Standardized Feedback (The One-Round Rule) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                  <Play className="w-3 h-3 fill-current" />
                  Standardized Creator Feedback (The One-Round Rule)
                </span>
                <button
                  onClick={() => copyToClipboard(result.standardized_feedback)}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded border border-slate-700 transition flex items-center gap-1.5"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied!" : "Copy for Creator"}
                </button>
              </div>
              <p className="text-slate-200 font-mono text-sm leading-relaxed bg-slate-950 p-3 rounded border border-slate-800/80 select-all">
                &ldquo;{result.standardized_feedback}&rdquo;
              </p>
            </div>

          </div>
        </section>
      )}

      {/* Monetization / Upsell Section (The Wedge to PRO) */}
      <section id="pro" className="max-w-4xl mx-auto px-4 py-16">
        <div className="bg-gradient-to-b from-slate-900 to-slate-900/40 border border-slate-800 rounded-3xl p-8 sm:p-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold uppercase tracking-wider mb-6">
              <Lock className="w-3.5 h-3.5" />
              Scale Your UGC Engine
            </div>
            
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
              Stop Testing Links One by One.
            </h2>
            
            <p className="text-slate-400 text-base mb-8 leading-relaxed">
              Managing 10, 50, or 250 creators? Don&apos;t waste your mornings pasting links. Upgrade to <strong className="text-slate-200 font-semibold">RealHookUGC PRO</strong> and automate your entire quality control workflow.
            </p>

            <ul className="space-y-3 mb-8 text-sm text-slate-300">
              <li className="flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 text-rose-500 flex-shrink-0" />
                <span><strong className="text-white">Bulk CSV / Excel Scans:</strong> Audit 50+ creator videos in 10 seconds flat.</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 text-rose-500 flex-shrink-0" />
                <span><strong className="text-white">1-Page Smart Brief Generator:</strong> Create playbook-aligned briefs in 3 clicks.</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 text-rose-500 flex-shrink-0" />
                <span><strong className="text-white">Account Warm-Up Radar:</strong> Track if creator algorithms are warmed up before posting.</span>
              </li>
            </ul>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <a
                href="#checkout" // Lemon Squeezy veya Gumroad linkini buraya bağlayacağız
                className="bg-white hover:bg-slate-100 text-slate-950 font-bold px-8 py-4 rounded-xl transition shadow-xl text-center flex items-center justify-center gap-2"
              >
                Get PRO Access — $39/month
                <ArrowRight className="w-4 h-4" />
              </a>
              <span className="text-xs text-slate-500 text-center sm:text-left">
                Cancel anytime • Instant access <br /> Less than 1 cost of a bad UGC video
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-8 text-center text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} RealHookUGC. Built for mobile app founders who care about downloads, not vanity views.</p>
      </footer>
    </main>
  );
}