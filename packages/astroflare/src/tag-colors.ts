export interface TagPalette {
  /** Soft background fill for the tag surface. */
  bg: string;
  /** Border color paired with `bg` for tag outlines. */
  border: string;
  /** Foreground text color with readable contrast on `bg`. */
  text: string;
}

export interface TagColorOptions {
  /** Optional explicit tag-key to hex color map (expects lowercase keys). */
  overrides?: Record<string, string>;
}

const DEFAULT_OVERRIDES: Record<string, string> = {
  shoots: "#dc3545",
  tech: "#8a95a5",
  ai: "#6b7b8d",
  sites: "#7dd3c0",
  flow: "#b367e0",
};

const hashStringToHue = (input: string): number => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
};

const hexToRgb = (hex: string): [number, number, number] | null => {
  const value = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
};

const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;
  const saturation =
    delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  let hue = 0;
  if (delta !== 0) {
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
  }

  return [
    Math.round((hue * 60 + 360) % 360),
    Math.round(saturation * 100),
    Math.round(lightness * 100),
  ];
};

const resolveHue = (tag: string, options: TagColorOptions): number => {
  const key = tag.trim().toLowerCase();
  const color = options.overrides?.[key] ?? DEFAULT_OVERRIDES[key];
  if (!color) return hashStringToHue(key);
  const rgb = hexToRgb(color);
  if (!rgb) return hashStringToHue(key);
  return rgbToHsl(...rgb)[0];
};

/**
 * Build a deterministic HSL-based palette for a tag label.
 * Uses known defaults and optional overrides before falling back to hashed hue.
 */
export const getTagPalette = (
  tag: string,
  options: TagColorOptions = {},
): TagPalette => {
  const hue = resolveHue(tag, options);
  return {
    bg: `hsla(${hue} 48% 58% / 0.12)`,
    border: `hsla(${hue} 52% 58% / 0.34)`,
    text: `hsl(${hue} 50% 66%)`,
  };
};
