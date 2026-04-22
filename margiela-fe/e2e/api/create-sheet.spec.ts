import { test, expect } from "@playwright/test";

const baseURL = process.env.BASE_URL ?? "http://localhost:3000";

function makeCompositionId() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function makePayload(compositionId: string) {
  return {
    composition: {
      id: compositionId,
      instrument: "piano" as const,
      notes: [
        { id: "n1", pitch: "C4", duration: "q" as const },
        { id: "n2", pitch: "E4", duration: "h" as const },
      ],
      duration: 8,
      createdAt: new Date().toISOString(),
    },
    userInfo: {
      firstName: "E2E",
      lastName: "Test",
      gender: "other",
      dateOfBirth: "1990-01-01",
      country: "Vietnam",
      state: "HN",
      city: "Hanoi",
      postcode: "100000",
      phone: "+84900000000",
      email: "e2e@test.margiela.local",
    },
  };
}

test.describe("Create music sheet API", () => {
  test("POST /api/submit creates sheet and returns success", async ({ request }) => {
    const compositionId = makeCompositionId();
    const payload = makePayload(compositionId);

    const res = await request.post(`${baseURL}/api/submit`, { data: payload });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("success", true);

    // Sheet must be saved to DB
    expect(body.savedToDb, "Sheet should be saved to DB").toBe(true);
  });

  test("Sheet is persisted: GET /api/composition/[id] returns the created sheet", async ({
    request,
  }) => {
    const compositionId = makeCompositionId();
    const payload = makePayload(compositionId);

    const submitRes = await request.post(`${baseURL}/api/submit`, {
      data: payload,
    });
    expect(submitRes.status()).toBe(200);
    const submitBody = await submitRes.json();
    expect(submitBody.success).toBe(true);

    // Get device ID for whitelist (optional; no-op if whitelist disabled)
    let deviceHeaders: Record<string, string> = {};
    try {
      const regRes = await request.get(`${baseURL}/api/device/register`);
      if (regRes.ok) {
        const reg = await regRes.json();
        if (reg?.deviceId) deviceHeaders["X-Device-ID"] = reg.deviceId;
      }
    } catch {
      // ignore
    }

    const getRes = await request.get(
      `${baseURL}/api/composition/${compositionId}`,
      { headers: deviceHeaders }
    );

    expect(getRes.status()).toBe(200);
    const composition = await getRes.json();
    expect(composition).toMatchObject({
      id: compositionId,
      instrument: "piano",
      duration: 8,
    });
    expect(composition).toHaveProperty("notes");
    expect(composition).toHaveProperty("createdAt");
  });

  test("Sheet saved to database when DATABASE_URL is set", async ({
    request,
  }) => {
    const compositionId = makeCompositionId();
    const payload = makePayload(compositionId);

    const submitRes = await request.post(`${baseURL}/api/submit`, {
      data: payload,
    });
    expect(submitRes.status()).toBe(200);
    const body = await submitRes.json();
    expect(body.success).toBe(true);

    if (body.savedToDb === true) {
      let deviceHeaders: Record<string, string> = {};
      try {
        const regRes = await request.get(`${baseURL}/api/device/register`);
        if (regRes.ok) {
          const reg = await regRes.json();
          if (reg?.deviceId) deviceHeaders["X-Device-ID"] = reg.deviceId;
        }
      } catch {
        // ignore
      }
      const getRes = await request.get(
        `${baseURL}/api/composition/${compositionId}`,
        { headers: deviceHeaders }
      );
      expect(getRes.status()).toBe(200);
      const composition = await getRes.json();
      expect(composition.id).toBe(compositionId);
    }
  });


  test("Composition URL works: scan page returns 200", async ({ request }) => {
    const compositionId = makeCompositionId();
    const payload = makePayload(compositionId);

    const submitRes = await request.post(`${baseURL}/api/submit`, {
      data: payload,
    });
    expect(submitRes.status()).toBe(200);

    const scanPageRes = await request.get(
      `${baseURL}/en/scan/${compositionId}`,
      { headers: { Accept: "text/html" } }
    );
    expect(
      scanPageRes.status(),
      "Scan page URL should be reachable"
    ).toBe(200);
  });
});
