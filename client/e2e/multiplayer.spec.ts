import { expect, test, type Page } from "@playwright/test";

async function grantPreviewAccess(page: Page) {
  const accessUrl = process.env.E2E_ACCESS_URL;
  if (accessUrl) await page.goto(accessUrl);
}

function trackRuntimeFailures(page: Page) {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(`page: ${error.message}`));
  page.on("requestfailed", (request) => {
    const url = request.url();
    const errorText = request.failure()?.errorText || "";
    if (!url.includes("/audio/") && !errorText.includes("ERR_ABORTED")) {
      failures.push(`request: ${request.method()} ${url} ${errorText}`);
    }
  });
  return failures;
}

async function activateBlockedAudio(page: Page) {
  const play = page.getByRole("button", { name: "Play audio" });
  if (await play.isVisible().catch(() => false)) await play.click();
}

async function waitForRoundOrRetry(host: Page) {
  const heading = host.getByRole("heading", { name: "Who made this?" });
  const retry = host.getByRole("button", {
    name: "Retry playlist preparation",
  });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const outcome = await Promise.race([
      heading
        .waitFor({ state: "visible", timeout: 120_000 })
        .then(() => "playing" as const),
      retry
        .waitFor({ state: "visible", timeout: 120_000 })
        .then(() => "retry" as const),
    ]);
    if (outcome === "playing") return;
    await retry.click();
  }
  await expect(heading).toBeVisible({ timeout: 120_000 });
}

async function waitForDownloadFailure(host: Page) {
  const retry = host.getByRole("button", {
    name: "Retry playlist preparation",
  });
  const alert = host.locator(".status-message[role='alert']").last();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await expect(retry).toBeVisible({ timeout: 120_000 });
    const message = (await alert.textContent()) ?? "";
    if (message.includes("Some playlist audio could not be downloaded")) return;
    await retry.click();
  }
  await expect(alert).toContainText(
    "Some playlist audio could not be downloaded",
  );
}

async function saveSettingsAndWait(page: Page) {
  const demoOption = page
    .getByLabel("Song pack")
    .locator('option[value="demo"]');
  const needsTestPackOverride = (await demoOption.count()) === 0;
  const save = page.getByRole("button", { name: "Save settings" });
  const response = page.waitForResponse(
    (candidate) =>
      candidate.url().includes("/rest/v1/rpc/update_settings") &&
      candidate.ok(),
  );
  await save.click();
  const saved = await response;
  if (needsTestPackOverride) {
    const request = saved.request();
    const body = request.postDataJSON() as {
      p_code: string;
      p_settings: Record<string, unknown>;
    };
    const headers = request.headers();
    const forced = await page.request.post(request.url(), {
      data: {
        ...body,
        p_settings: { ...body.p_settings, song_pack: "demo" },
      },
      headers: {
        apikey: headers.apikey,
        authorization: headers.authorization,
        "content-type": "application/json",
      },
    });
    expect(forced.ok()).toBe(true);
  }
}

async function selectDemoPackWhenAvailable(page: Page) {
  const songPack = page.getByLabel("Song pack");
  await expect(songPack).toBeVisible();
  const demoOption = songPack.locator('option[value="demo"]');
  if ((await demoOption.count()) > 0) {
    await songPack.selectOption("demo");
  }
}

test("two players complete synchronized rounds, reconnect, rank, and play again", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(300_000);
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  await Promise.all([grantPreviewAccess(host), grantPreviewAccess(guest)]);
  const hostFailures = trackRuntimeFailures(host);
  const guestFailures = trackRuntimeFailures(guest);

  await host.goto(`${baseURL}/create`);
  await host.getByLabel("Nickname").fill("E2E Host");
  await host.getByLabel("Rounds").selectOption("3");
  await host.getByLabel("Answer time").selectOption("10");
  await host.getByRole("button", { name: "Open the lobby" }).click();
  await expect(host).toHaveURL(/\/room\/[A-HJ-NP-Z2-9]{6}$/);
  const code = (await host.locator(".room-code").textContent())!.trim();

  await guest.goto(`${baseURL}/join?code=${code}`);
  await guest.getByLabel("Nickname").fill("E2E Guest");
  await guest.getByRole("button", { name: "Join room" }).click();
  await expect(guest).toHaveURL(new RegExp(`/room/${code}$`));
  await expect(host.getByText("E2E Guest", { exact: true })).toBeVisible();

  await host.getByLabel("Reveal time").selectOption("4");
  await selectDemoPackWhenAvailable(host);
  await saveSettingsAndWait(host);

  await Promise.all([
    host.getByRole("button", { name: "I’m ready" }).click(),
    guest.getByRole("button", { name: "I’m ready" }).click(),
  ]);
  await expect(
    host.getByRole("button", { name: "Start the game" }),
  ).toBeEnabled();
  await host.getByRole("button", { name: "Start the game" }).click();

  for (let round = 1; round <= 3; round += 1) {
    if (round === 1) {
      await expect(host.locator(".preparing-screen")).toBeVisible({
        timeout: 20_000,
      });
      await expect(host.getByText("Preparing all 3 rounds")).toBeVisible();
    }
    await waitForRoundOrRetry(host);
    await expect(
      guest.getByRole("heading", { name: "Who made this?" }),
    ).toBeVisible({ timeout: 30_000 });
    await Promise.all([
      activateBlockedAudio(host),
      activateBlockedAudio(guest),
    ]);
    await host.locator(".answer-ai").click();
    if (round < 3) await guest.locator(".answer-real").click();

    await expect(host.getByText(/Answer locked/)).toBeVisible();
    if (round === 2) {
      await guest.reload();
      await expect(guest.getByText(/Answer locked/)).toBeVisible({
        timeout: 12_000,
      });
    }

    await Promise.all([
      expect(host.getByText("Correct answer", { exact: true })).toBeVisible({
        timeout: 18_000,
      }),
      expect(guest.getByText("Correct answer", { exact: true })).toBeVisible({
        timeout: 18_000,
      }),
    ]);
    if (round === 3) {
      await expect(guest.getByText("No answer · 0 points")).toBeVisible();
    }
  }

  await Promise.all([
    expect(host.getByText("Final results", { exact: true })).toBeVisible({
      timeout: 12_000,
    }),
    expect(guest.getByText("Final results", { exact: true })).toBeVisible({
      timeout: 12_000,
    }),
  ]);
  await expect(
    host.getByRole("list", { name: "Leaderboard" }).getByRole("listitem"),
  ).toHaveCount(2);
  await expect(host.locator(".final-song-list li")).toHaveCount(3);
  await expect(host.locator(".final-song-list a")).toHaveCount(3);
  await host.getByRole("button", { name: "Play again with this room" }).click();
  await Promise.all([
    expect(host.getByRole("heading", { name: "Players" })).toBeVisible(),
    expect(guest.getByRole("heading", { name: "Players" })).toBeVisible(),
  ]);

  expect(hostFailures).toEqual([]);
  expect(guestFailures).toEqual([]);
  await Promise.all([hostContext.close(), guestContext.close()]);
});

test("one player completes a full game with prepared rounds", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(300_000);
  await grantPreviewAccess(page);
  let playlistRequests = 0;
  let perRoundAudioRequests = 0;
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (/\/api\/rooms\/[^/]+\/playlist$/.test(path)) playlistRequests += 1;
    if (/\/api\/rooms\/[^/]+\/rounds\/[^/]+\/audio$/.test(path)) {
      perRoundAudioRequests += 1;
    }
  });
  await page.goto(`${baseURL}/create`);
  await page.getByLabel("Nickname").fill("E2E Solo");
  await page.getByLabel("Rounds").selectOption("3");
  await page.getByLabel("Answer time").selectOption("10");
  await page.getByRole("button", { name: "Open the lobby" }).click();
  await expect(page).toHaveURL(/\/room\/[A-HJ-NP-Z2-9]{6}$/);

  await selectDemoPackWhenAvailable(page);
  await saveSettingsAndWait(page);
  await page.getByRole("button", { name: "I’m ready" }).click();
  await expect(
    page.getByRole("button", { name: "Start the game" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Start the game" }).click();
  await expect(page.locator(".preparing-screen")).toBeVisible();
  await expect(page.getByText("Preparing all 3 rounds")).toBeVisible();

  for (let round = 1; round <= 3; round += 1) {
    await waitForRoundOrRetry(page);
    await activateBlockedAudio(page);
    await page.locator(".answer-real").click();
    await expect(page.getByText("Correct answer", { exact: true })).toBeVisible(
      { timeout: 12_000 },
    );
  }

  await expect(page.getByText("Final results", { exact: true })).toBeVisible({
    timeout: 12_000,
  });
  await expect(page.locator(".final-song-list li")).toHaveCount(3);
  await expect(page.locator(".final-song-list a")).toHaveCount(3);
  expect(playlistRequests).toBe(1);
  expect(perRoundAudioRequests).toBe(0);
});

test("host recovers after a player misses the preload deadline", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(180_000);
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  await Promise.all([grantPreviewAccess(host), grantPreviewAccess(guest)]);
  await host.addInitScript(() => {
    const nativePlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function play() {
      if (this.src.startsWith("data:")) return nativePlay.call(this);
      return Promise.reject(new DOMException("Blocked", "NotAllowedError"));
    };
  });
  await guestContext.route("**/audio/*.wav", (route) => route.abort("failed"));

  await host.goto(`${baseURL}/create`);
  await host.getByLabel("Nickname").fill("Timeout Host");
  await host.getByLabel("Rounds").selectOption("3");
  await host.getByLabel("Answer time").selectOption("10");
  await host.getByRole("button", { name: "Open the lobby" }).click();
  const code = (await host.locator(".room-code").textContent())!.trim();

  await guest.goto(`${baseURL}/join?code=${code}`);
  await guest.getByLabel("Nickname").fill("Stalled Guest");
  await guest.getByRole("button", { name: "Join room" }).click();
  await expect(host.getByText("Stalled Guest", { exact: true })).toBeVisible();
  await selectDemoPackWhenAvailable(host);
  await saveSettingsAndWait(host);
  await Promise.all([
    host.getByRole("button", { name: "I’m ready" }).click(),
    guest.getByRole("button", { name: "I’m ready" }).click(),
  ]);
  await host.getByRole("button", { name: "Start the game" }).click();

  await expect(
    host.getByRole("heading", { name: "Some players are still loading." }),
  ).toBeVisible({ timeout: 80_000 });
  await expect(host.getByText("Stalled Guest", { exact: true })).toBeVisible();
  await expect(
    host.getByRole("button", { name: "Retry missing audio" }),
  ).toBeVisible();
  await host.getByRole("button", { name: "Remove player" }).click();
  await expect(
    host.getByRole("heading", { name: "Who made this?" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(host.getByRole("button", { name: "Play audio" })).toBeVisible();

  await Promise.all([hostContext.close(), guestContext.close()]);
});

test("mobile keyboard flow reports an invalid room without overflow", async ({
  page,
  baseURL,
}) => {
  await grantPreviewAccess(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto(`${baseURL}/join`);
  await page.getByLabel("Room code").focus();
  await page.keyboard.type("AAAAAA");
  await page.getByLabel("Nickname").focus();
  await page.keyboard.type("Keyboard Player");
  await page.keyboard.press("Enter");
  await expect(page.locator(".status-message[role='alert']")).toContainText(
    "That room does not exist or has expired.",
  );
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});

test("audio loading failures produce an accessible recovery message", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(300_000);
  const context = await browser.newContext();
  await context.route("**/audio/*.wav", (route) => route.abort("failed"));
  await context.route("**/storage/v1/object/sign/track-audio/**", (route) =>
    route.abort("failed"),
  );
  const page = await context.newPage();
  await grantPreviewAccess(page);
  await page.goto(`${baseURL}/create`);
  await page.getByLabel("Nickname").fill("Audio Tester");
  await page.getByLabel("Rounds").selectOption("3");
  await page.getByRole("button", { name: "Open the lobby" }).click();
  await expect(page).toHaveURL(/\/room\/[A-HJ-NP-Z2-9]{6}$/);
  await selectDemoPackWhenAvailable(page);
  await saveSettingsAndWait(page);
  await page.getByRole("button", { name: "I’m ready" }).click();
  await page.getByRole("button", { name: "Start the game" }).click();
  await waitForDownloadFailure(page);
  await context.close();
});
