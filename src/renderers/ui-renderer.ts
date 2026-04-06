/**
 * Renderer abstraction used by FluxUI to emit primitive draw operations.
 */
export interface UIRenderer {
  /**
   * Draws a filled rectangle.
   */
  drawRect(x: number, y: number, width: number, height: number, color: string): void;
  /**
   * Draws text using the provided font and color.
   */
  drawText(x: number, y: number, text: string, font: string, color: string): void;
  /**
   * Draws a line segment.
   */
  drawLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    thickness: number,
    color: string
  ): void;
  /**
   * Optionally measures text width. FluxUI falls back to an approximation when absent.
   */
  measureText?(text: string, font: string): number;
}
