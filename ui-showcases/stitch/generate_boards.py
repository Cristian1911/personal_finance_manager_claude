from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
SHOWCASE_ROOT = ROOT.parent
DESKTOP_DIR = SHOWCASE_ROOT / "screenshots" / "desktop"
MOBILE_DIR = SHOWCASE_ROOT / "screenshots" / "mobile"
INPUTS_DIR = ROOT / "inputs"
BOARD_PATH = ROOT / "current-state-board.png"

SCREENS = [
    ("01-dashboard", "Inicio", "/dashboard"),
    ("02-transactions", "Movimientos", "/transactions"),
    ("06-import", "Importar", "/import"),
    ("09-deudas", "Plan / Deudas", "/deudas"),
    ("12-presupuesto", "Plan / Presupuesto", "/categories"),
    ("13-gestionar", "Mas / Gestionar", "/gestionar"),
]

CARD_W = 1080
CARD_H = 640
CARD_GAP = 36
BOARD_COLS = 2
BOARD_ROWS = 3
BOARD_W = 120 + BOARD_COLS * CARD_W + (BOARD_COLS - 1) * CARD_GAP + 120
BOARD_H = 150 + BOARD_ROWS * CARD_H + (BOARD_ROWS - 1) * CARD_GAP + 120
BG = "#0b0f15"
PANEL = "#121a26"
PANEL_2 = "#172132"
BORDER = "#263243"
TEXT = "#edf2f8"
MUTED = "#95a3b8"
ACCENT = "#d3ae69"


FONTS_DIR = ROOT / "fonts"


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    name = "Inter-Bold.ttf" if bold else "Inter-Regular.ttf"
    bundled = FONTS_DIR / name
    if bundled.exists():
        return ImageFont.truetype(str(bundled), size=size)
    return ImageFont.load_default()


FONT_LABEL = load_font(18, bold=True)
FONT_TITLE = load_font(34, bold=True)
FONT_CARD_TITLE = load_font(26, bold=True)
FONT_CARD_META = load_font(17)
FONT_FOOTER = load_font(15)


def contain_top_crop(path: Path, target_w: int, target_h: int, crop_height: int) -> Image.Image:
    image = Image.open(path).convert("RGB")
    crop = image.crop((0, 0, image.width, min(image.height, crop_height)))
    scale = min(target_w / crop.width, target_h / crop.height)
    resized = crop.resize((int(crop.width * scale), int(crop.height * scale)), Image.Resampling.LANCZOS)
    frame = Image.new("RGB", (target_w, target_h), "#0c1017")
    x = (target_w - resized.width) // 2
    y = (target_h - resized.height) // 2
    frame.paste(resized, (x, y))
    return frame


def rounded_rectangle(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int, fill: str, outline: str) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=2)


def make_pair_card(screen_id: str, title: str, route: str) -> Image.Image:
    desktop = contain_top_crop(DESKTOP_DIR / f"{screen_id}.png", 620, 430, crop_height=1300)
    mobile = contain_top_crop(MOBILE_DIR / f"{screen_id}.png", 260, 430, crop_height=1100)

    card = Image.new("RGB", (CARD_W, CARD_H), BG)
    draw = ImageDraw.Draw(card)
    rounded_rectangle(draw, (0, 0, CARD_W - 1, CARD_H - 1), 28, PANEL, BORDER)

    draw.text((34, 28), title, font=FONT_CARD_TITLE, fill=TEXT)
    draw.text((34, 66), route, font=FONT_CARD_META, fill=MUTED)

    card.paste(desktop, (34, 110))
    card.paste(mobile, (760, 110))

    draw.rounded_rectangle((34, 110, 34 + 620, 110 + 430), radius=18, outline=BORDER, width=2)
    draw.rounded_rectangle((760, 110, 760 + 260, 110 + 430), radius=18, outline=BORDER, width=2)

    footer = "Top-of-flow crop for redesign review. Use raw screenshots if deeper page detail is needed."
    draw.text((34, 568), footer, font=FONT_FOOTER, fill=MUTED)

    return card


def build_outputs() -> None:
    INPUTS_DIR.mkdir(parents=True, exist_ok=True)

    cards: list[Image.Image] = []
    for screen_id, title, route in SCREENS:
        card = make_pair_card(screen_id, title, route)
        card.save(INPUTS_DIR / f"{screen_id}-pair.png", quality=95)
        cards.append(card)

    board = Image.new("RGB", (BOARD_W, BOARD_H), BG)
    draw = ImageDraw.Draw(board)

    draw.text((60, 44), "Zeta", font=FONT_LABEL, fill=ACCENT)
    draw.text((60, 74), "Current-state board for Stitch", font=FONT_TITLE, fill=TEXT)
    subtitle = "Curated from the strongest screens only. Focus: status, movements, import, plan, and more."
    draw.text((60, 118), subtitle, font=FONT_CARD_META, fill=MUTED)

    for index, card in enumerate(cards):
        row = index // BOARD_COLS
        col = index % BOARD_COLS
        x = 60 + col * (CARD_W + CARD_GAP)
        y = 170 + row * (CARD_H + CARD_GAP)
        board.paste(card, (x, y))

    board.save(BOARD_PATH, quality=95)


if __name__ == "__main__":
    build_outputs()
