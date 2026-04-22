/**
 * Margiela E2E Lambda: runs API flow checks and sends Slack at 8AM HKT daily.
 * Data uses prefix "e2e-daily" so you can identify in DB/Slack.
 * Sends header X-E2E-Cron: margiela-daily so Cloudflare WAF can allow /api (see scripts/cloudflare-waf-allow-e2e.sh).
 *
 * Env: BASE_URL (FE root), SLACK_WEBHOOK_URL_E2E (Slack Incoming Webhook).
 */

const PREFIX = "e2e-daily";
const SLACK_PREFIX = "[E2E-Margiela]";
const E2E_CRON_HEADER = "margiela-daily";

function apiHeaders() {
  return {
    "Content-Type": "application/json",
    "X-E2E-Cron": E2E_CRON_HEADER,
  };
}

function now() {
  const d = new Date();
  return d.toISOString().slice(0, 19).replace(/[-:T]/g, "");
}

function makeCompositionId() {
  return `${PREFIX}-${now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makePayload(compositionId) {
  const date = new Date().toISOString().slice(0, 10);
  return {
    composition: {
      id: compositionId,
      instrument: "piano",
      notes: [
        { id: "n1", pitch: "C4", duration: "q" },
        { id: "n2", pitch: "E4", duration: "h" },
      ],
      duration: 8,
      createdAt: new Date().toISOString(),
    },
    userInfo: {
      firstName: "E2E",
      lastName: "Daily",
      gender: "other",
      dateOfBirth: "1990-01-01",
      country: "Vietnam",
      state: "HN",
      city: "Hanoi",
      postcode: "100000",
      phone: "+84900000000",
      email: `${PREFIX}+${date}@margiela.e2e.local`,
    },
  };
}

async function runE2e(baseUrl) {
  const compositionId = makeCompositionId();
  const payload = makePayload(compositionId);
  const results = { steps: [], ok: true };

  // 1. POST /api/submit
  try {
    const res = await fetch(`${baseUrl}/api/submit`, {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status !== 200) {
      results.ok = false;
      results.steps.push({ name: "POST /api/submit", status: res.status, body });
      return results;
    }
    const saved = body.savedToDb === true;
    if (!saved) {
      results.ok = false;
      results.steps.push({ name: "POST /api/submit", status: res.status, saved: false, body });
      return results;
    }
    results.steps.push({ name: "POST /api/submit", status: 200, savedToDb: body.savedToDb });
  } catch (err) {
    results.ok = false;
    results.steps.push({ name: "POST /api/submit", error: String(err.message || err) });
    return results;
  }

  // 2. GET /api/device/register (optional, for X-Device-ID if whitelist enabled)
  let deviceId = null;
  try {
    const regRes = await fetch(`${baseUrl}/api/device/register`, {
      method: "GET",
      headers: { "X-E2E-Cron": E2E_CRON_HEADER },
    });
    if (regRes.ok) {
      const reg = await regRes.json();
      if (reg?.deviceId) deviceId = reg.deviceId;
    }
  } catch {
    // ignore
  }

  // 3. GET /api/composition/[id]
  try {
    const headers = { ...apiHeaders() };
    if (deviceId) headers["X-Device-ID"] = deviceId;
    delete headers["Content-Type"];
    const res = await fetch(`${baseUrl}/api/composition/${compositionId}`, { headers });
    if (res.status !== 200) {
      results.ok = false;
      results.steps.push({ name: "GET /api/composition/[id]", status: res.status });
      return results;
    }
    const comp = await res.json();
    if (comp?.id !== compositionId) {
      results.ok = false;
      results.steps.push({ name: "GET /api/composition/[id]", mismatch: true });
      return results;
    }
    results.steps.push({ name: "GET /api/composition/[id]", status: 200 });
  } catch (err) {
    results.ok = false;
    results.steps.push({ name: "GET /api/composition/[id]", error: String(err.message || err) });
    return results;
  }

  // 4. GET scan page (SPA route)
  try {
    const res = await fetch(`${baseUrl}/en/scan/${compositionId}`, {
      headers: { Accept: "text/html", "X-E2E-Cron": E2E_CRON_HEADER },
    });
    if (res.status !== 200) {
      results.ok = false;
      results.steps.push({ name: "GET /en/scan/[id]", status: res.status });
      return results;
    }
    results.steps.push({ name: "GET /en/scan/[id]", status: 200 });
  } catch (err) {
    results.ok = false;
    results.steps.push({ name: "GET /en/scan/[id]", error: String(err.message || err) });
    return results;
  }

  // 5. POST /api/generate-pdf/[id] (full flow: generate PDF → S3 → DB pdfUrl)
  const PDF_GEN_TIMEOUT_MS = 150_000; // 2.5 min; FE allows 300s
  try {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), PDF_GEN_TIMEOUT_MS);
    const res = await fetch(`${baseUrl}/api/generate-pdf/${compositionId}`, {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify({ locale: "en" }),
      signal: controller.signal,
    }).finally(() => clearTimeout(to));
    const body = await res.json().catch(() => ({}));
    if (res.status !== 200) {
      results.ok = false;
      results.steps.push({ name: "POST /api/generate-pdf/[id]", status: res.status, body });
      return results;
    }
    const pdfUrl = body?.pdfUrl;
    if (typeof pdfUrl !== "string" || !pdfUrl) {
      results.ok = false;
      results.steps.push({ name: "POST /api/generate-pdf/[id]", status: 200, noPdfUrl: true });
      return results;
    }
    results.steps.push({ name: "POST /api/generate-pdf/[id]", status: 200, hasPdfUrl: true });
  } catch (err) {
    const isTimeout = err?.name === "AbortError";
    results.ok = false;
    results.steps.push({
      name: "POST /api/generate-pdf/[id]",
      error: isTimeout ? "Timeout" : String(err?.message || err),
    });
    return results;
  }

  // 6. GET /api/view-sheet/[id] (device-gated PDF link)
  try {
    const headers = { "X-E2E-Cron": E2E_CRON_HEADER };
    if (deviceId) headers["X-Device-ID"] = deviceId;
    const res = await fetch(`${baseUrl}/api/view-sheet/${compositionId}`, { headers });
    const body = await res.json().catch(() => ({}));
    if (res.status !== 200) {
      results.ok = false;
      results.steps.push({ name: "GET /api/view-sheet/[id]", status: res.status, body });
      return results;
    }
    const viewPdfUrl = body?.pdfUrl;
    if (typeof viewPdfUrl !== "string" || !viewPdfUrl) {
      results.ok = false;
      results.steps.push({ name: "GET /api/view-sheet/[id]", status: 200, noPdfUrl: true });
      return results;
    }
    results.steps.push({ name: "GET /api/view-sheet/[id]", status: 200, hasPdfUrl: true });

    // 7. GET PDF via proxy (verify S3 + proxy 200)
    const proxyUrl = viewPdfUrl.startsWith("http") ? viewPdfUrl : `${baseUrl}${viewPdfUrl.startsWith("/") ? "" : "/"}${viewPdfUrl}`;
    try {
      const pdfRes = await fetch(proxyUrl, {
        headers: { "X-E2E-Cron": E2E_CRON_HEADER },
      });
      if (pdfRes.status !== 200) {
        results.ok = false;
        results.steps.push({ name: "GET PDF (proxy)", status: pdfRes.status });
        return results;
      }
      const ct = pdfRes.headers.get("content-type") || "";
      if (!ct.toLowerCase().includes("application/pdf")) {
        results.ok = false;
        results.steps.push({ name: "GET PDF (proxy)", status: 200, contentType: ct });
        return results;
      }
      results.steps.push({ name: "GET PDF (proxy)", status: 200 });
    } catch (err) {
      results.ok = false;
      results.steps.push({ name: "GET PDF (proxy)", error: String(err?.message || err) });
    }
  } catch (err) {
    results.ok = false;
    results.steps.push({ name: "GET /api/view-sheet/[id]", error: String(err?.message || err) });
  }

  return results;
}

async function sendSlack(webhookUrl, success, results, baseUrl) {
  const emoji = success ? "✅" : "❌";
  const stepLines = results.steps.map((s) => {
    if (s.error) return `  • ${s.name}: ${s.error}`;
    const extra = s.savedToDb != null ? `(DB:${s.savedToDb})` : (s.hasPdfUrl ? "(pdfUrl OK)" : "");
    return `  • ${s.name}: ${s.status ?? ""} ${extra}`.trim();
  }).join("\n");
  const text = `${SLACK_PREFIX} ${emoji} E2E ${success ? "OK" : "FAILED"}\n` +
    `Base: ${baseUrl}\n` +
    `Data prefix: \`${PREFIX}\` (composition id & email)\n` +
    `Steps:\n${stepLines}\n` +
    `Time: ${new Date().toISOString()}`;

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

/**
 * Warm Neon DB by calling an API that touches the database.
 * Runs at 7:55 HKT (5 min before E2E) so Neon is awake when E2E runs at 8:00.
 */
const WARMUP_HEADER = "X-E2E-Warmup";

async function warmNeonDb(baseUrl) {
  const res = await fetch(`${baseUrl}/api/device/register`, {
    method: "GET",
    headers: { "X-E2E-Cron": E2E_CRON_HEADER, [WARMUP_HEADER]: "true" },
  });
  return res.ok;
}

export const handler = async (event, context) => {
  const baseUrl = (process.env.BASE_URL || "").trim().replace(/\/$/, "");
  const webhookUrl = (process.env.SLACK_WEBHOOK_URL_E2E || "").trim();

  if (!baseUrl) {
    console.error("BASE_URL is not set");
    return { statusCode: 500, body: "BASE_URL not set" };
  }

  // Warmup mode: 7:55 HKT - wake Neon DB before E2E runs at 8:00
  if (event?.warmup === true) {
    try {
      const ok = await warmNeonDb(baseUrl);
      return {
        statusCode: ok ? 200 : 500,
        body: JSON.stringify({ warmed: ok }),
      };
    } catch (err) {
      console.error("Neon warmup failed:", err);
      return { statusCode: 500, body: JSON.stringify({ warmed: false, error: String(err?.message || err) }) };
    }
  }

  if (!webhookUrl) {
    console.error("SLACK_WEBHOOK_URL_E2E is not set");
    return { statusCode: 500, body: "SLACK_WEBHOOK_URL_E2E not set" };
  }

  const results = await runE2e(baseUrl);
  const success = results.ok;

  try {
    await sendSlack(webhookUrl, success, results, baseUrl);
  } catch (err) {
    console.error("Slack send failed:", err);
  }

  return {
    statusCode: success ? 200 : 500,
    body: JSON.stringify({
      success,
      steps: results.steps,
      prefix: PREFIX,
      slackPrefix: SLACK_PREFIX,
    }),
  };
};
