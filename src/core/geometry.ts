/**
 * A screen-space rectangle.
 */
export interface UIRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Returns true when the point lies within the rectangle bounds.
 */
export function containsPoint(rect: UIRect, x: number, y: number): boolean {
  return (
    x >= rect.x &&
    y >= rect.y &&
    x <= rect.x + rect.width &&
    y <= rect.y + rect.height
  );
}

/**
 * Restricts a value to the provided inclusive range.
 */
export function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}
