import { test, expect } from "@playwright/test";

const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

for (const viewport of viewports) {
  test(`library, navigation and search at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("http://localhost:5173/");
    await expect(page.getByRole("heading", { name: "Good evening" })).toBeVisible();
    await page.goto("http://localhost:5173/library");
    await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Playlists" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("button", { name: "Liked", exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Playlist" })).toBeVisible();
    const libraryOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(libraryOverflow).toBe(false);
    await page.getByRole("tab", { name: "Songs" }).click();
    await expect(page.getByRole("heading", { name: "Songs", exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Albums" }).click();
    await expect(page.getByRole("heading", { name: "Albums", exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Artists" }).click();
    await expect(page.getByRole("heading", { name: "Artists", exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Playlists" }).click();
    await page.getByRole("button", { name: "Spotify", exact: false }).click();
    await expect(page.getByRole("heading", { name: "Spotify library unavailable" })).toBeVisible();
    await page.getByRole("button", { name: "Return to In App Library" }).click();
    await page.getByRole("button", { name: "Liked", exact: false }).click();
    await expect(page.getByRole("heading", { name: "Liked songs", exact: true })).toBeVisible();
    if (viewport.width <= 760) {
      await expect(page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Library" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Search", exact: true })).toBeVisible();
    } else {
      await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Library" })).toBeVisible();
    }
    await page.goto("http://localhost:5173/search");
    await page.getByRole("textbox", { name: "Search music" }).fill("Limbo with Summer Crickets");
    await expect(page.getByText("Searching...")).toBeVisible();
    await expect(page.getByTestId("track-row").first()).toBeVisible({ timeout: 15000 });
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(horizontalOverflow).toBe(false);
  });
}
