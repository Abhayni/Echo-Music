import { test, expect } from "@playwright/test";

test("creates a persistent playlist with a real licensed recording", async ({ page }) => {
  await page.goto("http://localhost:5173/search");
  await page.getByRole("textbox", { name: "Search music" }).fill("Limbo with Summer Crickets");
  await expect(page.getByTestId("track-row").first()).toBeVisible({ timeout: 20000 });
  await page.getByRole("button", { name: "Add to playlist" }).first().click();
  page.once("dialog", dialog => dialog.accept("Echo Test Playlist"));
  await page.getByRole("button", { name: "Create playlist" }).click();
  await page.getByRole("link", { name: /Library/ }).click();
  await expect(page.getByRole("button", { name: /Echo Test Playlist/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Echo Test Playlist" })).toBeVisible();
  await expect(page.getByText("Limbo (with Summer Crickets)", { exact: true }).last()).toBeVisible();
});

test("sorts, opens, and creates persistent playlists from the Library", async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem("echo-playlists")) return;
    const alpha = {
      id: "test-alpha", providerId: "youtube-music", providerName: "Test fixture",
      title: "Alpha tune", artist: "Alpha artist", album: "Shared album", kind: "song",
      playback: { status: "unavailable", reason: "Test fixture has no playback source." },
    };
    const zulu = {
      id: "test-zulu", providerId: "youtube-music", providerName: "Test fixture",
      title: "Zulu tune", artist: "Zulu artist", album: "Shared album", kind: "song",
      playback: { status: "unavailable", reason: "Test fixture has no playback source." },
    };
    const local = {
      id: "test-local", providerId: "local-file", providerName: "Echo Music",
      title: "Local tune", artist: "Local artist", kind: "song",
      playback: { status: "available", providerId: "local-file" },
    };
    localStorage.setItem("echo-playlists", JSON.stringify([
      { id: "playlist-zulu", name: "Zulu", trackIds: ["test-zulu"], createdAt: 100 },
      { id: "playlist-alpha", name: "Alpha", trackIds: ["test-alpha"], createdAt: 200 },
    ]));
    localStorage.setItem("echo-tracks", JSON.stringify({
      [alpha.id]: alpha, [zulu.id]: zulu, [local.id]: local,
    }));
    localStorage.setItem("echo-history", JSON.stringify([zulu, alpha]));
    localStorage.setItem("echo-liked", JSON.stringify(["test-alpha"]));
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:5173/library");
  const playlistCards = page.locator(".library-playlist-card:not(.playlist-create-tile) .playlist-card-name");
  const names = () => playlistCards.allTextContents();
  await expect.poll(names).toEqual(["Alpha", "Zulu"]);

  await page.getByLabel("Sort playlists").selectOption("alphabetical");
  await expect.poll(names).toEqual(["Zulu", "Alpha"]);
  await page.getByRole("button", { name: "Sort ascending" }).click();
  await expect.poll(names).toEqual(["Alpha", "Zulu"]);

  await page.getByLabel("Sort playlists").selectOption("recently-played");
  await expect.poll(names).toEqual(["Zulu", "Alpha"]);
  await page.getByLabel("Sort playlists").selectOption("date-added");
  await expect.poll(names).toEqual(["Zulu", "Alpha"]);

  await page.locator('.library-playlist-card[aria-label^="Open playlist Alpha"]').click();
  await expect(page.getByRole("heading", { name: "Alpha", exact: true })).toBeVisible();
  await expect(page.locator(".playlist-track").getByText("Alpha tune")).toBeVisible();

  page.once("dialog", dialog => dialog.accept("Fresh Collection"));
  await page.locator(".playlist-create-tile").click();
  await expect(page.getByRole("heading", { name: "Fresh Collection" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("echo-playlists") ?? "[]")
    .some((playlist: { name: string }) => playlist.name === "Fresh Collection"))).toBe(true);

  await page.reload();
  await expect(page.getByRole("button", { name: /Open playlist Fresh Collection/ })).toBeVisible();
});

test("shows accurate unsupported states and routes Library shortcuts to real collections", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:5173/library");
  await page.getByRole("button", { name: "Spotify", exact: false }).click();
  await expect(page.getByRole("heading", { name: "Spotify library unavailable" })).toBeVisible();
  await page.getByRole("button", { name: "Return to In App Library" }).click();

  for (const [label, heading] of [
    ["Downloaded", "Downloaded"],
    ["Exported", "Exported"],
    ["Cached", "Cached tracks"],
    ["My Top 50", "My Top 50"],
    ["My Bottom 50", "My Bottom 50"],
  ]) {
    await page.getByRole("button", { name: label, exact: false }).click();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Not available in this app" })).toBeVisible();
    await page.getByRole("tab", { name: "Playlists" }).click();
  }

  await page.getByRole("button", { name: "Liked", exact: false }).click();
  await expect(page.getByRole("heading", { name: "No liked songs yet" })).toBeVisible();
  await page.getByRole("tab", { name: "Playlists" }).click();
  await page.getByRole("button", { name: "Local", exact: false }).click();
  await expect(page.getByRole("heading", { name: "No local music yet" })).toBeVisible();
  await page.getByRole("tab", { name: "Playlists" }).click();
  await page.getByRole("button", { name: "Taste Mix", exact: false }).click();
  await expect(page.getByRole("heading", { name: "Your listening mix is ready to grow" })).toBeVisible();
});

test("keeps the mobile Library mini-player clear of bottom navigation and Search", async ({ page }) => {
  await page.addInitScript(() => {
    const currentTrack = {
      id: "test-unavailable", providerId: "youtube-music", providerName: "Test fixture",
      title: "Test track", artist: "Test artist", kind: "song",
      playback: { status: "unavailable", reason: "Test fixture has no playback source." },
    };
    const nextTrack = { ...currentTrack, id: "test-next", title: "Next fixture track" };
    localStorage.setItem("echo-current-track", JSON.stringify(currentTrack));
    localStorage.setItem("echo-queue", JSON.stringify([currentTrack, nextTrack]));
    localStorage.setItem("echo-current-index", "0");
  });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("http://localhost:5173/library");
  const player = page.getByTestId("mini-player");
  const navigation = page.getByRole("navigation", { name: "Mobile navigation" });
  const search = page.getByRole("button", { name: "Search", exact: true });
  for (const viewport of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(player).toBeVisible();
    await expect(player.getByRole("button", { name: "Next" })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Library" })).toHaveAttribute("aria-current", "page");
    const playerBox = await player.boundingBox();
    const navigationBox = await navigation.boundingBox();
    const searchBox = await search.boundingBox();
    expect(playerBox).not.toBeNull();
    expect(navigationBox).not.toBeNull();
    expect(searchBox).not.toBeNull();
    expect(playerBox!.y + playerBox!.height).toBeLessThan(navigationBox!.y);
    expect(playerBox!.y + playerBox!.height).toBeLessThan(searchBox!.y);
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(horizontalOverflow).toBe(false);
  }
  await player.getByRole("button", { name: "Next" }).click();
  await expect(player.getByText("Next fixture track", { exact: true })).toBeVisible();
});
