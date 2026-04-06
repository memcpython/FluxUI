interface RGBA {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

function clampChannel(value: number): number {
  if (value <= 0) {
    return 0;
  }

  if (value >= 255) {
    return 255;
  }

  return value;
}

function clampAlpha(value: number): number {
  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
}

function parseHexColor(hex: string): RGBA | null {
  const value = hex.slice(1);

  if (value.length === 3) {
    return {
      r: parseInt(value[0] + value[0], 16),
      g: parseInt(value[1] + value[1], 16),
      b: parseInt(value[2] + value[2], 16),
      a: 1
    };
  }

  if (value.length === 4) {
    return {
      r: parseInt(value[0] + value[0], 16),
      g: parseInt(value[1] + value[1], 16),
      b: parseInt(value[2] + value[2], 16),
      a: parseInt(value[3] + value[3], 16) / 255
    };
  }

  if (value.length === 6) {
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16),
      a: 1
    };
  }

  if (value.length === 8) {
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16),
      a: parseInt(value.slice(6, 8), 16) / 255
    };
  }

  return null;
}

function parseRgbColor(color: string): RGBA | null {
  const match = color.match(/rgba?\(([^)]+)\)/i);
  if (!match) {
    return null;
  }

  const parts = match[1]?.split(",").map((part) => part.trim()) ?? [];
  if (parts.length < 3) {
    return null;
  }

  const r = Number(parts[0]);
  const g = Number(parts[1]);
  const b = Number(parts[2]);
  const a = parts.length >= 4 ? Number(parts[3]) : 1;

  if ([r, g, b, a].some((value) => Number.isNaN(value))) {
    return null;
  }

  return { r, g, b, a };
}

function parseColor(color: string): RGBA | null {
  if (color.startsWith("#")) {
    return parseHexColor(color);
  }

  if (color.startsWith("rgb")) {
    return parseRgbColor(color);
  }

  return null;
}

function toCssColor(color: RGBA): string {
  const r = Math.round(clampChannel(color.r));
  const g = Math.round(clampChannel(color.g));
  const b = Math.round(clampChannel(color.b));
  const a = clampAlpha(color.a);
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
}

export function mixColors(from: string, to: string, amount: number): string {
  const start = parseColor(from);
  const end = parseColor(to);

  if (!start || !end) {
    return amount < 0.5 ? from : to;
  }

  return toCssColor({
    r: start.r + (end.r - start.r) * amount,
    g: start.g + (end.g - start.g) * amount,
    b: start.b + (end.b - start.b) * amount,
    a: start.a + (end.a - start.a) * amount
  });
}

export function withAlpha(color: string, alpha: number): string {
  const parsed = parseColor(color);
  if (!parsed) {
    return color;
  }

  return toCssColor({
    r: parsed.r,
    g: parsed.g,
    b: parsed.b,
    a: clampAlpha(alpha)
  });
}
