import { performance } from "node:perf_hooks";

import { describe, expect, it } from "vitest";

import { FluxUI } from "../src/flux-ui.js";
import {
  CountingRenderer,
  createRandomScenario,
  runScenario
} from "./helpers/stress-harness.js";

describe("FluxUI stress and fuzz", () => {
  it("replays seeded randomized UI traces deterministically", () => {
    const scenario = createRandomScenario(0xc0ffee, 64, 220, 28);

    const firstRun = runScenario(scenario);
    const secondRun = runScenario(scenario);

    expect(secondRun.trace).toEqual(firstRun.trace);
    expect(secondRun.renderer).toEqual(firstRun.renderer);
  });

  it("survives randomized nesting, input fuzzing, and dynamic section toggling across many frames", () => {
    const seeds = [0x1234, 0xdeadbeef, 0x51f15e];

    for (const seed of seeds) {
      const result = runScenario(createRandomScenario(seed, 120, 260, 32));

      expect(result.trace.frames).toHaveLength(120);
      expect(result.renderer.rectCount).toBeGreaterThan(1000);
      expect(result.metrics.maxFrameTimeMs).toBeLessThan(1500);
      expect(
        Object.values(result.trace.finalNumbers).every((value) => Number.isFinite(value))
      ).toBe(true);
      expect(
        Object.values(result.trace.finalStrings).every((value) => typeof value === "string")
      ).toBe(true);
    }
  });

  it("handles a large stress frame with deep nesting and more than 12000 widget calls", () => {
    const ui = new FluxUI({ origin: { x: 0, y: 0 } });
    const renderer = new CountingRenderer();
    const startHeap = process.memoryUsage().heapUsed;
    const start = performance.now();

    ui.beginFrame({ mouseX: 9999, mouseY: 9999, mouseDown: false });

    for (let layer = 0; layer < 6; layer += 1) {
      if (layer % 2 === 0) {
        ui.beginVertical({ id: `layer-${layer}`, padding: 2, spacing: 2 });
      } else {
        ui.beginHorizontal({ id: `layer-${layer}`, padding: 2, spacing: 2 });
      }
    }

    for (let index = 0; index < 4000; index += 1) {
      ui.button(`Action ${index}###stress-button-${index}`);
      ui.checkbox(`Enabled ${index}###stress-checkbox-${index}`, index % 2 === 0);
      ui.label(`Trace channel ${index} / metrics / replay / layout / immediate mode`);
    }

    for (let layer = 0; layer < 6; layer += 1) {
      ui.endLayout();
    }

    ui.endFrame(renderer);

    const elapsedMs = performance.now() - start;
    const heapDeltaBytes = process.memoryUsage().heapUsed - startHeap;
    const debug = ui.getDebugState();

    expect(debug.widgetCount).toBe(12000);
    expect(renderer.summary().textCount).toBe(12000);
    expect(renderer.summary().rectCount).toBeGreaterThan(7000);
    expect(elapsedMs).toBeLessThan(8000);
    expect(Math.abs(heapDeltaBytes)).toBeLessThan(512 * 1024 * 1024);
  });
});
