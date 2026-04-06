import type { UIInput } from "./core/types.js";
import { FluxUI } from "./flux-ui.js";
import { Canvas2DRenderer } from "./renderers/canvas2d-renderer.js";

/**
 * Example immediate-mode application loop showing how FluxUI is driven by host input.
 */
export function createExampleLoop(context: CanvasRenderingContext2D) {
  const ui = new FluxUI();
  const renderer = new Canvas2DRenderer(context);
  let speed = 5;
  let enabled = false;
  let playerName = "Pilot";

  return (input: UIInput): void => {
    ui.beginFrame(input);

    ui.label("FluxUI Demo");

    if (ui.button("Click me")) {
      console.log("Clicked!");
    }

    enabled = ui.checkbox("Enabled", enabled);
    speed = ui.sliderFloat("Speed", speed, 0, 10);
    playerName = ui.inputText("Name", playerName);

    ui.beginHorizontal();
    ui.label(`Speed = ${speed.toFixed(1)}`);
    ui.label(enabled ? "Ready" : "Paused");
    ui.endLayout();

    ui.endFrame(renderer);
  };
}
