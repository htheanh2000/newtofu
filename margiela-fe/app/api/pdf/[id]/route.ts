import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { withApiErrorNotify } from "@/lib/with-api-error-notify";

// For local development
const LOCAL_CHROME_PATH = process.platform === "darwin" 
  ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  : process.platform === "win32"
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : "/usr/bin/google-chrome";

async function getHandler(
  request: NextRequest,
  context?: { params?: Promise<{ id: string }> }
) {
  const { id } = await (context?.params ?? Promise.resolve({ id: "" }));
  const locale = request.nextUrl.searchParams.get("locale") || "en";

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  let browser = null;
  
  try {
    // Get the base URL from the request; scan page with locale so PDF is in correct language
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const scanUrl = `${baseUrl}/${locale}/scan/${id}?print=true`;

    // Launch browser - use chromium for Vercel, local Chrome for development
    const isVercel = process.env.VERCEL === "1" || process.env.AWS_LAMBDA_FUNCTION_NAME;
    
    if (isVercel) {
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: { width: 794, height: 1123 },
        executablePath: await chromium.executablePath(),
        headless: true,
      });
    } else {
      browser = await puppeteer.launch({
        executablePath: LOCAL_CHROME_PATH,
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    }

    const page = await browser.newPage();
    
    // Set viewport to A4 size for consistent rendering
    await page.setViewport({
      width: 794,  // A4 width at 96 DPI
      height: 1123, // A4 height at 96 DPI
      deviceScaleFactor: 2,
    });

    // Navigate to the scan page
    await page.goto(scanUrl, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    // Wait for the music sheet to render
    await page.waitForSelector("#printable-content", { timeout: 10000 });
    
    // Additional wait for VexFlow SVG to render
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Generate PDF
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "15mm",
        right: "15mm",
        bottom: "15mm",
        left: "15mm",
      },
    });

    await browser.close();

    // Return PDF with appropriate headers
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="margiela-composition-${id}.pdf"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    
    if (browser) {
      await browser.close();
    }
    
    return NextResponse.json(
      { error: "Failed to generate PDF", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export const GET = withApiErrorNotify(getHandler);
