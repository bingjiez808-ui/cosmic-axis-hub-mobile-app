"""Visual-regression smoke script.

Captures a small set of screenshots at desktop and mobile widths so we can
eyeball diffs after layout changes. Not wired into CI — run locally against
the Lovable dev server (http://localhost:8080).
"""

import asyncio
from pathlib import Path

from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
OUT = Path(__file__).parent / "screenshots"
OUT.mkdir(parents=True, exist_ok=True)

SHOTS = [
    # (name, path, viewport)
    ("ritual-language-mobile", "/ritual", {"width": 390, "height": 844}),
    ("ritual-language-desktop", "/ritual", {"width": 1280, "height": 900}),
    (
        "report-desktop",
        "/report?name=Ada&date=1990-06-15&time=08:30&place=Shanghai&lang=zh",
        {"width": 1440, "height": 1000},
    ),
    (
        "report-mobile",
        "/report?name=Ada&date=1990-06-15&time=08:30&place=Shanghai&lang=zh",
        {"width": 390, "height": 900},
    ),
]


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        for name, path, viewport in SHOTS:
            ctx = await browser.new_context(viewport=viewport)
            page = await ctx.new_page()
            await page.goto(f"{BASE}{path}", wait_until="domcontentloaded")
            # Wait for fonts + first paint.
            await page.wait_for_timeout(900)
            await page.screenshot(path=str(OUT / f"{name}.png"))
            print(f"captured {name} → {viewport}")
            await ctx.close()
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
