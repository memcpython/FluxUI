import { describe, expect, it } from "vitest";

import { FluxUI } from "../src/flux-ui.js";
import type { UIRenderer } from "../src/renderers/ui-renderer.js";

class NullRenderer implements UIRenderer {
  public drawRect(): void {}
  public drawText(): void {}
  public drawLine(): void {}
}

describe("FluxUI misuse handling", () => {
  it("throws when a widget is called before beginFrame()", () => {
    const ui = new FluxUI();

    expect(() => ui.button("Broken")).toThrowError(/beginFrame/);
  });

  it("throws when endFrame() is called without an active frame", () => {
    const ui = new FluxUI();

    expect(() => ui.endFrame(new NullRenderer())).toThrowError(/beginFrame/);
  });

  it("throws when beginFrame() is called twice without endFrame()", () => {
    const ui = new FluxUI();

    ui.beginFrame({ mouseX: 0, mouseY: 0, mouseDown: false });

    expect(() =>
      ui.beginFrame({ mouseX: 0, mouseY: 0, mouseDown: false })
    ).toThrowError(/forget endFrame/i);
  });

  it("throws on popId() from the root scope", () => {
    const ui = new FluxUI();

    ui.beginFrame({ mouseX: 0, mouseY: 0, mouseDown: false });

    expect(() => ui.popId()).toThrowError(/root FluxUI ID scope/i);
  });

  it("throws on unbalanced pushId()/popId() and recovers on the next frame", () => {
    const ui = new FluxUI({ origin: { x: 0, y: 0 } });
    const renderer = new NullRenderer();

    ui.beginFrame({ mouseX: 0, mouseY: 0, mouseDown: false });
    ui.pushId("dangling");
    ui.button("Button");

    expect(() => ui.endFrame(renderer)).toThrowError(/Unbalanced ID scopes/i);

    ui.beginFrame({ mouseX: 10, mouseY: 10, mouseDown: true });
    expect(ui.button("Recover")).toBe(false);
    ui.endFrame(renderer);
  });

  it("throws on unbalanced layouts and recovers on the next frame", () => {
    const ui = new FluxUI({ origin: { x: 0, y: 0 } });
    const renderer = new NullRenderer();

    ui.beginFrame({ mouseX: 0, mouseY: 0, mouseDown: false });
    ui.beginHorizontal();
    ui.button("Left");

    expect(() => ui.endFrame(renderer)).toThrowError(/Unbalanced layout scopes/i);

    ui.beginFrame({ mouseX: 10, mouseY: 10, mouseDown: false });
    ui.label("Recovered");
    ui.endFrame(renderer);

    expect(ui.getDebugState().frameNumber).toBe(2);
  });
});
