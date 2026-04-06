# FluxUI

FluxUI is a small immediate-mode GUI library for TypeScript.

It is built around the same basic idea as Dear ImGui: every frame, you call
widget functions again, the UI is rebuilt from scratch, and the library
resolves interaction from the current input snapshot plus a small amount of
internal state.

FluxUI is not a DOM UI toolkit and it is not a retained widget tree. It is a
frame-driven UI layer for tools, overlays, game UIs, editors, debug panels,
and custom render loops.

## Features

- Immediate-mode API: `beginFrame()`, call widgets, `endFrame()`
- Stable hot / active / focus handling
- Scope-aware widget IDs with `pushId()` / `popId()`
- Vertical and horizontal flow layouts
- Renderer abstraction with a Canvas 2D implementation
- No framework dependency
- Strict TypeScript types
- Unit tests for core interaction behavior

## Installation

```bash
npm install
npm run build
```

## Quick Start

```ts
import { FluxUI, Canvas2DRenderer, type UIInput } from "flux-ui";

const ui = new FluxUI();
const renderer = new Canvas2DRenderer(context);

let speed = 5;
let enabled = true;
let name = "Pilot";

function frame(input: UIInput): void {
  ui.beginFrame(input);

  ui.label("FluxUI Demo");

  if (ui.button("Click me")) {
    console.log("clicked");
  }

  enabled = ui.checkbox("Enabled", enabled);
  speed = ui.sliderFloat("Speed", speed, 0, 10);
  name = ui.inputText("Name", name);

  ui.endFrame(renderer);
}
```

## Input Model

FluxUI consumes a plain frame snapshot:

```ts
interface UIInput {
  mouseX: number;
  mouseY: number;
  mouseDown: boolean;
  keysDown?: readonly string[];
  keysPressed?: readonly string[];
  keysReleased?: readonly string[];
  typedText?: string;
}
```

The host application owns the render loop and feeds input into `beginFrame()`.

## IDs

Immediate-mode systems live or die on stable IDs.

FluxUI supports three common patterns:

```ts
ui.button("Play");

ui.button("Play##toolbar");
ui.button("Play##menu");

ui.button(`Health: ${hp}###player-health`);

ui.pushId(player.id);
ui.button("Select");
ui.popId();
```

- `##suffix` keeps the full string as the ID but hides the suffix from display.
- `###suffix` lets the visible label change while the ID stays fixed.
- `pushId()` / `popId()` scopes repeated widgets in loops or nested layouts.

## Layout

FluxUI ships with simple flow layout helpers:

```ts
ui.beginHorizontal();
ui.button("Left");
ui.button("Right");
ui.endLayout();

ui.beginVertical({ id: "sidebar", padding: 8, spacing: 6 });
ui.label("Tools");
ui.button("Brush");
ui.button("Eraser");
ui.endLayout();
```

## Renderer

The core only depends on a small renderer interface:

```ts
interface UIRenderer {
  drawRect(x: number, y: number, width: number, height: number, color: string): void;
  drawText(x: number, y: number, text: string, font: string, color: string): void;
  drawLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    thickness: number,
    color: string
  ): void;
  measureText?(text: string, font: string): number;
}
```

If `measureText()` is missing, FluxUI falls back to a simple width estimate.

## Development

```bash
npm test
npm run build
```

## Project Layout

```text
src/
  core/         shared types, geometry, layout, style
  renderers/    renderer interface and Canvas 2D backend
  flux-ui.ts    main context and widgets
  example.ts    typed usage example
  index.ts      public exports
tests/
  flux-ui.test.ts
```

## Status

FluxUI is a compact core library, not a full editor UI framework. The current
focus is correctness and ergonomics in the immediate-mode core: stable IDs,
predictable interaction ownership, and renderer independence.
