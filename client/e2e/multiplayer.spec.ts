import { expect, test, type Page } from "@playwright/test";

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

async function saveSettingsAndWait(page: Page) {
  const save = page.getByRole("button", { name: "Save settings" });
  const response = page.waitForResponse(
    (candidate) =>
      candidate.url().includes("/rest/v1/rpc/update_settings") &&
      candidate.ok(),
  );
  await save.click();
  await response;
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
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
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
    host.getByRole("button", { name: "Enable audio" }).click(),
    guest.getByRole("button", { name: "Enable audio" }).click(),
  ]);
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
      await expect(host.locator(".preparation-orb .spinner")).toBeVisible();
    }
    await Promise.all([
      expect(host.getByRole("heading", { name: "Who made this?" })).toBeVisible(
        {
          timeout: 20_000,
        },
      ),
      expect(
        guest.getByRole("heading", { name: "Who made this?" }),
      ).toBeVisible({
        timeout: 20_000,
      }),
    ]);
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
  await page.goto(`${baseURL}/create`);
  await page.getByLabel("Nickname").fill("E2E Solo");
  await page.getByLabel("Rounds").selectOption("3");
  await page.getByLabel("Answer time").selectOption("10");
  await page.getByRole("button", { name: "Open the lobby" }).click();
  await expect(page).toHaveURL(/\/room\/[A-HJ-NP-Z2-9]{6}$/);

  await selectDemoPackWhenAvailable(page);
  await saveSettingsAndWait(page);
  await page.getByRole("button", { name: "Enable audio" }).click();
  await page.getByRole("button", { name: "I’m ready" }).click();
  await expect(
    page.getByRole("button", { name: "Start the game" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Start the game" }).click();
  await expect(page.locator(".preparing-screen")).toBeVisible();

  for (let round = 1; round <= 3; round += 1) {
    await expect(
      page.getByRole("heading", { name: "Who made this?" }),
    ).toBeVisible({ timeout: 20_000 });
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
});

test("mobile keyboard flow reports an invalid room without overflow", async ({
  page,
  baseURL,
}) => {
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
  const context = await browser.newContext();
  await context.route("**/audio/*.wav", (route) => route.abort("failed"));
  await context.route("**/storage/v1/object/sign/track-audio/**", (route) =>
    route.abort("failed"),
  );
  const page = await context.newPage();
  await page.goto(`${baseURL}/create`);
  await page.getByLabel("Nickname").fill("Audio Tester");
  await page.getByLabel("Rounds").selectOption("3");
  await page.getByRole("button", { name: "Open the lobby" }).click();
  await expect(page).toHaveURL(/\/room\/[A-HJ-NP-Z2-9]{6}$/);
  await selectDemoPackWhenAvailable(page);
  await saveSettingsAndWait(page);
  await page.getByRole("button", { name: "Enable audio" }).click();
  await page.getByRole("button", { name: "I’m ready" }).click();
  await page.getByRole("button", { name: "Start the game" }).click();
  await expect(page.getByRole("button", { name: "Retry audio" })).toBeVisible({
    timeout: 20_000,
  });
  await context.close();
});
