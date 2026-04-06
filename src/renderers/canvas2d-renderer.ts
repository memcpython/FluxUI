import type { UIRenderer } from "./ui-renderer.js";

/**
 * Canvas2D implementation of the FluxUI renderer abstraction.
 */
export class Canvas2DRenderer implements UIRenderer {
  /**
   * Creates a renderer that writes into the provided Canvas 2D context.
   */
  public constructor(private readonly context: CanvasRenderingContext2D) {}

  /**
   * @inheritdoc
   */
  public drawRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: string
  ): void {
    this.context.fillStyle = color;
    this.context.fillRect(x, y, width, height);
  }

  /**
   * @inheritdoc
   */
  public drawText(
    x: number,
    y: number,
    text: string,
    font: string,
    color: string
  ): void {
    this.context.font = font;
    this.context.fillStyle = color;
    this.context.textBaseline = "top";
    this.context.fillText(text, x, y);
  }

  /**
   * @inheritdoc
   */
  public drawLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    thickness: number,
    color: string
  ): void {
    this.context.strokeStyle = color;
    this.context.lineWidth = thickness;
    this.context.beginPath();
    this.context.moveTo(x1, y1);
    this.context.lineTo(x2, y2);
    this.context.stroke();
  }

  /**
   * @inheritdoc
   */
  public pushClipRect(x: number, y: number, width: number, height: number): void {
    this.context.save();
    this.context.beginPath();
    this.context.rect(x, y, width, height);
    this.context.clip();
  }

  /**
   * @inheritdoc
   */
  public popClipRect(): void {
    this.context.restore();
  }

  /**
   * @inheritdoc
   */
  public measureText(text: string, font: string): number {
    this.context.font = font;
    return this.context.measureText(text).width;
  }
}
