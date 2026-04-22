/**
 * Lambda: subscribe to SNS topic (margiela-ecs-alerts), post CloudWatch alarm to Slack webhook.
 * Env: SLACK_WEBHOOK_URL (required)
 */
const https = require('https');

function postSlack(webhookUrl, payload) {
  const body = JSON.stringify(payload);
  const url = new URL(webhookUrl);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => (res.statusCode >= 200 && res.statusCode < 300 ? resolve() : reject(new Error(`${res.statusCode} ${data}`))));
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function parseAlarmMessage(msgStr) {
  try {
    return JSON.parse(msgStr);
  } catch {
    return null;
  }
}

exports.handler = async (event) => {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('SLACK_WEBHOOK_URL not set');
    throw new Error('SLACK_WEBHOOK_URL not set');
  }

  for (const record of event.Records || []) {
    if (record.Sns) {
      const msg = record.Sns.Message;
      const alarm = parseAlarmMessage(msg);
      const state = alarm?.NewStateValue || 'UNKNOWN';
      const alarmName = alarm?.AlarmName || 'Alarm';
      const reason = alarm?.NewStateReason || msg?.substring?.(0, 200) || msg;

      const isOk = state === 'OK';
      const emoji = isOk ? '🟢' : '🔴';
      const text = isOk
        ? `*${alarmName}* – OK\n${reason}`
        : `*${alarmName}* – ALARM\n${reason}`;

      await postSlack(webhookUrl, {
        text: `${emoji} ${text}`,
        unfurl_links: false,
        unfurl_media: false,
      });
    }
  }
  return { ok: true };
};
