import { performance } from "node:perf_hooks";

import {
  FluxUI,
  type FluxUIDebugState
} from "../../src/flux-ui.js";
import type { UIInput } from "../../src/core/types.js";
import type { UIRenderer } from "../../src/renderers/ui-renderer.js";

type WidgetKind = "label" | "button" | "checkbox" | "sliderFloat" | "inputText";
type LayoutKind = "vertical" | "horizontal";

interface BaseAction {
  readonly id: string;
}

export interface LabelAction extends BaseAction {
  readonly kind: "label";
  readonly label: string;
}

export interface ButtonAction extends BaseAction {
  readonly kind: "button";
  readonly label: string;
}

export interface CheckboxAction extends BaseAction {
  readonly kind: "checkbox";
  readonly label: string;
  readonly initial: boolean;
}

export interface SliderAction extends BaseAction {
  readonly kind: "sliderFloat";
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly initial: number;
}

export interface InputAction extends BaseAction {
  readonly kind: "inputText";
  readonly label: string;
  readonly initial: string;
}

export interface LayoutAction extends BaseAction {
  readonly kind: "layout";
  readonly direction: LayoutKind;
  readonly enabled: boolean;
  readonly spacing: number;
  readonly padding: number;
  readonly children: readonly ScenarioAction[];
}

export type ScenarioAction =
  | LabelAction
  | ButtonAction
  | CheckboxAction
  | SliderAction
  | InputAction
  | LayoutAction;

export interface ScenarioFrame {
  readonly input: UIInput;
  readonly actions: readonly ScenarioAction[];
}

export interface UIScenario {
  readonly seed: number;
  readonly frames: readonly ScenarioFrame[];
}

export interface WidgetTraceEntry {
  readonly frame: number;
  readonly kind: WidgetKind;
  readonly id: string;
  readonly label: string;
  readonly before: FluxUIDebugState;
  readonly after: FluxUIDebugState;
  readonly result?: boolean | number | string;
}

export interface ReplayTraceFrame {
  readonly input: UIInput;
  readonly startState: FluxUIDebugState;
  readonly widgets: readonly WidgetTraceEntry[];
  readonly endState: FluxUIDebugState;
}

export interface ReplayTrace {
  readonly seed: number;
  readonly frames: readonly ReplayTraceFrame[];
  readonly finalBooleans: Readonly<Record<string, boolean>>;
  readonly finalNumbers: Readonly<Record<string, number>>;
  readonly finalStrings: Readonly<Record<string, string>>;
}

export interface RendererSummary {
  readonly rectCount: number;
  readonly textCount: number;
  readonly lineCount: number;
  readonly totalTextChars: number;
}

export interface ReplayMetrics {
  readonly totalFrameTimeMs: number;
  readonly averageFrameTimeMs: number;
  readonly maxFrameTimeMs: number;
  readonly heapDeltaBytes: number;
}

export interface ReplayResult {
  readonly trace: ReplayTrace;
  readonly renderer: RendererSummary;
  readonly metrics: ReplayMetrics;
}

interface WidgetDefinition {
  readonly id: string;
  readonly kind: WidgetKind;
  readonly label: string;
  readonly initialBoolean: boolean;
  readonly initialNumber: number;
  readonly initialString: string;
  readonly min: number;
  readonly max: number;
}

interface LayoutDefinition {
  readonly id: string;
  readonly direction: LayoutKind;
}

class Random {
  private state: number;

  public constructor(seed: number) {
    this.state = seed >>> 0;
  }

  public next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  public boolean(probability = 0.5): boolean {
    return this.next() < probability;
  }

  public int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  public pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)] as T;
  }

  public shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = this.int(0, index);
      const value = copy[index];
      copy[index] = copy[swapIndex] as T;
      copy[swapIndex] = value as T;
    }
    return copy;
  }

  public text(minLength: number, maxLength: number): string {
    const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    const length = this.int(minLength, maxLength);
    let value = "";

    for (let index = 0; index < length; index += 1) {
      value += alphabet[this.int(0, alphabet.length - 1)];
    }

    return value;
  }
}

export class CountingRenderer implements UIRenderer {
  private rectCount = 0;
  private textCount = 0;
  private lineCount = 0;
  private totalTextChars = 0;

  public drawRect(): void {
    this.rectCount += 1;
  }

  public drawText(_x: number, _y: number, text: string): void {
    this.textCount += 1;
    this.totalTextChars += text.length;
  }

  public drawLine(): void {
    this.lineCount += 1;
  }

  public measureText(text: string): number {
    return text.length * 8;
  }

  public summary(): RendererSummary {
    return {
      rectCount: this.rectCount,
      textCount: this.textCount,
      lineCount: this.lineCount,
      totalTextChars: this.totalTextChars
    };
  }
}

const LABEL_POOL = [
  "Open",
  "Save",
  "Build",
  "State",
  "Metrics",
  "Inspector",
  "Buffer",
  "Console",
  "Timeline",
  "Viewport"
] as const;

const KEY_POOL = [
  "Backspace",
  "Enter",
  "Escape",
  "Tab",
  "ArrowLeft",
  "ArrowRight"
] as const;

function createWidgetCatalog(random: Random, count: number): WidgetDefinition[] {
  const kinds: readonly WidgetKind[] = [
    "label",
    "button",
    "checkbox",
    "sliderFloat",
    "inputText"
  ];

  return Array.from({ length: count }, (_unused, index) => {
    const label = `${random.pick(LABEL_POOL)} ${random.text(3, 10)}`;
    return {
      id: `widget-${index}`,
      kind: random.pick(kinds),
      label,
      initialBoolean: random.boolean(),
      initialNumber: random.int(-25, 100),
      initialString: random.text(2, 8),
      min: random.int(-50, 0),
      max: random.int(10, 150)
    };
  });
}

function createLayoutCatalog(random: Random, count: number): LayoutDefinition[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `layout-${index}`,
    direction: random.boolean() ? "vertical" : "horizontal"
  }));
}

function createInputSequence(random: Random, frameCount: number): UIInput[] {
  const inputs: UIInput[] = [];
  const keysDown = new Set<string>();
  let mouseDown = false;

  for (let frame = 0; frame < frameCount; frame += 1) {
    if (random.boolean(0.38)) {
      mouseDown = !mouseDown;
    }

    const keysPressed = new Set<string>();
    const keysReleased = new Set<string>();

    const keyMutations = random.int(0, 2);
    for (let mutation = 0; mutation < keyMutations; mutation += 1) {
      const key = random.pick(KEY_POOL);
      if (keysDown.has(key)) {
        keysDown.delete(key);
        keysReleased.add(key);
      } else {
        keysDown.add(key);
        keysPressed.add(key);
      }
    }

    if (random.boolean(0.08)) {
      keysPressed.add(random.pick(KEY_POOL));
    }

    if (random.boolean(0.06)) {
      keysReleased.add(random.pick(KEY_POOL));
    }

    inputs.push({
      mouseX: random.int(-180, 900),
      mouseY: random.int(-180, 3600),
      mouseDown,
      deltaTime: [0, 1 / 240, 1 / 120, 1 / 60, 1 / 30, 1 / 12][random.int(0, 5)],
      keysDown: [...keysDown].sort(),
      keysPressed: [...keysPressed].sort(),
      keysReleased: [...keysReleased].sort(),
      typedText: random.boolean(0.18) ? random.text(1, 3) : ""
    });
  }

  return inputs;
}

function buildFrameActions(
  random: Random,
  widgetCatalog: readonly WidgetDefinition[],
  layoutCatalog: readonly LayoutDefinition[],
  depth: number,
  targetCount: number
): ScenarioAction[] {
  const actions: ScenarioAction[] = [];

  while (actions.length < targetCount) {
    if (depth < 3 && random.boolean(0.28)) {
      const layout = random.pick(layoutCatalog);
      const childCount = random.int(3, 9);

      actions.push({
        kind: "layout",
        id: layout.id,
        direction: layout.direction,
        enabled: random.boolean(0.8),
        spacing: random.int(2, 12),
        padding: random.int(0, 10),
        children: buildFrameActions(random, widgetCatalog, layoutCatalog, depth + 1, childCount)
      });

      continue;
    }

    const widget = random.pick(widgetCatalog);

    if (widget.kind === "label") {
      actions.push({
        kind: "label",
        id: widget.id,
        label: widget.label
      });
    } else if (widget.kind === "button") {
      actions.push({
        kind: "button",
        id: widget.id,
        label: widget.label
      });
    } else if (widget.kind === "checkbox") {
      actions.push({
        kind: "checkbox",
        id: widget.id,
        label: widget.label,
        initial: widget.initialBoolean
      });
    } else if (widget.kind === "sliderFloat") {
      actions.push({
        kind: "sliderFloat",
        id: widget.id,
        label: widget.label,
        min: widget.min,
        max: widget.max,
        initial: widget.initialNumber
      });
    } else {
      actions.push({
        kind: "inputText",
        id: widget.id,
        label: widget.label,
        initial: widget.initialString
      });
    }
  }

  return random.shuffle(actions);
}

export function createRandomScenario(
  seed: number,
  frameCount: number,
  widgetPoolSize = 180,
  layoutPoolSize = 24
): UIScenario {
  const random = new Random(seed);
  const widgetCatalog = createWidgetCatalog(random, widgetPoolSize);
  const layoutCatalog = createLayoutCatalog(random, layoutPoolSize);
  const inputs = createInputSequence(random, frameCount);
  const frames: ScenarioFrame[] = [];

  for (let frame = 0; frame < frameCount; frame += 1) {
    frames.push({
      input: inputs[frame] as UIInput,
      actions: buildFrameActions(random, widgetCatalog, layoutCatalog, 0, random.int(10, 22))
    });
  }

  return {
    seed,
    frames
  };
}

function snapshotInput(input: UIInput): UIInput {
  return {
    mouseX: input.mouseX,
    mouseY: input.mouseY,
    mouseDown: input.mouseDown,
    deltaTime: input.deltaTime,
    keysDown: input.keysDown ? [...input.keysDown] : undefined,
    keysPressed: input.keysPressed ? [...input.keysPressed] : undefined,
    keysReleased: input.keysReleased ? [...input.keysReleased] : undefined,
    typedText: input.typedText
  };
}

function sortEntries<T>(map: ReadonlyMap<string, T>): Record<string, T> {
  return Object.fromEntries([...map.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

export function runScenario(
  scenario: UIScenario,
  ui = new FluxUI({ origin: { x: 0, y: 0 } }),
  renderer = new CountingRenderer()
): ReplayResult {
  const booleanState = new Map<string, boolean>();
  const numberState = new Map<string, number>();
  const stringState = new Map<string, string>();
  const frames: ReplayTraceFrame[] = [];
  const frameTimes: number[] = [];
  const startHeap = process.memoryUsage().heapUsed;

  for (const frame of scenario.frames) {
    const frameStart = performance.now();
    ui.beginFrame(frame.input);
    const startState = ui.getDebugState();
    const widgetEntries: WidgetTraceEntry[] = [];

    executeActions(ui, frame.actions, widgetEntries, booleanState, numberState, stringState);

    ui.endFrame(renderer);
    frameTimes.push(performance.now() - frameStart);

    frames.push({
      input: snapshotInput(frame.input),
      startState,
      widgets: widgetEntries,
      endState: ui.getDebugState()
    });
  }

  const totalFrameTimeMs = frameTimes.reduce((sum, value) => sum + value, 0);

  return {
    trace: {
      seed: scenario.seed,
      frames,
      finalBooleans: sortEntries(booleanState),
      finalNumbers: sortEntries(numberState),
      finalStrings: sortEntries(stringState)
    },
    renderer: renderer.summary(),
    metrics: {
      totalFrameTimeMs,
      averageFrameTimeMs: frameTimes.length === 0 ? 0 : totalFrameTimeMs / frameTimes.length,
      maxFrameTimeMs: frameTimes.length === 0 ? 0 : Math.max(...frameTimes),
      heapDeltaBytes: process.memoryUsage().heapUsed - startHeap
    }
  };
}

function executeActions(
  ui: FluxUI,
  actions: readonly ScenarioAction[],
  entries: WidgetTraceEntry[],
  booleanState: Map<string, boolean>,
  numberState: Map<string, number>,
  stringState: Map<string, string>
): void {
  for (const action of actions) {
    if (action.kind === "layout") {
      if (!action.enabled) {
        continue;
      }

      if (action.direction === "vertical") {
        ui.beginVertical({
          id: action.id,
          spacing: action.spacing,
          padding: action.padding
        });
      } else {
        ui.beginHorizontal({
          id: action.id,
          spacing: action.spacing,
          padding: action.padding
        });
      }

      executeActions(ui, action.children, entries, booleanState, numberState, stringState);
      ui.endLayout();
      continue;
    }

    const before = ui.getDebugState();
    const label = `${action.label}###${action.id}`;
    let result: boolean | number | string | undefined;

    if (action.kind === "label") {
      ui.label(action.label);
    } else if (action.kind === "button") {
      result = ui.button(label);
    } else if (action.kind === "checkbox") {
      const currentValue = booleanState.get(action.id) ?? action.initial;
      result = ui.checkbox(label, currentValue);
      booleanState.set(action.id, result);
    } else if (action.kind === "sliderFloat") {
      const currentValue = numberState.get(action.id) ?? action.initial;
      result = ui.sliderFloat(label, currentValue, action.min, action.max);
      numberState.set(action.id, result);
    } else {
      const currentValue = stringState.get(action.id) ?? action.initial;
      result = ui.inputText(label, currentValue);
      stringState.set(action.id, result);
    }

    entries.push({
      frame: before.frameNumber,
      kind: action.kind,
      id: action.id,
      label: action.label,
      before,
      after: ui.getDebugState(),
      result
    });
  }
}
