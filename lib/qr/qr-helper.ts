import QRCode from "qrcode";

export function getPublicMemberAccessUrl(): string {
  // Configured public application URL (never hardcoded localhost in production)
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXTAUTH_URL || "http://localhost:3000");

  return `${baseUrl.replace(/\/$/, "")}/member-access`;
}

export function getPublicMemberFormUrl(): string {
  // Configured public application URL (never hardcoded localhost in production)
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXTAUTH_URL || "http://localhost:3000");

  return `${baseUrl.replace(/\/$/, "")}/member-form`;
}

export async function generateMemberFormQrCodeDataUrl(url?: string): Promise<string> {
  const targetUrl = url || getPublicMemberFormUrl();
  return await QRCode.toDataURL(targetUrl, {
    width: 400,
    margin: 2,
    color: {
      dark: "#9a3412", // Rich Jin Saffron/Amber brand color
      light: "#ffffff",
    },
    errorCorrectionLevel: "H",
  });
}

export async function generateMemberFormQrCodeSvg(url?: string): Promise<string> {
  const targetUrl = url || getPublicMemberFormUrl();
  return await QRCode.toString(targetUrl, {
    type: "svg",
    margin: 2,
    color: {
      dark: "#9a3412",
      light: "#ffffff",
    },
    errorCorrectionLevel: "H",
  });
}

export async function generateMemberAccessQrCodeDataUrl(url?: string): Promise<string> {
  const targetUrl = url || getPublicMemberAccessUrl();
  return await QRCode.toDataURL(targetUrl, {
    width: 400,
    margin: 2,
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
    errorCorrectionLevel: "H",
  });
}

export async function generateMemberAccessQrCodeSvg(url?: string): Promise<string> {
  const targetUrl = url || getPublicMemberAccessUrl();
  return await QRCode.toString(targetUrl, {
    type: "svg",
    margin: 2,
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
    errorCorrectionLevel: "H",
  });
}

