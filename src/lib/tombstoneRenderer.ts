import { TOMBSTONE_STYLES } from "../types";

// Color Utilities

export const adjustColor = (hex: string, percent: number): string => {
  let num = parseInt(hex.replace("#", ""), 16),
    amt = Math.round(2.55 * percent),
    R = (num >> 16) + amt,
    G = ((num >> 8) & 0x00ff) + amt,
    B = (num & 0x0000ff) + amt;
  R = R < 0 ? 0 : R > 255 ? 255 : R;
  G = G < 0 ? 0 : G > 255 ? 255 : G;
  B = B < 0 ? 0 : B > 255 ? 255 : B;
  return "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
};

// Tombstone Pixel-Art Renderer
// Shared by GraveCanvas, StakeContractModal, and KeeperPlotsModal.
// `zoom` is optional — omit it (or pass 1) when rendering static previews.

export function drawTombstone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  style: number,
  zoom: number = 1,
  baseColor: string = "#4b4b4b",
  flowers: number = 0
) {
  const styleInfo = TOMBSTONE_STYLES[style] || TOMBSTONE_STYLES[0];

  const cols = styleInfo.width * 24;
  const rows = styleInfo.height * 24;

  const maxPxX = Math.floor(w / cols);
  const maxPxY = Math.floor(h / rows);
  const px = Math.max(1, Math.min(maxPxX, maxPxY));

  const styleW = cols * px;
  const styleH = rows * px;

  const offsetX = Math.floor((w - styleW) / 2);
  const offsetY = Math.floor(h - styleH);

  const drawX = x + offsetX;
  const drawY = y + offsetY;

  const C = {
    border: "#0e0e0e",
    dark: adjustColor(baseColor, -35),
    mid: baseColor,
    light: adjustColor(baseColor, 20),
    high: adjustColor(baseColor, 45),
    white: adjustColor(baseColor, 65),
    crack: adjustColor(baseColor, -60),
    moss: "#152a15",
  };

  // Pixel-snapping block helper
  const block = (rx: number, ry: number, bw: number, bh: number, c: string) => {
    const x1 = drawX + rx * px;
    const x2 = drawX + (rx + bw) * px;
    const y1 = drawY + ry * px;
    const y2 = drawY + (ry + bh) * px;
    ctx.fillStyle = c;
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
  };

  const dither = (rx: number, ry: number, bw: number, bh: number, c1: string, c2: string) => {
    for (let dy = 0; dy < bh; dy++) {
      for (let dx = 0; dx < bw; dx++) {
        const x1 = drawX + (rx + dx) * px;
        const x2 = drawX + (rx + dx + 1) * px;
        const y1 = drawY + (ry + dy) * px;
        const y2 = drawY + (ry + dy + 1) * px;
        ctx.fillStyle = (rx + dx + ry + dy) % 2 === 0 ? c1 : c2;
        ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      }
    }
  };

  switch (style) {
    case 0: {
      // Classic Slate Arched (24×24 grid)
      block(2, 21, 20, 2, C.border);
      block(3, 20, 18, 1, C.border);
      block(3, 21, 18, 1, C.dark);
      block(4, 20, 16, 1, C.light);

      const getTabletRange = (r: number) => {
        if (r < 3) return null;
        if (r === 3) return { s: 9, e: 14 };
        if (r === 4) return { s: 7, e: 16 };
        if (r === 5) return { s: 5, e: 18 };
        if (r === 6) return { s: 4, e: 19 };
        return { s: 3, e: 20 };
      };

      for (let r = 3; r <= 19; r++) {
        const range = getTabletRange(r);
        if (!range) continue;
        block(range.s, r, range.e - range.s + 1, 1, C.border);
        block(range.s + 1, r, range.e - range.s - 1, 1, C.mid);
        block(range.s + 1, r, 1, 1, C.white);
        block(range.s + 2, r, 1, 1, C.light);
        block(range.e - 2, r, 1, 1, C.dark);
        block(range.e - 1, r, 1, 1, C.dark);
      }

      block(11, 7, 2, 7, C.dark);
      block(9, 9, 6, 2, C.dark);
      block(11, 14, 2, 1, C.light);

      block(2, 21, 3, 1, C.moss);
      block(3, 20, 2, 1, C.moss);
      block(19, 21, 3, 1, C.moss);
      block(19, 20, 2, 1, C.moss);
      block(4, 18, 2, 2, C.moss);
      block(18, 18, 2, 2, C.moss);
      break;
    }
    case 1: {
      // Wooden Cross (24×24 grid)
      block(2, 21, 20, 3, C.border);
      block(4, 20, 16, 1, C.border);
      block(7, 19, 10, 1, C.border);

      const C_dirt = adjustColor("#3e2723", -20);
      block(3, 22, 18, 2, C_dirt);
      block(5, 21, 14, 1, C_dirt);
      block(8, 20, 8, 1, C_dirt);

      block(4, 19, 1, 2, C.moss);
      block(19, 19, 1, 2, C.moss);
      block(6, 18, 1, 2, C.moss);
      block(17, 18, 1, 2, C.moss);

      // Vertical beam
      block(9, 2, 6, 18, C.border);
      block(10, 3, 4, 17, C.mid);
      block(10, 3, 1, 17, C.light);
      block(11, 3, 1, 17, C.high);
      block(13, 3, 1, 17, C.dark);

      // Left horizontal segment
      block(3, 6, 6, 6, C.border);
      block(4, 7, 5, 4, C.mid);
      block(4, 7, 5, 1, C.light);
      block(4, 8, 5, 1, C.high);
      block(4, 10, 5, 1, C.dark);

      // Right horizontal segment
      block(15, 6, 6, 6, C.border);
      block(15, 7, 5, 4, C.mid);
      block(15, 7, 5, 1, C.light);
      block(15, 8, 5, 1, C.high);
      block(15, 10, 5, 1, C.dark);

      // Iron nails
      block(5, 8, 1, 2, C.border);
      block(5, 8, 1, 1, C.white);
      block(18, 8, 1, 2, C.border);
      block(18, 8, 1, 1, C.white);
      block(11, 3, 2, 1, C.white);
      break;
    }
    case 2: {
      // Gothic Marble Cross (24×24 grid)
      block(1, 21, 22, 3, C.border);
      block(2, 21, 20, 2, C.dark);
      block(3, 21, 18, 1, C.light);
      block(3, 18, 18, 3, C.border);
      block(4, 18, 16, 2, C.mid);
      block(5, 18, 14, 1, C.high);

      const getGothicRange = (r: number) => {
        if (r < 3) return null;
        if (r === 3) return { s: 11, e: 12 };
        if (r === 4) return { s: 10, e: 13 };
        if (r === 5) return { s: 9, e: 14 };
        if (r === 6) return { s: 8, e: 15 };
        if (r === 7) return { s: 7, e: 16 };
        if (r === 8) return { s: 6, e: 17 };
        return { s: 5, e: 18 };
      };

      for (let r = 3; r <= 17; r++) {
        const range = getGothicRange(r);
        if (!range) continue;
        block(range.s, r, range.e - range.s + 1, 1, C.border);
        if (r > 3) {
          block(range.s + 1, r, range.e - range.s - 1, 1, C.mid);
          if (r >= 6) {
            block(range.s + 1, r, 1, 1, C.white);
            block(range.s + 2, r, 1, 1, C.light);
            block(range.e - 1, r, 1, 1, C.dark);
          }
        }
      }

      block(10, 8, 2, 7, C.dark);
      block(8, 10, 6, 2, C.dark);
      break;
    }
    case 3: {
      // Celtic Loop (48×24 grid, 2×1 cell) - Ring/rope removed as per user request
      block(8, 21, 32, 3, C.border);
      block(9, 21, 30, 2, C.dark);
      block(10, 21, 28, 1, C.light);
      block(12, 18, 24, 3, C.border);
      block(13, 19, 22, 2, C.mid);
      block(14, 18, 20, 1, C.light);

      // Shafts
      block(21, 0, 6, 18, C.border);
      block(22, 1, 4, 17, C.mid);
      block(22, 1, 1, 17, C.white);
      block(23, 1, 1, 17, C.light);
      block(25, 1, 1, 17, C.dark);

      block(13, 8, 22, 6, C.border);
      block(14, 9, 20, 4, C.mid);
      block(14, 9, 20, 1, C.light);
      block(14, 10, 20, 1, C.high);
      block(14, 12, 20, 1, C.dark);

      // Intersection overlay
      block(22, 9, 4, 4, C.mid);
      block(22, 9, 1, 4, C.light);
      block(23, 9, 1, 4, C.high);
      block(25, 9, 1, 4, C.dark);

      // Carved loops
      block(23, 6, 2, 1, C.high);
      block(23, 14, 2, 1, C.high);
      block(17, 10, 2, 1, C.high);
      block(29, 10, 2, 1, C.high);

      block(6, 22, 3, 2, C.moss);
      block(7, 21, 2, 1, C.moss);
      block(39, 22, 3, 2, C.moss);
      block(39, 21, 2, 1, C.moss);
      break;
    }
    case 4: {
      // Hero Sarcophagus (48×48 grid, 2×2 cell)
      block(4, 8, 40, 36, C.border);
      block(5, 41, 38, 3, C.dark);
      block(41, 9, 3, 33, C.dark);
      block(7, 11, 34, 28, C.border);
      block(8, 12, 32, 26, C.mid);

      block(8, 12, 32, 1, C.white);
      block(8, 13, 32, 1, C.light);
      block(8, 12, 1, 26, C.white);
      block(9, 12, 1, 26, C.light);
      block(8, 36, 32, 2, C.dark);
      block(38, 12, 2, 25, C.dark);

      // Sword — blade (shifted up by 1 to sit flush against the top border)
      block(23, 19, 2, 15, C.high);
      block(23, 19, 1, 15, C.white);
      block(24, 19, 1, 15, C.dark);
      // Guard
      block(19, 17, 10, 2, C.border);
      block(20, 18, 8, 1, C.light);
      // Handle
      block(22, 13, 4, 4, C.border);
      block(23, 13, 2, 4, C.white);
      // Pommel
      block(22, 12, 4, 1, C.border);
      block(23, 12, 2, 1, C.high);

      [
        { x: 8, y: 12 },
        { x: 38, y: 12 },
        { x: 8, y: 36 },
        { x: 38, y: 36 },
      ].forEach((pt) => {
        block(pt.x, pt.y, 2, 2, C.high);
        block(pt.x + 1, pt.y + 1, 1, 1, C.white);
      });

      block(12, 15, 3, 1, C.crack);
      block(11, 16, 1, 2, C.crack);
      block(35, 30, 2, 1, C.crack);
      block(36, 31, 1, 3, C.crack);

      block(4, 8, 5, 2, C.moss);
      block(5, 10, 3, 1, C.moss);
      block(36, 39, 6, 2, C.moss);
      block(38, 38, 4, 1, C.moss);
      break;
    }
    case 5: {
      // Angel Sentinel (48×48 grid, 2×2 cell)
      const midA = 24;
      void midA; // used implicitly via symmetry

      // Pedestal
      block(4, 40, 40, 4, C.border);
      block(5, 41, 38, 3, C.dark);
      block(6, 40, 36, 1, C.light);

      block(8, 36, 32, 4, C.border);
      block(9, 37, 30, 3, C.mid);
      block(10, 36, 28, 1, C.high);

      // Top step widened to x=10..37 (width 28) so wings sit flush on it
      block(10, 32, 28, 4, C.border);
      block(11, 33, 26, 3, C.mid);
      block(12, 32, 24, 1, C.white);

      // Wings (left)
      block(10, 12, 10, 20, C.border);
      block(9, 10, 8, 2, C.border);
      block(8, 8, 4, 2, C.border);
      dither(11, 11, 8, 19, C.dark, C.mid);
      block(9, 9, 3, 1, C.light);
      block(10, 10, 4, 1, C.light);
      block(11, 12, 1, 16, C.light);
      block(14, 14, 1, 14, C.white);
      block(18, 16, 2, 12, C.high);

      // Wings (right)
      block(28, 12, 10, 20, C.border);
      block(31, 10, 8, 2, C.border);
      block(36, 8, 4, 2, C.border);
      dither(29, 11, 8, 19, C.dark, C.mid);
      block(36, 9, 3, 1, C.light);
      block(34, 10, 4, 1, C.light);
      block(36, 12, 1, 16, C.light);
      block(33, 14, 1, 14, C.white);
      block(28, 16, 2, 12, C.high);

      // Gown - started at y=13 to connect left/right wings to neck horizontally
      block(19, 13, 10, 19, C.border);
      block(20, 14, 8, 18, C.mid);
      block(20, 14, 1, 18, C.white);
      block(22, 15, 1, 17, C.light);
      block(24, 16, 1, 16, C.high);
      block(26, 14, 1, 18, C.dark);
      block(28, 14, 1, 18, C.border);

      // Arms
      block(21, 18, 6, 3, C.border);
      block(22, 19, 4, 1, C.light);
      block(23, 19, 2, 1, C.white);

      // Head
      block(20, 5, 8, 8, C.high);
      block(21, 6, 6, 6, C.white);
      block(21, 8, 6, 6, C.border);
      block(22, 9, 4, 4, C.light);
      block(23, 9, 2, 3, C.white);
      block(24, 12, 1, 1, C.dark);

      // Ivy
      block(4, 42, 3, 1, C.moss);
      block(9, 38, 2, 2, C.moss);
      block(10, 37, 1, 1, C.moss);
      block(35, 38, 3, 2, C.moss);
      block(36, 36, 2, 2, C.moss);
      break;
    }
  }
}
