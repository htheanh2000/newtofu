/**
 * Margiela PDF Generation Service
 * Generates PDF from music sheet. FE updates pdfUrl in DB when it receives the response.
 */

if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  require('dotenv').config();
}

const express = require('express');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const isLambda = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

const LOG_PREFIX = '[margiela-pdf]';

function log(event, data = {}) {
  console.log(JSON.stringify({ route: LOG_PREFIX, event, ...data }));
}

function logError(event, data = {}) {
  console.error(JSON.stringify({ route: LOG_PREFIX, event, ...data }));
}

const app = express();
app.use(cors());
app.use(express.json());

// Configuration
const PORT = process.env.PORT || 3456;
const APP_URL = process.env.APP_URL || 'https://springsummer2026margiela.com';
const ORIGIN_URL = process.env.ORIGIN_URL || APP_URL;
const PDF_DIR = process.env.PDF_DIR || (isLambda ? '/tmp/pdfs' : path.join(__dirname, 'pdfs'));
const PUBLIC_URL = process.env.PUBLIC_URL || 'https://v42svjp2rnfuvkhuaatp2z4oxm0ouluo.lambda-url.ap-southeast-1.on.aws';
const S3_BUCKET = process.env.S3_BUCKET;
const S3_PREFIX = (process.env.S3_PREFIX || 'pdfs/').replace(/\/?$/, '/');
const S3_PRESIGNED_EXPIRY = Number(process.env.S3_PRESIGNED_EXPIRY_SECONDS) || 604800; // 7 days
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

/**
 * Notify Slack when PDF generation fails. Fire-and-forget, never throws.
 */
function notifySlackOfPdfError(compositionId, errorMessage, context = {}) {
  if (!SLACK_WEBHOOK_URL) {
    return;
  }
  const payload = JSON.stringify({
    text: `[margiela-pdf] PDF generation failed`,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `*PDF generation failed*\n• compositionId: \`${compositionId}\`\n• error: ${errorMessage}\n• context: ${JSON.stringify(context)}` } }
    ]
  });
  try {
    const u = new URL(SLACK_WEBHOOK_URL);
    const req = https.request({
      hostname: u.hostname,
      port: 443,
      path: u.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, () => {});
    req.on('error', () => {});
    req.setTimeout(5000, () => req.destroy());
    req.write(payload);
    req.end();
  } catch (_) {}
}

log('init', {
  isLambda,
  APP_URL,
  PDF_DIR,
  hasS3: Boolean(S3_BUCKET),
  S3_BUCKET: S3_BUCKET || null,
});

// Ensure PDF directory exists
if (!fs.existsSync(PDF_DIR)) {
  fs.mkdirSync(PDF_DIR, { recursive: true });
}

// Browser instance (reused for performance)
let browser = null;

async function getBrowser() {
  if (!browser) {
    log('browser_launch_start', { isLambda });
    const start = Date.now();
    try {
      if (isLambda) {
        const chromium = require('@sparticuz/chromium');
        const puppeteer = require('puppeteer-core');
        browser = await puppeteer.launch({
          args: chromium.args,
          defaultViewport: chromium.defaultViewport,
          executablePath: await chromium.executablePath(),
          headless: chromium.headless,
        });
      } else {
        const puppeteer = require('puppeteer');
        browser = await puppeteer.launch({
          headless: 'new',
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        });
      }
      log('browser_launch_ok', { elapsedMs: Date.now() - start });
    } catch (err) {
      logError('browser_launch_failed', { error: err.message, elapsedMs: Date.now() - start });
      throw err;
    }
  }
  return browser;
}

/**
 * Generate PDF from scan page
 * @param {string} compositionId
 * @param {string} [locale='en'] - en | zh for scan page path
 */
async function generatePdf(compositionId, locale = 'en') {
  const scanUrl = `${ORIGIN_URL}/${locale}/scan/${compositionId}?print=true`;
  const PAGE_LOAD_TIMEOUT_MS = 90000;
  const SELECTOR_TIMEOUT_MS = 120000;
  const startMs = Date.now();

  log('generate_start', { compositionId, locale, scanUrl, PAGE_LOAD_TIMEOUT_MS, SELECTOR_TIMEOUT_MS });

  const browser = await getBrowser();
  const page = await browser.newPage();

  const pageErrors = [];
  const pageConsole = [];
  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`;
    pageConsole.push(text);
    if (pageConsole.length <= 20) log('page_console', { compositionId, text });
  });
  page.on('pageerror', err => {
    pageErrors.push(err.message);
    log('page_error', { compositionId, error: err.message });
  });
  page.on('requestfailed', req => {
    log('page_request_failed', { compositionId, url: req.url(), reason: req.failure()?.errorText });
  });

  try {
    await page.setViewport({ width: 794, height: 1123 });

    log('page_navigate_start', { compositionId });
    await page.goto(scanUrl, {
      waitUntil: 'domcontentloaded',
      timeout: PAGE_LOAD_TIMEOUT_MS
    });
    log('page_navigate_ok', { compositionId, elapsedMs: Date.now() - startMs });

    // Capture page state after initial load for debugging
    const bodyHTML = await page.evaluate(() => document.body?.innerHTML?.substring(0, 2000) || 'no body');
    log('page_body_snapshot', { compositionId, bodyHTMLLen: bodyHTML.length, bodyHTML });

    log('selector_wait_start', { compositionId, selector: '#printable-content' });
    try {
      await page.waitForSelector('#printable-content', { timeout: SELECTOR_TIMEOUT_MS });
    } catch (selectorErr) {
      const currentHTML = await page.evaluate(() => document.body?.innerHTML?.substring(0, 3000) || 'no body');
      log('selector_timeout_debug', { compositionId, currentHTML, pageErrors, pageConsoleCount: pageConsole.length });
      throw selectorErr;
    }
    log('selector_ok', { compositionId, elapsedMs: Date.now() - startMs });

    log('svg_wait_start', { compositionId });
    await page.waitForFunction(() => {
      const content = document.querySelector('#printable-content');
      return content && content.querySelector('svg') !== null;
    }, { timeout: SELECTOR_TIMEOUT_MS });
    log('svg_ok', { compositionId, elapsedMs: Date.now() - startMs });

    await new Promise(resolve => setTimeout(resolve, 3000));

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' }
    });

    log('pdf_rendered', { compositionId, bytes: pdfBuffer.length, elapsedMs: Date.now() - startMs });
    return pdfBuffer;
  } catch (err) {
    logError('generate_failed', { compositionId, error: err.message, elapsedMs: Date.now() - startMs });
    throw err;
  } finally {
    await page.close();
  }
}

/**
 * Save PDF to disk (used when S3_BUCKET is not set, e.g. local or legacy)
 */
function savePdf(compositionId, pdfBuffer) {
  const timestamp = Date.now();
  const filename = `${compositionId}_${timestamp}.pdf`;
  const filepath = path.join(PDF_DIR, filename);

  fs.writeFileSync(filepath, pdfBuffer);
  log('pdf_saved_disk', { compositionId, filename, bytes: pdfBuffer.length });

  return {
    filename,
    filepath,
    url: `${PUBLIC_URL}/pdfs/${filename}`
  };
}

/**
 * Upload PDF to S3 and return presigned URL (stable link, survives Lambda recycle)
 * Requires env: S3_BUCKET. Optional: S3_PREFIX (default pdfs/), S3_PRESIGNED_EXPIRY_SECONDS (default 7 days).
 * Lambda role needs s3:PutObject, s3:GetObject on the bucket.
 */
async function uploadPdfToS3(pdfBuffer, compositionId) {
  if (!S3_BUCKET) {
    throw new Error('S3_BUCKET is not set');
  }
  const timestamp = Date.now();
  const key = `${S3_PREFIX}${compositionId}_${timestamp}.pdf`;
  const client = new S3Client({ region: process.env.AWS_REGION || 'ap-southeast-1' });

  await client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: pdfBuffer,
    ContentType: 'application/pdf',
    CacheControl: 'public, max-age=31536000'
  }));

  const filename = key.split('/').pop();
  const url = `https://${S3_BUCKET}.s3.${process.env.AWS_REGION || 'ap-southeast-1'}.amazonaws.com/${key}`;
  log('pdf_uploaded_s3', { compositionId, key, bytes: pdfBuffer.length, publicUrl: url });

  return { url, key, filename };
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'margiela-pdf' });
});

// Generate PDF endpoint
app.post('/generate/:id', async (req, res) => {
  const compositionId = req.params.id;
  const locale = (req.body && req.body.locale) || 'en';
  
  if (!compositionId) {
    return res.status(400).json({ error: 'compositionId is required' });
  }

  const requestStart = Date.now();
  try {
    log('request_start', { compositionId, locale, method: 'POST' });

    const pdfBuffer = await generatePdf(compositionId, locale);

    let url;
    let filename;
    if (S3_BUCKET) {
      const result = await uploadPdfToS3(pdfBuffer, compositionId);
      url = result.url;
      filename = result.filename;
    } else {
      const saved = savePdf(compositionId, pdfBuffer);
      url = saved.url;
      filename = saved.filename;
    }

    log('request_success', { compositionId, pdfUrl: url, filename, elapsedMs: Date.now() - requestStart });
    res.json({
      success: true,
      compositionId,
      pdfUrl: url,
      filename
    });
  } catch (error) {
    logError('request_failed', { compositionId, error: error.message, elapsedMs: Date.now() - requestStart });
    notifySlackOfPdfError(compositionId, error.message, { method: 'POST', elapsedMs: Date.now() - requestStart });
    res.status(500).json({
      error: error.message
    });
  }
});

// Also support GET for easy testing
app.get('/generate/:id', async (req, res) => {
  const compositionId = req.params.id;
  const locale = req.query.locale || 'en';
  
  if (!compositionId) {
    return res.status(400).json({ error: 'compositionId is required' });
  }

  const requestStart = Date.now();
  try {
    log('request_start', { compositionId, locale, method: 'GET' });
    const pdfBuffer = await generatePdf(compositionId, locale);
    let url;
    let filename;
    if (S3_BUCKET) {
      const result = await uploadPdfToS3(pdfBuffer, compositionId);
      url = result.url;
      filename = result.filename;
    } else {
      const saved = savePdf(compositionId, pdfBuffer);
      url = saved.url;
      filename = saved.filename;
    }
    log('request_success', { compositionId, pdfUrl: url, filename, elapsedMs: Date.now() - requestStart });
    res.json({
      success: true,
      compositionId,
      pdfUrl: url,
      filename
    });
  } catch (error) {
    logError('request_failed', { compositionId, error: error.message, elapsedMs: Date.now() - requestStart });
    notifySlackOfPdfError(compositionId, error.message, { method: 'GET', elapsedMs: Date.now() - requestStart });
    res.status(500).json({ error: error.message });
  }
});

// Serve PDFs — from S3 when configured, otherwise from local disk
if (S3_BUCKET) {
  app.get('/pdfs/:filename', async (req, res) => {
    const filename = req.params.filename;
    const key = `${S3_PREFIX}${filename}`;
    try {
      const client = new S3Client({ region: process.env.AWS_REGION || 'ap-southeast-1' });
      const { Body } = await client.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }));
      const chunks = [];
      for await (const chunk of Body) { chunks.push(chunk); }
      const buffer = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.end(buffer);
    } catch (err) {
      logError('serve_pdf_s3_error', { filename, key, error: err.message });
      res.status(404).json({ error: 'PDF not found' });
    }
  });
} else {
  app.use('/pdfs', express.static(PDF_DIR));
}

// Direct PDF download (returns PDF file)
app.get('/pdf/:id', async (req, res) => {
  const compositionId = req.params.id;
  const locale = req.query.locale || 'en';
  
  try {
    log('pdf_direct_start', { compositionId, locale });
    const pdfBuffer = await generatePdf(compositionId, locale);
    log('pdf_direct_ok', { compositionId, bytes: pdfBuffer.length });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="margiela-${compositionId}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    logError('pdf_direct_failed', { compositionId, error: error.message });
    notifySlackOfPdfError(compositionId, error.message, { endpoint: '/pdf/:id' });
    res.status(500).json({ error: error.message });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  log('shutdown', { hasBrowser: Boolean(browser) });
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

// Only listen when not running on Lambda
if (!isLambda) {
  app.listen(PORT, () => {
    log('listening', { PORT, health: `http://localhost:${PORT}/health`, generate: `http://localhost:${PORT}/generate/:id` });
  });
}

module.exports = app;
