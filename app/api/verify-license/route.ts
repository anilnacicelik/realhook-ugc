import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { licenseKey } = await req.json();

    if (!licenseKey || typeof licenseKey !== "string" || !licenseKey.trim()) {
      return NextResponse.json(
        { valid: false, error: "Missing license key." },
        { status: 400 }
      );
    }

    const params = new URLSearchParams();
    params.append("license_key", licenseKey.trim());

    const resp = await fetch(
      "https://api.lemonsqueezy.com/v1/licenses/validate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: params.toString(),
      }
    );

    const data = await resp.json();

    if (!resp.ok || !data.valid) {
      return NextResponse.json(
        {
          valid: false,
          error:
            data.error ||
            "This license key isn't valid, expired, or already deactivated.",
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      valid: true,
      customerEmail: data.meta?.customer_email ?? null,
      productName: data.meta?.product_name ?? null,
    });
  } catch (err) {
    console.error("License verification error:", err);
    return NextResponse.json(
      { valid: false, error: "Verification failed. Please try again." },
      { status: 500 }
    );
  }
}
