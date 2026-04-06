import type { DrawCommand } from "./core/commands.js";
import { clamp, containsPoint, type UIRect } from "./core/geometry.js";
import {
  createLayout,
  measureLayout,
  placeLayoutItem,
  type LayoutDirection,
  type LayoutOptions,
  type LayoutState
} from "./core/layout.js";
import { defaultStyle, type FluxUIStyle } from "./core/style.js";
import type { UIInput } from "./core/types.js";
import type { UIRenderer } from "./renderers/ui-renderer.js";

/*!
 * FluxUI
 * -------
 * A small immediate-mode GUI core for TypeScript.
 *
 * Usage:
 *   const ui = new FluxUI();
 *   ui.beginFrame(input);
 *   if (ui.button("Run")) {
 *     // ...
 *   }
 *   ui.endFrame(renderer);
 *
 * ID rules:
 *   - Repeated widgets should use pushId()/popId() or hidden label suffixes.
 *   - "Label##id" keeps the suffix out of the visible text.
 *   - "Label###id" lets the visible label change without changing the ID.
 *
 * Notes:
 *   - Widgets are rebuilt every frame.
 *   - The host owns the render loop and input collection.
 *   - FluxUI keeps only the minimum persistent state needed for interaction.
 */

export interface FluxUIPoint {
  readonly x: number;
  readonly y: number;
}

export interface FluxUIOptions {
  readonly origin?: FluxUIPoint;
  readonly style?: Partial<FluxUIStyle>;
}

interface NormalizedInput {
  mouseX: number;
  mouseY: number;
  mouseDown: boolean;
  mousePressed: boolean;
  mouseReleased: boolean;
  keysDown: ReadonlySet<string>;
  keysPressed: ReadonlySet<string>;
  keysReleased: ReadonlySet<string>;
  typedText: string;
}

export class FluxUI {
  public readonly style: FluxUIStyle;

  private readonly drawCommands: DrawCommand[] = [];
  private readonly layoutStack: LayoutState[] = [];
  private readonly idStack: number[] = [0x811c9dc5];
  private readonly idOccurrences = new Map<number, number>();
  private readonly previousKeys = new Set<string>();
  private readonly seenWidgetIds = new Set<number>();
  private readonly origin: FluxUIPoint;

  private input: NormalizedInput = this.createEmptyInput();
  private lastRenderer?: UIRenderer;
  private activeId = 0;
  private hotId = 0;
  private focusedId = 0;
  private frameStarted = false;

  constructor(options: FluxUIOptions = {}) {
    this.origin = options.origin ?? { x: 16, y: 16 };
    this.style = { ...defaultStyle, ...options.style };
  }

  beginFrame(input: UIInput): void {
    this.frameStarted = true;
    this.drawCommands.length = 0;
    this.layoutStack.length = 0;
    this.idStack.length = 1;
    this.idStack[0] = 0x811c9dc5;
    this.idOccurrences.clear();
    this.seenWidgetIds.clear();
    this.hotId = 0;
    this.input = this.normalizeInput(input);
    this.layoutStack.push(
      createLayout("vertical", this.origin.x, this.origin.y, this.style.itemSpacing, 0, false)
    );
  }

  endFrame(renderer: UIRenderer): void {
    this.assertFrameActive();

    for (const command of this.drawCommands) {
      if (command.kind === "rect") {
        renderer.drawRect(command.x, command.y, command.width, command.height, command.color);
      } else if (command.kind === "text") {
        renderer.drawText(command.x, command.y, command.text, command.font, command.color);
      } else {
        renderer.drawLine(
          command.x1,
          command.y1,
          command.x2,
          command.y2,
          command.thickness,
          command.color
        );
      }
    }

    if (this.activeId !== 0 && (this.input.mouseReleased || !this.seenWidgetIds.has(this.activeId))) {
      this.activeId = 0;
    }

    if (this.focusedId !== 0 && !this.seenWidgetIds.has(this.focusedId)) {
      this.focusedId = 0;
    }

    this.previousKeys.clear();
    for (const key of this.input.keysDown) {
      this.previousKeys.add(key);
    }

    this.lastRenderer = renderer;
    this.frameStarted = false;
  }

  pushId(value: string | number): void {
    this.assertFrameActive();
    const scope = this.idStack[this.idStack.length - 1];
    this.idStack.push(this.hashCombine(scope, this.hashValue(String(value))));
  }

  popId(): void {
    this.assertFrameActive();
    if (this.idStack.length === 1) {
      throw new Error("Cannot pop the root FluxUI ID scope.");
    }

    this.idStack.pop();
  }

  beginVertical(options: LayoutOptions = {}): void {
    this.beginLayout("vertical", options);
  }

  beginHorizontal(options: LayoutOptions = {}): void {
    this.beginLayout("horizontal", options);
  }

  endLayout(): void {
    this.assertFrameActive();
    if (this.layoutStack.length === 1) {
      throw new Error("Cannot end the root FluxUI layout.");
    }

    const child = this.layoutStack.pop();
    if (!child) {
      return;
    }

    const bounds = measureLayout(child);
    this.advanceParentLayout(this.currentLayout(), bounds.width, bounds.height);

    if (child.ownsIdScope) {
      this.popId();
    }
  }

  setCursor(x: number, y: number): void {
    this.assertFrameActive();
    const layout = this.currentLayout();
    layout.cursorX = x;
    layout.cursorY = y;
  }

  label(text: string): void {
    this.assertFrameActive();
    const { displayText } = this.splitLabel(text);
    const rect = this.allocateRect(
      this.measureText(displayText),
      this.style.fontSize + this.style.verticalPadding * 2
    );

    this.queueText(rect.x, rect.y + this.style.verticalPadding, displayText, this.style.font, this.style.textColor);
  }

  button(label: string): boolean {
    this.assertFrameActive();

    const { displayText, idText } = this.splitLabel(label);
    const id = this.nextWidgetId("button", idText);
    const rect = this.allocateRect(
      this.measureText(displayText) + this.style.horizontalPadding * 2,
      this.style.widgetHeight
    );
    const hovered = this.updateHotState(id, rect);
    const pressed = this.handlePress(id, hovered);

    this.queueRect(rect.x, rect.y, rect.width, rect.height, this.resolveButtonColor(id, hovered));
    this.queueText(
      rect.x + this.style.horizontalPadding,
      rect.y + this.style.verticalPadding,
      displayText,
      this.style.font,
      this.style.textColor
    );
    this.queueRectOutline(rect);

    return pressed;
  }

  checkbox(label: string, value: boolean): boolean {
    this.assertFrameActive();

    const { displayText, idText } = this.splitLabel(label);
    const id = this.nextWidgetId("checkbox", idText);
    const rect = this.allocateRect(
      this.style.checkboxSize + this.style.horizontalPadding + this.measureText(displayText),
      Math.max(this.style.checkboxSize, this.style.widgetHeight)
    );
    const hovered = this.updateHotState(id, rect);
    const nextValue = this.handlePress(id, hovered) ? !value : value;
    const boxRect: UIRect = {
      x: rect.x,
      y: rect.y + Math.floor((rect.height - this.style.checkboxSize) / 2),
      width: this.style.checkboxSize,
      height: this.style.checkboxSize
    };

    this.queueRect(boxRect.x, boxRect.y, boxRect.width, boxRect.height, this.style.panelColor);
    this.queueRectOutline(boxRect, hovered ? this.style.accentColor : this.style.borderColor);

    if (nextValue) {
      this.queueLine(
        boxRect.x + 4,
        boxRect.y + boxRect.height / 2,
        boxRect.x + boxRect.width / 2,
        boxRect.y + boxRect.height - 4,
        2,
        this.style.accentColor
      );
      this.queueLine(
        boxRect.x + boxRect.width / 2,
        boxRect.y + boxRect.height - 4,
        boxRect.x + boxRect.width - 4,
        boxRect.y + 4,
        2,
        this.style.accentColor
      );
    }

    this.queueText(
      rect.x + this.style.checkboxSize + this.style.horizontalPadding,
      rect.y + this.style.verticalPadding,
      displayText,
      this.style.font,
      this.style.textColor
    );

    return nextValue;
  }

  sliderFloat(label: string, value: number, min: number, max: number): number {
    this.assertFrameActive();

    const { displayText, idText } = this.splitLabel(label);
    const id = this.nextWidgetId("sliderFloat", idText);
    const rect = this.allocateRect(this.style.sliderWidth, this.style.widgetHeight);
    const hovered = this.updateHotState(id, rect);
    let nextValue = clamp(value, min, max);

    if (hovered && this.input.mousePressed) {
      this.activeId = id;
    }

    if (this.activeId === id) {
      if (this.input.mouseDown) {
        const ratio = clamp((this.input.mouseX - rect.x) / rect.width, 0, 1);
        nextValue = min + (max - min) * ratio;
      } else if (this.input.mouseReleased) {
        this.activeId = 0;
      }
    }

    const normalized = max === min ? 0 : (nextValue - min) / (max - min);
    const fillWidth = rect.width * normalized;

    this.queueRect(rect.x, rect.y, rect.width, rect.height, this.style.panelColor);
    this.queueRect(rect.x, rect.y, fillWidth, rect.height, this.style.accentColor);
    this.queueRectOutline(rect, this.activeId === id ? this.style.focusColor : this.style.borderColor);
    this.queueText(
      rect.x + this.style.horizontalPadding,
      rect.y + this.style.verticalPadding,
      `${displayText}: ${nextValue.toFixed(2)}`,
      this.style.font,
      this.style.textColor
    );

    return nextValue;
  }

  inputText(label: string, value: string): string {
    this.assertFrameActive();

    const { displayText, idText } = this.splitLabel(label);
    const id = this.nextWidgetId("inputText", idText);
    const rect = this.allocateRect(this.style.inputWidth, this.style.widgetHeight);
    const hovered = this.updateHotState(id, rect);
    let nextValue = value;

    if (hovered && this.input.mousePressed) {
      this.focusedId = id;
    } else if (!hovered && this.input.mousePressed && this.focusedId === id) {
      this.focusedId = 0;
    }

    if (this.focusedId === id) {
      if (this.input.typedText.length > 0) {
        nextValue += this.input.typedText;
      }

      if (this.input.keysPressed.has("Backspace") && nextValue.length > 0) {
        nextValue = nextValue.slice(0, -1);
      }

      if (this.input.keysPressed.has("Escape") || this.input.keysPressed.has("Enter")) {
        this.focusedId = 0;
      }
    }

    this.queueRect(
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      this.focusedId === id ? this.style.focusColor : this.style.panelColor
    );
    this.queueRectOutline(rect, hovered ? this.style.accentColor : this.style.borderColor);
    this.queueText(
      rect.x + this.style.horizontalPadding,
      rect.y + this.style.verticalPadding,
      `${displayText}: ${nextValue}`,
      this.style.font,
      this.style.textColor
    );

    return nextValue;
  }

  private beginLayout(direction: LayoutDirection, options: LayoutOptions): void {
    this.assertFrameActive();

    const parent = this.currentLayout();
    const ownsIdScope = options.id !== undefined;

    if (ownsIdScope) {
      this.pushId(options.id);
    }

    this.layoutStack.push(
      createLayout(
        direction,
        options.x ?? parent.cursorX,
        options.y ?? parent.cursorY,
        options.spacing ?? this.style.itemSpacing,
        options.padding ?? 0,
        ownsIdScope
      )
    );
  }

  private createEmptyInput(): NormalizedInput {
    return {
      mouseX: 0,
      mouseY: 0,
      mouseDown: false,
      mousePressed: false,
      mouseReleased: false,
      keysDown: new Set<string>(),
      keysPressed: new Set<string>(),
      keysReleased: new Set<string>(),
      typedText: ""
    };
  }

  private normalizeInput(input: UIInput): NormalizedInput {
    const keysDown = new Set(input.keysDown ?? []);
    const providedPressed = input.keysPressed ? new Set(input.keysPressed) : undefined;
    const providedReleased = input.keysReleased ? new Set(input.keysReleased) : undefined;
    const keysPressed = providedPressed ?? new Set<string>();
    const keysReleased = providedReleased ?? new Set<string>();

    if (!providedPressed) {
      for (const key of keysDown) {
        if (!this.previousKeys.has(key)) {
          keysPressed.add(key);
        }
      }
    }

    if (!providedReleased) {
      for (const previousKey of this.previousKeys) {
        if (!keysDown.has(previousKey)) {
          keysReleased.add(previousKey);
        }
      }
    }

    return {
      mouseX: input.mouseX,
      mouseY: input.mouseY,
      mouseDown: input.mouseDown,
      mousePressed: input.mouseDown && !this.input.mouseDown,
      mouseReleased: !input.mouseDown && this.input.mouseDown,
      keysDown,
      keysPressed,
      keysReleased,
      typedText: input.typedText ?? ""
    };
  }

  private assertFrameActive(): void {
    if (!this.frameStarted) {
      throw new Error("FluxUI.beginFrame() must be called before issuing widgets.");
    }
  }

  private currentLayout(): LayoutState {
    const layout = this.layoutStack[this.layoutStack.length - 1];
    if (!layout) {
      throw new Error("No active FluxUI layout.");
    }

    return layout;
  }

  private advanceParentLayout(layout: LayoutState, width: number, height: number): void {
    placeLayoutItem(layout, width, height);
  }

  private allocateRect(width: number, height: number): UIRect {
    return placeLayoutItem(this.currentLayout(), width, height);
  }

  private nextWidgetId(kind: string, seed: string): number {
    const scope = this.idStack[this.idStack.length - 1];
    const baseId = this.hashCombine(
      this.hashCombine(scope, this.hashValue(kind)),
      this.hashValue(seed)
    );
    const occurrence = this.idOccurrences.get(baseId) ?? 0;

    this.idOccurrences.set(baseId, occurrence + 1);

    const id = this.hashCombine(baseId, occurrence);
    this.seenWidgetIds.add(id);
    return id;
  }

  // ImGui-style label parsing:
  // "Label##id"  -> visible text "Label", ID "Label##id"
  // "Label###id" -> visible text "Label", ID "id"
  private splitLabel(label: string): { displayText: string; idText: string } {
    const dynamicIdIndex = label.indexOf("###");
    if (dynamicIdIndex >= 0) {
      return {
        displayText: label.slice(0, dynamicIdIndex),
        idText: label.slice(dynamicIdIndex + 3)
      };
    }

    const hiddenIdIndex = label.indexOf("##");
    if (hiddenIdIndex >= 0) {
      return {
        displayText: label.slice(0, hiddenIdIndex),
        idText: label
      };
    }

    return {
      displayText: label,
      idText: label
    };
  }

  private hashValue(value: string): number {
    let hash = 0x811c9dc5;

    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }

    return hash >>> 0;
  }

  private hashCombine(a: number, b: number): number {
    let hash = a ^ b;
    hash = Math.imul(hash, 0x01000193);
    return hash >>> 0;
  }

  private updateHotState(id: number, rect: UIRect): boolean {
    const hovered = containsPoint(rect, this.input.mouseX, this.input.mouseY);

    if (hovered) {
      this.hotId = id;
    }

    return hovered;
  }

  private handlePress(id: number, hovered: boolean): boolean {
    if (hovered && this.input.mousePressed) {
      this.activeId = id;
      return false;
    }

    if (this.activeId === id && this.input.mouseReleased) {
      const pressed = hovered;
      this.activeId = 0;
      return pressed;
    }

    if (!this.input.mouseDown && this.activeId === id && !hovered) {
      this.activeId = 0;
    }

    return false;
  }

  private resolveButtonColor(id: number, hovered: boolean): string {
    if (this.activeId === id && this.input.mouseDown) {
      return this.style.buttonActiveColor;
    }

    if (hovered) {
      return this.style.buttonHotColor;
    }

    return this.style.buttonColor;
  }

  private measureText(text: string): number {
    if (this.lastRenderer?.measureText) {
      return this.lastRenderer.measureText(text, this.style.font);
    }

    return Math.ceil(text.length * this.style.fontSize * 0.6);
  }

  private queueRect(x: number, y: number, width: number, height: number, color: string): void {
    this.drawCommands.push({ kind: "rect", x, y, width, height, color });
  }

  private queueText(x: number, y: number, text: string, font: string, color: string): void {
    this.drawCommands.push({ kind: "text", x, y, text, font, color });
  }

  private queueLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    thickness: number,
    color: string
  ): void {
    this.drawCommands.push({ kind: "line", x1, y1, x2, y2, thickness, color });
  }

  private queueRectOutline(rect: UIRect, color = this.style.borderColor): void {
    const right = rect.x + rect.width;
    const bottom = rect.y + rect.height;

    this.queueLine(rect.x, rect.y, right, rect.y, 1, color);
    this.queueLine(right, rect.y, right, bottom, 1, color);
    this.queueLine(right, bottom, rect.x, bottom, 1, color);
    this.queueLine(rect.x, bottom, rect.x, rect.y, 1, color);
  }
}
