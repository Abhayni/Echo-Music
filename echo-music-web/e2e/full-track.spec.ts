import { expect, test } from "@playwright/test";

test("authorized full recording stays in Echo Music, plays beyond 30 seconds, and seeks", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("http://localhost:5173/search");
  await page.getByRole("textbox", { name: "Search music" }).fill("Limbo with Summer Crickets");
  const play = page.getByRole("button", { name: "Play Limbo (with Summer Crickets)" }).first();
  await expect(play).toBeVisible({ timeout: 20000 });
  await expect(page.getByText("Matthew C. Wright", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Internet Archive · Full track")).toBeVisible();

  await play.click();
  await expect(page.getByTestId("mini-player")).toBeVisible();
  await expect(page.getByText("Matthew C. Wright", { exact: true }).last()).toBeVisible();
  await expect(page).toHaveURL("http://localhost:5173/search");
  await page.waitForFunction(() => {
    const text = document.querySelector(".mini-player .time")?.textContent ?? "";
    const match = text.match(/^(\d+):(\d{2})\s+\//);
    return match !== null && Number(match[1]) * 60 + Number(match[2]) > 30;
  }, undefined, { timeout: 70000 });

  const seek = page.getByRole("slider", { name: "Seek" });
  const seekBounds = await seek.boundingBox();
  if (!seekBounds) throw new Error("Seek control is not visible");
  await seek.click({ position: { x: seekBounds.width / 2, y: seekBounds.height / 2 } });
  await expect.poll(async () => {
    const text = await page.locator(".mini-player .time").innerText();
    const match = text.match(/^(\d+):(\d{2})\s+\//);
    return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
  }).toBeGreaterThan(60);
  await page.getByRole("button", { name: "Pause" }).click();
  const miniPlayer = page.getByTestId("mini-player");
  await expect(miniPlayer.getByRole("button", { name: "Play" })).toBeVisible();
  await miniPlayer.getByRole("button", { name: "Play" }).click();
  await expect(miniPlayer.getByRole("button", { name: "Pause" })).toBeVisible();
});

test("Audius official search stream plays, seeks, pauses, and resumes", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("http://localhost:5173/search");
  await page.getByRole("textbox", { name: "Search music" }).fill("workit daftpunk flip");
  await page.getByRole("button", { name: /^Audius/ }).click();
  const play = page.getByRole("button", { name: "Play workit (daftpunk flip)" });
  await expect(play).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("Audius · Full track")).toBeVisible();

  await play.click();
  const miniPlayer = page.getByTestId("mini-player");
  await expect(miniPlayer.getByRole("button", { name: "Pause" })).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => {
    const text = document.querySelector(".mini-player .time")?.textContent ?? "";
    const match = text.match(/^(\d+):(\d{2})\s+\//);
    return match !== null && Number(match[1]) * 60 + Number(match[2]) > 1;
  }, undefined, { timeout: 25000 });

  const seek = page.getByRole("slider", { name: "Seek" });
  const seekBounds = await seek.boundingBox();
  if (!seekBounds) throw new Error("Seek control is not visible");
  await seek.click({ position: { x: seekBounds.width / 2, y: seekBounds.height / 2 } });
  await expect.poll(async () => {
    const text = await page.locator(".mini-player .time").innerText();
    const match = text.match(/^(\d+):(\d{2})\s+\//);
    return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
  }).toBeGreaterThan(30);
  await miniPlayer.getByRole("button", { name: "Pause" }).click();
  await expect(miniPlayer.getByRole("button", { name: "Play" })).toBeVisible();
  await miniPlayer.getByRole("button", { name: "Play" }).click();
  await expect(miniPlayer.getByRole("button", { name: "Pause" })).toBeVisible();
});

test("queue next and previous use the shared full-track player", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("http://localhost:5173/search");
  await page.getByRole("textbox", { name: "Search music" }).fill("Alan Walker");
  const force = page.getByRole("button", { name: "Play Force" });
  await expect(force).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole("button", { name: "Play Fade" })).toBeVisible();
  await force.click();

  await page.getByRole("button", { name: "Open queue" }).click();
  await expect(page.getByText("Force", { exact: true }).last()).toBeVisible();
  await page.getByRole("button", { name: "Close queue" }).click();
  await page.getByRole("button", { name: "Repeat off" }).click();
  await expect(page.getByRole("button", { name: "Repeat all" })).toBeVisible();
  await page.getByRole("button", { name: "Repeat all" }).click();
  await expect(page.getByRole("button", { name: "Repeat one" })).toBeVisible();
  await page.getByRole("button", { name: "Repeat one" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.locator(".mini-track")).toContainText("Fade");
  await page.getByRole("button", { name: "Previous" }).click();
  await expect(page.locator(".mini-track")).toContainText("Force");
  await page.getByRole("button", { name: "Toggle shuffle" }).click();
  await expect(page.getByRole("button", { name: "Toggle shuffle" })).toHaveClass(/active/);
  await page.getByRole("button", { name: "Mute" }).click();
  await expect(page.getByRole("button", { name: "Unmute" })).toBeVisible();
  await page.getByRole("button", { name: "Unmute" }).click();
  const volume = page.getByRole("slider", { name: "Volume" });
  await volume.focus();
  await volume.press("ArrowLeft");
  await expect(volume).not.toHaveValue("0.8");
  await expect(page).toHaveURL("http://localhost:5173/search");
});

test("YouTube metadata resolves to an exact authorized match in the shared player without redirecting", async ({ page }) => {
  const sampleRate = 8000;
  const dataLength = sampleRate * 20 * 2;
  const wav = Buffer.alloc(44 + dataLength);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + dataLength, 4);
  wav.write("WAVE", 8);
  wav.write("fmt ", 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(dataLength, 40);

  await page.route("**/api/search?**", async route => {
    const url = new URL(route.request().url());
    const results = url.searchParams.has("providers")
      ? [{
        id: "audius:track-123",
        providerId: "audius",
        providerName: "Audius",
        title: "Tum Hi Ho",
        artist: "Arijit Singh",
        audioUrl: "https://api.audius.co/v1/tracks/track-123/stream?app_name=echo-music-web",
        playback: { status: "available", providerId: "audius" },
        kind: "song",
      }]
      : [{
        id: "youtube-music:video-123",
        videoId: "video-123",
        providerId: "youtube-music",
        providerName: "YouTube Music",
        title: "Tum Hi Ho",
        artist: "Arijit Singh",
        artwork: "https://i.ytimg.com/vi/video-123/hqdefault.jpg",
        durationSeconds: 262,
        playback: { status: "unavailable", reason: "YouTube metadata is not an audio stream." },
        kind: "song",
      }, {
        id: "audius:other",
        providerId: "audius",
        providerName: "Audius",
        title: "Other Song",
        artist: "Other Artist",
        audioUrl: "https://api.audius.co/v1/tracks/other/stream?app_name=echo-music-web",
        playback: { status: "available", providerId: "audius" },
        kind: "song",
      }];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ providers: [], errors: [], category: "all", results, total: results.length, nextOffset: null }),
    });
  });
  await page.route("https://api.audius.co/v1/tracks/*/stream**", route => route.fulfill({
    status: 200,
    contentType: "audio/wav",
    body: wav,
  }));
  await page.goto("http://localhost:5173/search");
  await page.getByRole("textbox", { name: "Search music" }).fill("Tum Hi Ho");
  await expect(page.getByRole("button", { name: "Find authorized audio for Tum Hi Ho" })).toBeEnabled();
  await expect(page.getByRole("link", { name: /Open .* on YouTube Music/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Find authorized audio for Tum Hi Ho" }).click();
  const miniPlayer = page.getByTestId("mini-player");
  await expect(miniPlayer).toBeVisible();
  await expect(miniPlayer.locator(".mini-track")).toContainText("Tum Hi Ho");
  await expect(miniPlayer.locator(".mini-track")).toContainText("Playback source: Audius");
  await expect(miniPlayer.locator(".mini-track")).toContainText("Matched from YouTube Music: Tum Hi Ho · Arijit Singh");
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Playing on YouTube" })).toHaveCount(0);
  await expect(page).toHaveURL("http://localhost:5173/search");

  const playButton = miniPlayer.locator(".play-button");
  await expect(playButton).not.toHaveAttribute("aria-label", "Loading playback");
  if (await playButton.getAttribute("aria-label") === "Play") await playButton.click();
  await expect(playButton).toHaveAttribute("aria-label", "Pause");
  await page.waitForFunction(() => {
    const text = document.querySelector(".mini-player .time")?.textContent ?? "";
    const match = text.match(/^(\d+):(\d{2})\s+\//);
    return match !== null && Number(match[1]) * 60 + Number(match[2]) > 0;
  });
  const seek = miniPlayer.getByRole("slider", { name: "Seek" });
  await seek.focus();
  await seek.press("ArrowRight");
  await expect.poll(async () => {
    const text = await miniPlayer.locator(".time").innerText();
    const match = text.match(/^(\d+):(\d{2})\s+\//);
    return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
  }).toBeGreaterThan(1);
  await playButton.click();
  await expect(playButton).toHaveAttribute("aria-label", "Play");
  await playButton.click();
  await expect(playButton).toHaveAttribute("aria-label", "Pause");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(miniPlayer.locator(".mini-track")).toContainText("Other Song");
  await page.getByRole("button", { name: "Previous" }).click();
  await expect(miniPlayer.locator(".mini-track")).toContainText("Tum Hi Ho");
  await expect(page).toHaveURL("http://localhost:5173/search");
});

test("YouTube result reports unavailable when title or artist does not exactly match", async ({ page }) => {
  await page.route("**/api/search?**", route => {
    const url = new URL(route.request().url());
    const results = url.searchParams.has("providers")
      ? [{
        id: "audius:wrong-artist",
        providerId: "audius",
        providerName: "Audius",
        title: "Believer",
        artist: "Different Artist",
        audioUrl: "https://api.audius.co/v1/tracks/wrong/stream?app_name=echo-music-web",
        playback: { status: "available", providerId: "audius" },
        kind: "song",
      }]
      : [{
        id: "youtube-music:believer-video",
        videoId: "believer-video",
        providerId: "youtube-music",
        providerName: "YouTube Music",
        title: "Believer",
        artist: "Imagine Dragons",
        playback: { status: "unavailable", reason: "YouTube metadata is not an audio stream." },
        kind: "song",
      }];
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ providers: [], errors: [], category: "all", results, total: results.length, nextOffset: null }),
    });
  });
  await page.goto("http://localhost:5173/search");
  await page.getByRole("textbox", { name: "Search music" }).fill("Believer");
  await page.getByRole("button", { name: "Find authorized audio for Believer" }).click();
  await expect(page.getByRole("alert")).toContainText("Audio playback unavailable");
  await expect(page.getByTestId("mini-player")).toHaveCount(0);
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page).toHaveURL("http://localhost:5173/search");
});

test("local audio is played in the app and restored from local storage", async ({ page }) => {
  test.setTimeout(30000);
  const sampleRate = 8000;
  const seconds = 4;
  const dataLength = sampleRate * seconds * 2;
  const wav = Buffer.alloc(44 + dataLength);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + dataLength, 4);
  wav.write("WAVE", 8);
  wav.write("fmt ", 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(dataLength, 40);

  await page.goto("http://localhost:5173/search");
  await page.locator('input[type="file"]').setInputFiles({
    name: "Local track.wav",
    mimeType: "audio/wav",
    buffer: wav,
  });
  await expect(page.getByTestId("mini-player")).toBeVisible();
  await expect(page.locator(".mini-track")).toContainText("Local track");
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible({ timeout: 10000 });
  await page.reload();
  await expect(page.getByTestId("mini-player")).toBeVisible({ timeout: 10000 });
  await expect(page.locator(".mini-track")).toContainText("Local track");
  await expect(page).toHaveURL("http://localhost:5173/search");
});

test("full licensed recording starts and advances on mobile", async ({ page }) => {
  test.setTimeout(45000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:5173/search");
  await page.getByRole("textbox", { name: "Search music" }).fill("Limbo with Summer Crickets");
  await page.getByRole("button", { name: "Play Limbo (with Summer Crickets)" }).click({ timeout: 20000 });
  await expect(page.getByTestId("mini-player").getByRole("button", { name: "Pause" })).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => {
    const text = document.querySelector(".mini-player .time")?.textContent ?? "";
    const match = text.match(/^(\d+):(\d{2})\s+\//);
    return match !== null && Number(match[1]) * 60 + Number(match[2]) >= 2;
  }, undefined, { timeout: 15000 });
  await expect(page).toHaveURL("http://localhost:5173/search");
});
