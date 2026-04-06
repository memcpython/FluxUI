import { describe, expect, it } from "vitest";

import { FluxUI } from "../src/flux-ui.js";
import type { UIRenderer } from "../src/renderers/ui-renderer.js";

class AnimationRenderer implements UIRenderer {
  public readonly rects: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
  }> = [];
  public readonly lines: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    color: string;
  }> = [];

  public drawRect(x: number, y: number, width: number, height: number, color: string): void {
    this.rects.push({ x, y, width, height, color });
  }

  public drawText(): void {}

  public drawLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    _thickness: number,
    color: string
  ): void {
    this.lines.push({ x1, y1, x2, y2, color });
  }

  public measureText(text: string): number {
    return text.length * 8;
  }

  public reset(): void {
    this.rects.length = 0;
    this.lines.length = 0;
  }
}

describe("FluxUI animation layer", () => {
  it("eases button hover color across multiple frames", () => {
    const ui = new FluxUI({ origin: { x: 0, y: 0 } });
    const renderer = new AnimationRenderer();

    ui.beginFrame({ mouseX: -20, mouseY: -20, mouseDown: false, deltaTime: 1 / 60 });
    ui.button("Hover me");
    ui.endFrame(renderer);
    const baseColor = renderer.rects[0]?.color;

    renderer.reset();
    ui.beginFrame({ mouseX: 10, mouseY: 10, mouseDown: false, deltaTime: 1 / 60 });
    ui.button("Hover me");
    ui.endFrame(renderer);
    const hoverColorA = renderer.rects[0]?.color;

    renderer.reset();
    ui.beginFrame({ mouseX: 10, mouseY: 10, mouseDown: false, deltaTime: 1 / 60 });
    ui.button("Hover me");
    ui.endFrame(renderer);
    const hoverColorB = renderer.rects[0]?.color;

    expect(baseColor).not.toBe(hoverColorB);
    expect(hoverColorA).not.toBe(hoverColorB);
  });

  it("animates slider fill toward the target value instead of snapping instantly", () => {
    const ui = new FluxUI({ origin: { x: 0, y: 0 } });
    const renderer = new AnimationRenderer();

    ui.beginFrame({ mouseX: -1, mouseY: -1, mouseDown: false, deltaTime: 1 / 60 });
    ui.sliderFloat("Speed", 0, 0, 10);
    ui.endFrame(renderer);

    renderer.reset();
    ui.beginFrame({ mouseX: -1, mouseY: -1, mouseDown: false, deltaTime: 1 / 120 });
    ui.sliderFloat("Speed", 10, 0, 10);
    ui.endFrame(renderer);
    const widthA = renderer.rects[1]?.width ?? 0;

    renderer.reset();
    ui.beginFrame({ mouseX: -1, mouseY: -1, mouseDown: false, deltaTime: 1 / 120 });
    ui.sliderFloat("Speed", 10, 0, 10);
    ui.endFrame(renderer);
    const widthB = renderer.rects[1]?.width ?? 0;

    expect(widthA).toBeGreaterThan(0);
    expect(widthA).toBeLessThan(220);
    expect(widthB).toBeGreaterThan(widthA);
  });

  it("draws a caret only while a text input is focused", () => {
    const ui = new FluxUI({ origin: { x: 0, y: 0 } });
    const renderer = new AnimationRenderer();

    ui.beginFrame({ mouseX: 10, mouseY: 10, mouseDown: true, deltaTime: 1 / 60 });
    ui.inputText("Name", "A");
    ui.endFrame(renderer);

    renderer.reset();
    ui.beginFrame({ mouseX: 10, mouseY: 10, mouseDown: false, deltaTime: 1 / 60 });
    ui.inputText("Name", "A");
    ui.endFrame(renderer);

    const focusedLineCount = renderer.lines.length;

    renderer.reset();
    ui.beginFrame({ mouseX: 400, mouseY: 400, mouseDown: true, deltaTime: 1 / 60 });
    ui.inputText("Name", "A");
    ui.endFrame(renderer);

    renderer.reset();
    ui.beginFrame({ mouseX: 400, mouseY: 400, mouseDown: false, deltaTime: 1 / 60 });
    ui.inputText("Name", "A");
    ui.endFrame(renderer);

    const unfocusedLineCount = renderer.lines.length;

    expect(focusedLineCount).toBeGreaterThan(4);
    expect(unfocusedLineCount).toBe(4);
  });
});
