"""Capture every top-level screen of the app, scrolled in full, from Expo web.

    python3 scripts/ux-loop/capture.py --base http://localhost:8099 --out <dir>

Screens: Pulse (/), Board (/board) when the build has it, and each group from
the drawer. Each screen is rendered at full content height and sliced into
phone-height PNGs (`<nn>-<screen>-<part>.png`). The rendered text goes to
`<screen>.txt` for the grader; testers only get the PNGs.

The browser calls Yahoo and fibenchi directly, so web security is off.
"""

import argparse
import asyncio
import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image
from playwright.async_api import Page, async_playwright

from env import fibenchi_endpoint

WIDTH = 412
PHONE_HEIGHT = 915
SCALE = 2
SLICE = 1000  # CSS px per slice, about one phone screen

# The tallest scrollable element on the page, which on RN web is the screen's
# ScrollView/FlatList rather than the document.
SCROLLER_HEIGHT_JS = """() => {
  let best = document.scrollingElement.scrollHeight;
  for (const el of document.querySelectorAll('*')) {
    const s = getComputedStyle(el);
    if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 4) {
      const offset = el.getBoundingClientRect().top;
      best = Math.max(best, offset + el.scrollHeight);
    }
  }
  return Math.ceil(best);
}"""


def group_names() -> list[str]:
    """Group names in drawer order, from the same config bundle the app reads."""
    with urllib.request.urlopen(f"{fibenchi_endpoint()}/api/companion/config", timeout=20) as r:
        config = json.load(r)
    return [g["name"] for g in sorted(config["groups"], key=lambda g: g.get("position", 0))]


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


async def settle(page: Page, wait_ms: int) -> None:
    """Wait for quotes and daily bars; the app shows 'Loading' or skeletons until then."""
    await page.wait_for_timeout(wait_ms)


async def shoot(page: Page, out: Path, index: int, name: str) -> list[str]:
    height = await page.evaluate(SCROLLER_HEIGHT_JS)
    height = min(max(height, PHONE_HEIGHT), 12000)
    await page.set_viewport_size({"width": WIDTH, "height": height})
    await page.wait_for_timeout(2500)
    height = min(max(await page.evaluate(SCROLLER_HEIGHT_JS), PHONE_HEIGHT), 12000)
    await page.set_viewport_size({"width": WIDTH, "height": height})
    await page.wait_for_timeout(1500)

    full = out / f".{index:02d}-{slug(name)}-full.png"
    await page.screenshot(path=str(full))
    (out / f"{index:02d}-{slug(name)}.txt").write_text(await page.inner_text("body"))

    img = Image.open(full)
    step = SLICE * SCALE
    parts = []
    tops = list(range(0, img.height, step))
    if len(tops) > 1 and img.height - tops[-1] < 300 * SCALE:
        tops.pop()  # fold a short tail into the previous slice instead of a sliver image
    for n, top in enumerate(tops, start=1):
        bottom = tops[n] if n < len(tops) else img.height
        path = out / f"{index:02d}-{slug(name)}-{n}.png"
        img.crop((0, top, img.width, bottom)).save(path)
        parts.append(path.name)
    full.unlink()
    print(f"{name}: {len(parts)} image(s)", flush=True)
    await page.set_viewport_size({"width": WIDTH, "height": PHONE_HEIGHT})
    return parts


async def open_drawer(page: Page) -> None:
    button = page.get_by_role("button", name=re.compile("menu|navigation", re.I))
    if await button.count():
        await button.first.click()
    else:
        await page.mouse.move(2, 400)
        await page.mouse.down()
        await page.mouse.move(300, 400, steps=10)
        await page.mouse.up()
    await page.wait_for_timeout(1200)


async def run(base: str, out: Path, wait_ms: int, groups: list[str] | None) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    manifest: dict = {"captured_at": now(), "base": base, "screens": []}
    logs: list[str] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--disable-web-security", "--disable-site-isolation-trials"])
        ctx = await browser.new_context(
            viewport={"width": WIDTH, "height": PHONE_HEIGHT},
            device_scale_factor=SCALE,
            color_scheme="dark",
            is_mobile=True,
            has_touch=True,
        )
        page = await ctx.new_page()
        page.on("pageerror", lambda e: logs.append(f"PAGEERROR: {e}"[:400]))

        await page.goto(base + "/")
        await settle(page, wait_ms)
        index = 1
        manifest["screens"].append({"name": "Pulse", "at": now(), "files": await shoot(page, out, index, "Pulse")})

        await page.goto(base + "/board")
        await page.wait_for_timeout(4000)
        if "/board" in page.url and "Unmatched" not in await page.inner_text("body"):
            await settle(page, wait_ms // 2)
            index += 1
            manifest["screens"].append({"name": "Board", "at": now(), "files": await shoot(page, out, index, "Board")})

        names = groups if groups is not None else group_names()

        for name in names:
            await open_drawer(page)
            target = page.get_by_text(name, exact=True)
            if not await target.count():
                logs.append(f"group not in drawer: {name}")
                await page.keyboard.press("Escape")
                continue
            await target.last.click()
            await page.wait_for_timeout(1500)
            await settle(page, min(wait_ms, 20000))
            index += 1
            manifest["screens"].append({"name": f"Group: {name}", "at": now(), "files": await shoot(page, out, index, name)})

        await browser.close()

    manifest["page_errors"] = logs
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2))
    return manifest


def main() -> None:
    ap = argparse.ArgumentParser(description="Capture every app screen from Expo web")
    ap.add_argument("--base", required=True, help="Expo web origin, e.g. http://localhost:8099")
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--wait-ms", type=int, default=40000, help="time for quotes and daily bars to land")
    ap.add_argument("--groups", nargs="*", help="group names to capture (default: all, in drawer order)")
    args = ap.parse_args()
    m = asyncio.run(run(args.base.rstrip("/"), args.out, args.wait_ms, args.groups))
    print(f"{sum(len(s['files']) for s in m['screens'])} images from {len(m['screens'])} screens -> {args.out}")
    for line in m["page_errors"]:
        print(line)


if __name__ == "__main__":
    main()
