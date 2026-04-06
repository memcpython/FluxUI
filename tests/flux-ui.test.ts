import { describe, expect, it } from "vitest";

import { FluxUI } from "../src/flux-ui.js";
import type { UIRenderer } from "../src/renderers/ui-renderer.js";

class MockRenderer implements UIRenderer {
  public readonly rects: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
  }> = [];
  public readonly texts: Array<{ x: number; y: number; text: string; font: string; color: string }> = [];
  public readonly lines: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    thickness: number;
    color: string;
  }> = [];

  public drawRect(x: number, y: number, width: number, height: number, color: string): void {
    this.rects.push({ x, y, width, height, color });
  }

  public drawText(x: number, y: number, text: string, font: string, color: string): void {
    this.texts.push({ x, y, text, font, color });
  }

  public drawLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    thickness: number,
    color: string
  ): void {
    this.lines.push({ x1, y1, x2, y2, thickness, color });
  }

  public measureText(text: string, _font: string): number {
    return text.length * 8;
  }

  public reset(): void {
    this.rects.length = 0;
    this.texts.length = 0;
    this.lines.length = 0;
  }
}

class BareRenderer implements UIRenderer {
  public readonly rects: Array<{ x: number; y: number; width: number; height: number; color: string }> = [];
  public readonly texts: string[] = [];
  public readonly lines = 0;

  public drawRect(x: number, y: number, width: number, height: number, color: string): void {
    this.rects.push({ x, y, width, height, color });
  }

  public drawText(_x: number, _y: number, text: string): void {
    this.texts.push(text);
  }

  public drawLine(): void {
    // Intentionally empty: this renderer proves the core does not depend on Canvas-only features.
  }
}

describe("FluxUI", () => {
  it("returns true when a button is clicked across press and release frames", () => {
    const ui = new FluxUI({ origin: { x: 0, y: 0 } });
    const renderer = new MockRenderer();

    ui.beginFrame({ mouseX: 10, mouseY: 10, mouseDown: true });
    expect(ui.button("Click")).toBe(false);
    ui.endFrame(renderer);

    renderer.reset();
    ui.beginFrame({ mouseX: 10, mouseY: 10, mouseDown: false });
    expect(ui.button("Click")).toBe(true);
    ui.endFrame(renderer);
  });

  it("toggles checkbox state when clicked", () => {
    const ui = new FluxUI({ origin: { x: 0, y: 0 } });
    const renderer = new MockRenderer();
    let value = false;

    ui.beginFrame({ mouseX: 8, mouseY: 8, mouseDown: true });
    value = ui.checkbox("Enabled", value);
    ui.endFrame(renderer);

    ui.beginFrame({ mouseX: 8, mouseY: 8, mouseDown: false });
    value = ui.checkbox("Enabled", value);
    ui.endFrame(renderer);

    expect(value).toBe(true);
  });

  it("updates slider value while dragging outside the widget bounds", () => {
    const ui = new FluxUI({ origin: { x: 0, y: 0 } });
    const renderer = new MockRenderer();
    let value = 0;

    ui.beginFrame({ mouseX: 0, mouseY: 10, mouseDown: true });
    value = ui.sliderFloat("Speed", value, 0, 10);
    ui.endFrame(renderer);

    ui.beginFrame({ mouseX: 400, mouseY: 200, mouseDown: true });
    value = ui.sliderFloat("Speed", value, 0, 10);
    ui.endFrame(renderer);

    expect(value).toBe(10);
  });

  it("edits text while an input is focused", () => {
    const ui = new FluxUI({ origin: { x: 0, y: 0 } });
    const renderer = new MockRenderer();
    let value = "A";

    ui.beginFrame({ mouseX: 10, mouseY: 10, mouseDown: true });
    value = ui.inputText("Name", value);
    ui.endFrame(renderer);

    ui.beginFrame({ mouseX: 10, mouseY: 10, mouseDown: false, typedText: "bc" });
    value = ui.inputText("Name", value);
    ui.endFrame(renderer);

    ui.beginFrame({
      mouseX: 10,
      mouseY: 10,
      mouseDown: false,
      keysPressed: ["Backspace"]
    });
    value = ui.inputText("Name", value);
    ui.endFrame(renderer);

    expect(value).toBe("Ab");
  });

  it("switches focus cleanly between text inputs", () => {
    const ui = new FluxUI({ origin: { x: 0, y: 0 } });
    const renderer = new MockRenderer();
    let first = "A";
    let second = "B";

    ui.beginFrame({ mouseX: 10, mouseY: 10, mouseDown: true });
    first = ui.inputText("First", first);
    second = ui.inputText("Second", second);
    ui.endFrame(renderer);

    ui.beginFrame({ mouseX: 10, mouseY: 10, mouseDown: false });
    first = ui.inputText("First", first);
    second = ui.inputText("Second", second);
    ui.endFrame(renderer);

    ui.beginFrame({ mouseX: 10, mouseY: 46, mouseDown: true });
    first = ui.inputText("First", first);
    second = ui.inputText("Second", second);
    ui.endFrame(renderer);

    ui.beginFrame({ mouseX: 10, mouseY: 46, mouseDown: false });
    first = ui.inputText("First", first);
    second = ui.inputText("Second", second);
    ui.endFrame(renderer);

    ui.beginFrame({ mouseX: 10, mouseY: 46, mouseDown: false, typedText: "!" });
    first = ui.inputText("First", first);
    second = ui.inputText("Second", second);
    ui.endFrame(renderer);

    expect(first).toBe("A");
    expect(second).toBe("B!");
  });

  it("clears focus when clicking outside an input", () => {
    const ui = new FluxUI({ origin: { x: 0, y: 0 } });
    const renderer = new MockRenderer();
    let value = "A";

    ui.beginFrame({ mouseX: 10, mouseY: 10, mouseDown: true });
    value = ui.inputText("Name", value);
    ui.endFrame(renderer);

    ui.beginFrame({ mouseX: 10, mouseY: 10, mouseDown: false });
    value = ui.inputText("Name", value);
    ui.endFrame(renderer);

    ui.beginFrame({ mouseX: 400, mouseY: 400, mouseDown: true });
    value = ui.inputText("Name", value);
    ui.endFrame(renderer);

    ui.beginFrame({ mouseX: 400, mouseY: 400, mouseDown: false, typedText: "z" });
    value = ui.inputText("Name", value);
    ui.endFrame(renderer);

    expect(value).toBe("A");
  });

  it("drops focus when a focused widget disappears from the frame", () => {
    const ui = new FluxUI({ origin: { x: 0, y: 0 } });
    const renderer = new MockRenderer();
    let value = "A";

    ui.beginFrame({ mouseX: 10, mouseY: 10, mouseDown: true });
    value = ui.inputText("Name", value);
    ui.endFrame(renderer);

    ui.beginFrame({ mouseX: 400, mouseY: 400, mouseDown: false });
    ui.label("Input hidden this frame");
    ui.endFrame(renderer);

    ui.beginFrame({ mouseX: 10, mouseY: 10, mouseDown: false, typedText: "b" });
    value = ui.inputText("Name", value);
    ui.endFrame(renderer);

    expect(value).toBe("A");
  });

  it("places items horizontally inside a horizontal layout", () => {
    const ui = new FluxUI({ origin: { x: 0, y: 0 } });
    const renderer = new MockRenderer();

    ui.beginFrame({ mouseX: -1, mouseY: -1, mouseDown: false });
    ui.beginHorizontal();
    ui.button("One");
    ui.button("Two");
    ui.endLayout();
    ui.endFrame(renderer);

    expect(renderer.rects).toHaveLength(2);
    expect(renderer.rects[1]?.x).toBeGreaterThan(renderer.rects[0]?.x ?? 0);
    expect(renderer.rects[1]?.y).toBe(renderer.rects[0]?.y);
  });

  it("keeps repeated loop buttons independent at large counts", () => {
    const ui = new FluxUI({ origin: { x: 0, y: 0 } });
    const renderer = new MockRenderer();
    const targetIndex = 732;
    const targetY = targetIndex * 36 + 10;
    let clicked = -1;

    ui.beginFrame({ mouseX: 10, mouseY: targetY, mouseDown: true });
    for (let index = 0; index < 1000; index += 1) {
      if (ui.button("Button")) {
        clicked = index;
      }
    }
    ui.endFrame(renderer);

    ui.beginFrame({ mouseX: 10, mouseY: targetY, mouseDown: false });
    for (let index = 0; index < 1000; index += 1) {
      if (ui.button("Button")) {
        clicked = index;
      }
    }
    ui.endFrame(renderer);

    expect(clicked).toBe(targetIndex);
  });

  it("keeps pushId-scoped repeated labels stable when the UI structure changes", () => {
    const ui = new FluxUI({ origin: { x: 0, y: 0 } });
    const renderer = new MockRenderer();
    let clicked = -1;

    ui.beginFrame({ mouseX: 10, mouseY: 46, mouseDown: true });
    for (const item of [1, 2, 3]) {
      ui.pushId(item);
      if (ui.button("Entry")) {
        clicked = item;
      }
      ui.popId();
    }
    ui.endFrame(renderer);

    ui.beginFrame({ mouseX: 10, mouseY: 82, mouseDown: false });
    for (const item of [0, 1, 2, 3]) {
      ui.pushId(item);
      if (ui.button("Entry")) {
        clicked = item;
      }
      ui.popId();
    }
    ui.endFrame(renderer);

    expect(clicked).toBe(2);
  });

  it("keeps unique widget IDs stable when unrelated controls are inserted", () => {
    const ui = new FluxUI({ origin: { x: 0, y: 0 } });
    const renderer = new MockRenderer();
    let clicked = "";

    ui.beginFrame({ mouseX: 10, mouseY: 46, mouseDown: true });
    if (ui.button("Alpha")) {
      clicked = "Alpha";
    }
    if (ui.button("Beta")) {
      clicked = "Beta";
    }
    ui.endFrame(renderer);

    ui.beginFrame({ mouseX: 10, mouseY: 82, mouseDown: false });
    if (ui.button("Intro")) {
      clicked = "Intro";
    }
    if (ui.button("Alpha")) {
      clicked = "Alpha";
    }
    if (ui.button("Beta")) {
      clicked = "Beta";
    }
    ui.endFrame(renderer);

    expect(clicked).toBe("Beta");
  });

  it("supports nested layouts with distinct scopes and variable widget sizes", () => {
    const ui = new FluxUI({ origin: { x: 0, y: 0 } });
    const renderer = new MockRenderer();

    ui.beginFrame({ mouseX: -1, mouseY: -1, mouseDown: false });
    ui.beginHorizontal({ id: "root-row" });
    ui.button("Wide Button");
    ui.beginVertical({ id: "right-column" });
    ui.button("Top");
    ui.button("Bottom");
    ui.endLayout();
    ui.endLayout();
    ui.endFrame(renderer);

    expect(renderer.rects).toHaveLength(3);
    expect(renderer.rects[1]?.x).toBeGreaterThan(renderer.rects[0]?.x ?? 0);
    expect(renderer.rects[2]?.y).toBeGreaterThan(renderer.rects[1]?.y ?? 0);
  });

  it("renders correctly through a non-measuring dummy renderer", () => {
    const ui = new FluxUI({ origin: { x: 0, y: 0 } });
    const renderer = new BareRenderer();

    ui.beginFrame({ mouseX: 10, mouseY: 10, mouseDown: false });
    ui.button("Dummy");
    ui.endFrame(renderer);

    expect(renderer.rects).toHaveLength(1);
    expect(renderer.texts).toContain("Dummy");
  });
});
