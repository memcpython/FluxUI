import type { DrawCommand } from "./core/commands.js";
import {
  blinkWave,
  clamp01,
  createWidgetVisualState,
  damp,
  easeInOutCubic,
  easeOutCubic,
  type WidgetVisualState
} from "./core/animation.js";
import { mixColors, withAlpha } from "./core/color.js";
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
import type { FluxUIWindowHandle, FluxUIWindowOptions } from "./core/window.js";
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

export interface FluxUIDebugState {
  readonly frameNumber: number;
  readonly frameActive: boolean;
  readonly deltaTime: number;
  readonly timeSeconds: number;
  readonly hotId: number;
  readonly activeId: number;
  readonly focusedId: number;
  readonly hoveredWindowId: number;
  readonly activeWindowId: number;
  readonly layoutDepth: number;
  readonly idDepth: number;
  readonly drawCommandCount: number;
  readonly windowCount: number;
  readonly visibleWindowCount: number;
  readonly widgetCount: number;
  readonly seenWidgetCount: number;
  readonly animatedWidgetCount: number;
}

interface NormalizedInput {
  mouseX: number;
  mouseY: number;
  mouseDown: boolean;
  mousePressed: boolean;
  mouseReleased: boolean;
  scrollX: number;
  scrollY: number;
  deltaTime: number;
  keysDown: ReadonlySet<string>;
  keysPressed: ReadonlySet<string>;
  keysReleased: ReadonlySet<string>;
  typedText: string;
}

interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  scrollY: number;
  contentHeight: number;
  zOrder: number;
  openAmount: number;
  lastSeenFrame: number;
}

interface WindowGeometry {
  rect: UIRect;
  titleRect: UIRect;
  bodyRect: UIRect;
  contentRect: UIRect;
  scrollbarRect?: UIRect;
  scrollbarThumbRect?: UIRect;
  animationT: number;
}

interface WindowFrame {
  readonly id: number;
  readonly title: string;
  readonly zOrder: number;
  readonly visible: boolean;
  readonly open: boolean;
  readonly hovered: boolean;
  readonly focused: boolean;
  readonly titleBar: boolean;
  readonly closable: boolean;
  readonly movable: boolean;
  readonly scrollable: boolean;
  readonly geometry: WindowGeometry;
  readonly scrollY: number;
  readonly commands: DrawCommand[];
  readonly closeRect?: UIRect;
  readonly closeBackgroundColor?: string;
  readonly closeColor?: string;
  readonly windowVisual: WidgetVisualState;
}

interface WindowContext {
  readonly frame: WindowFrame;
  readonly state: WindowState;
  readonly baseLayoutDepth: number;
  readonly baseIdDepth: number;
}

export class FluxUI {
  public readonly style: FluxUIStyle;

  private readonly drawCommands: DrawCommand[] = [];
  private readonly layoutStack: LayoutState[] = [];
  private readonly idStack: number[] = [0x811c9dc5];
  private readonly idOccurrences = new Map<number, number>();
  private readonly previousKeys = new Set<string>();
  private readonly seenWidgetIds = new Set<number>();
  private readonly seenWindowIds = new Set<number>();
  private readonly visualStates = new Map<number, WidgetVisualState>();
  private readonly windowStates = new Map<number, WindowState>();
  private readonly pendingWindows: WindowFrame[] = [];
  private readonly windowStack: WindowContext[] = [];
  private readonly origin: FluxUIPoint;

  private input: NormalizedInput = this.createEmptyInput();
  private lastRenderer?: UIRenderer;
  private activeId = 0;
  private hotId = 0;
  private focusedId = 0;
  private hoveredWindowId = 0;
  private activeWindowId = 0;
  private topWindowId = 0;
  private frameStarted = false;
  private frameNumber = 0;
  private deltaTime = 1 / 60;
  private timeSeconds = 0;
  private widgetCount = 0;
  private nextWindowZ = 1;
  private windowDragOffsetX = 0;
  private windowDragOffsetY = 0;

  constructor(options: FluxUIOptions = {}) {
    this.origin = options.origin ?? { x: 16, y: 16 };
    this.style = { ...defaultStyle, ...options.style };
  }

  beginFrame(input: UIInput): void {
    if (this.frameStarted) {
      throw new Error("FluxUI.beginFrame() called while a frame is already active. Did you forget endFrame()?");
    }

    this.frameStarted = true;
    this.frameNumber += 1;
    this.widgetCount = 0;
    this.drawCommands.length = 0;
    this.layoutStack.length = 0;
    this.idStack.length = 1;
    this.idStack[0] = 0x811c9dc5;
    this.idOccurrences.clear();
    this.seenWidgetIds.clear();
    this.seenWindowIds.clear();
    this.pendingWindows.length = 0;
    this.windowStack.length = 0;
    this.hotId = 0;
    this.input = this.normalizeInput(input);
    this.deltaTime = this.input.deltaTime;
    this.timeSeconds += this.deltaTime;
    this.hoveredWindowId = this.findHoveredWindowId(this.input.mouseX, this.input.mouseY);
    this.topWindowId = this.findTopWindowId();
    this.layoutStack.push(
      createLayout("vertical", this.origin.x, this.origin.y, this.style.itemSpacing, 0, false)
    );
  }

  endFrame(renderer: UIRenderer): void {
    this.assertFrameActive();

    try {
      this.assertBalancedFrame();

      this.emitCommands(renderer, this.drawCommands);

      const windows = [...this.pendingWindows].sort((a, b) => a.zOrder - b.zOrder);
      for (const window of windows) {
        this.emitWindow(renderer, window);
      }

      if (this.activeId !== 0 && (this.input.mouseReleased || !this.seenWidgetIds.has(this.activeId))) {
        this.activeId = 0;
      }

      if (this.activeWindowId !== 0 && (this.input.mouseReleased || !this.seenWindowIds.has(this.activeWindowId))) {
        this.activeWindowId = 0;
      }

      if (this.focusedId !== 0 && !this.seenWidgetIds.has(this.focusedId)) {
        this.focusedId = 0;
      }

      this.previousKeys.clear();
      for (const key of this.input.keysDown) {
        this.previousKeys.add(key);
      }

      this.pruneVisualStates();
    } finally {
      this.lastRenderer = renderer;
      this.frameStarted = false;
    }
  }

  getDebugState(): FluxUIDebugState {
    return {
      frameNumber: this.frameNumber,
      frameActive: this.frameStarted,
      deltaTime: this.deltaTime,
      timeSeconds: this.timeSeconds,
      hotId: this.hotId,
      activeId: this.activeId,
      focusedId: this.focusedId,
      hoveredWindowId: this.hoveredWindowId,
      activeWindowId: this.activeWindowId,
      layoutDepth: this.layoutStack.length,
      idDepth: this.idStack.length,
      drawCommandCount: this.drawCommands.length + this.pendingWindows.reduce((sum, window) => sum + window.commands.length, 0),
      windowCount: this.windowStates.size,
      visibleWindowCount: this.pendingWindows.length,
      widgetCount: this.widgetCount,
      seenWidgetCount: this.seenWidgetIds.size,
      animatedWidgetCount: this.visualStates.size
    };
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

  beginWindow(title: string, options: FluxUIWindowOptions = {}): FluxUIWindowHandle {
    this.assertFrameActive();
    this.recordWidgetCall();

    const { displayText, idText } = this.splitLabel(title);
    const windowSeed = String(options.id ?? idText);
    const windowId = this.makeStableId("window", windowSeed);

    if (this.seenWindowIds.has(windowId)) {
      throw new Error(
        `Duplicate window ID "${windowSeed}" in the same frame. Use a unique id option or pushId() scope.`
      );
    }

    this.seenWindowIds.add(windowId);

    const state = this.getOrCreateWindowState(windowId, options);
    state.lastSeenFrame = this.frameNumber;

    const requestedOpen = options.open ?? true;
    state.openAmount = damp(state.openAmount, requestedOpen ? 1 : 0, this.style.windowAnimationRate, this.deltaTime);

    const titleBar = options.titleBar ?? true;
    const closable = options.closable ?? false;
    const movable = options.movable ?? titleBar;
    const scrollable = options.scrollable ?? true;
    const padding = options.padding ?? this.style.windowPadding;

    let geometry = this.buildWindowGeometry(state, titleBar, padding, scrollable);
    const canCapturePointer = this.canCaptureWindow(windowId);
    let hovered = geometry.rect.height > 0 && containsPoint(geometry.rect, this.input.mouseX, this.input.mouseY) && canCapturePointer;

    if (hovered && this.input.mousePressed) {
      this.bringWindowToFront(windowId, state);
    }

    let closeRect: UIRect | undefined;
    let closeBackgroundColor: string | undefined;
    let closeColor: string | undefined;
    let nextOpen = requestedOpen;

    if (closable && titleBar && geometry.titleRect.height > 0) {
      const buttonSize = Math.max(16, geometry.titleRect.height - 10);
      closeRect = {
        x: geometry.titleRect.x + geometry.titleRect.width - buttonSize - 6,
        y: geometry.titleRect.y + Math.floor((geometry.titleRect.height - buttonSize) / 2),
        width: buttonSize,
        height: buttonSize
      };
      const closeId = this.makeSubId(windowId, "window-close");
      this.seenWidgetIds.add(closeId);
      const closeHovered = this.updateHotState(closeId, closeRect, windowId, geometry.rect);
      const closePressed = this.handlePress(closeId, closeHovered);
      const closeVisual = this.updateVisualState(closeId, closeHovered, this.activeId === closeId && this.input.mouseDown);
      const closePulse = this.samplePulse(closeVisual, closePressed);

      closeBackgroundColor = mixColors(
        mixColors(this.style.windowTitleColor, this.style.buttonColor, closeVisual.hover * 0.25),
        this.style.buttonActiveColor,
        closeVisual.active * 0.8
      );
      closeColor = mixColors(this.style.windowTitleTextColor, this.style.flashColor, closePulse * 0.45);

      if (closePressed) {
        nextOpen = false;
      }
    }

    const titleHovered =
      titleBar &&
      hovered &&
      containsPoint(geometry.titleRect, this.input.mouseX, this.input.mouseY) &&
      (closeRect === undefined || !containsPoint(closeRect, this.input.mouseX, this.input.mouseY));

    if (movable && titleHovered && this.input.mousePressed) {
      this.activeWindowId = windowId;
      this.windowDragOffsetX = this.input.mouseX - state.x;
      this.windowDragOffsetY = this.input.mouseY - state.y;
    }

    if (this.activeWindowId === windowId) {
      if (this.input.mouseDown) {
        state.x = this.input.mouseX - this.windowDragOffsetX;
        state.y = this.input.mouseY - this.windowDragOffsetY;
      } else if (this.input.mouseReleased) {
        this.activeWindowId = 0;
      }
    }

    const maxScroll = this.getMaxScroll(state, geometry.contentRect.height);
    const bodyHovered =
      hovered &&
      geometry.bodyRect.height > 0 &&
      containsPoint(geometry.bodyRect, this.input.mouseX, this.input.mouseY);

    if (scrollable && bodyHovered && this.input.scrollY !== 0 && maxScroll > 0) {
      state.scrollY = clamp(
        state.scrollY + this.input.scrollY * this.style.windowScrollStep,
        0,
        maxScroll
      );
    } else if (maxScroll <= 0) {
      state.scrollY = 0;
    }

    geometry = this.buildWindowGeometry(state, titleBar, padding, scrollable);
    hovered = geometry.rect.height > 0 && containsPoint(geometry.rect, this.input.mouseX, this.input.mouseY) && this.canCaptureWindow(windowId);
    const focused = this.topWindowId === windowId;
    const visible = geometry.contentRect.height > 0 && state.openAmount > 0.01;
    const windowVisual = this.updateVisualState(windowId, hovered, this.activeWindowId === windowId && this.input.mouseDown, focused);

    this.pushId(windowId);
    const baseLayoutDepth = this.layoutStack.length;
    const baseIdDepth = this.idStack.length;
    this.layoutStack.push(
      createLayout(
        "vertical",
        geometry.contentRect.x,
        geometry.contentRect.y - state.scrollY,
        this.style.itemSpacing,
        0,
        false
      )
    );

    const frame: WindowFrame = {
      id: windowId,
      title: displayText,
      zOrder: state.zOrder,
      visible,
      open: nextOpen,
      hovered,
      focused,
      titleBar,
      closable,
      movable,
      scrollable,
      geometry,
      scrollY: state.scrollY,
      commands: [],
      closeRect,
      closeBackgroundColor,
      closeColor,
      windowVisual
    };

    this.windowStack.push({
      frame,
      state,
      baseLayoutDepth,
      baseIdDepth
    });

    return {
      visible,
      open: nextOpen,
      hovered,
      focused,
      rect: geometry.rect,
      contentRect: geometry.contentRect,
      scrollY: state.scrollY
    };
  }

  endWindow(): void {
    this.assertFrameActive();
    const context = this.windowStack.pop();
    if (!context) {
      throw new Error("FluxUI.endWindow() called without a matching beginWindow().");
    }

    if (this.layoutStack.length !== context.baseLayoutDepth + 1) {
      throw new Error(
        "Unbalanced layout scopes inside window. Each beginVertical()/beginHorizontal() inside a window must be paired with endLayout() before endWindow()."
      );
    }

    if (this.idStack.length !== context.baseIdDepth) {
      throw new Error(
        "Unbalanced ID scopes inside window. Each pushId() inside a window must be paired with popId() before endWindow()."
      );
    }

    const layout = this.layoutStack.pop();
    if (!layout) {
      throw new Error("Missing window layout state.");
    }

    this.popId();

    const contentBounds = measureLayout(layout);
    context.state.contentHeight = Math.max(0, contentBounds.height);
    context.state.scrollY = clamp(
      context.state.scrollY,
      0,
      this.getMaxScroll(context.state, context.frame.geometry.contentRect.height)
    );
    this.pendingWindows.push(context.frame);
  }

  setCursor(x: number, y: number): void {
    this.assertFrameActive();
    const layout = this.currentLayout();
    layout.cursorX = x;
    layout.cursorY = y;
  }

  label(text: string): void {
    this.assertFrameActive();
    this.recordWidgetCall();
    const { displayText } = this.splitLabel(text);
    const rect = this.allocateRect(
      this.measureText(displayText),
      this.style.fontSize + this.style.verticalPadding * 2
    );

    this.queueText(rect.x, rect.y + this.style.verticalPadding, displayText, this.style.font, this.style.textColor);
  }

  button(label: string): boolean {
    this.assertFrameActive();
    this.recordWidgetCall();

    const { displayText, idText } = this.splitLabel(label);
    const id = this.nextWidgetId("button", idText);
    const rect = this.allocateRect(
      this.measureText(displayText) + this.style.horizontalPadding * 2,
      this.style.widgetHeight
    );
    const hovered = this.updateHotState(id, rect, this.currentWindowId(), this.currentInteractionClipRect());
    const pressed = this.handlePress(id, hovered);
    const active = this.activeId === id && this.input.mouseDown;
    const visual = this.updateVisualState(id, hovered, active);
    const pulse = this.samplePulse(visual, pressed);
    const pressOffset = Math.round(visual.active * 2);
    let background = mixColors(this.style.buttonColor, this.style.buttonHotColor, easeInOutCubic(visual.hover));
    background = mixColors(background, this.style.buttonActiveColor, easeOutCubic(visual.active));
    background = mixColors(background, this.style.flashColor, pulse * 0.35);
    const borderColor = mixColors(
      this.style.borderColor,
      this.style.accentColor,
      clamp01(Math.max(visual.hover * 0.65, pulse * 0.85))
    );

    this.queueRect(rect.x, rect.y + pressOffset, rect.width, rect.height, background);
    this.queueText(
      rect.x + this.style.horizontalPadding,
      rect.y + this.style.verticalPadding + pressOffset,
      displayText,
      this.style.font,
      mixColors(this.style.textColor, this.style.flashColor, pulse * 0.18)
    );
    this.queueRectOutline(
      {
        x: rect.x,
        y: rect.y + pressOffset,
        width: rect.width,
        height: rect.height
      },
      borderColor
    );

    return pressed;
  }

  checkbox(label: string, value: boolean): boolean {
    this.assertFrameActive();
    this.recordWidgetCall();

    const { displayText, idText } = this.splitLabel(label);
    const id = this.nextWidgetId("checkbox", idText);
    const rect = this.allocateRect(
      this.style.checkboxSize + this.style.horizontalPadding + this.measureText(displayText),
      Math.max(this.style.checkboxSize, this.style.widgetHeight)
    );
    const hovered = this.updateHotState(id, rect, this.currentWindowId(), this.currentInteractionClipRect());
    const nextValue = this.handlePress(id, hovered) ? !value : value;
    const visual = this.updateVisualState(id, hovered, this.activeId === id && this.input.mouseDown);
    const pulse = this.samplePulse(visual, nextValue !== value);
    const checkT = this.animateValue(visual, nextValue ? 1 : 0);
    const boxRect: UIRect = {
      x: rect.x,
      y: rect.y + Math.floor((rect.height - this.style.checkboxSize) / 2),
      width: this.style.checkboxSize,
      height: this.style.checkboxSize
    };

    this.queueRect(
      boxRect.x,
      boxRect.y,
      boxRect.width,
      boxRect.height,
      mixColors(this.style.panelColor, this.style.accentColor, checkT * 0.2 + visual.hover * 0.08)
    );
    this.queueRectOutline(
      boxRect,
      mixColors(this.style.borderColor, this.style.accentColor, clamp01(checkT * 0.7 + visual.hover * 0.6))
    );

    if (checkT > 0.001) {
      const markColor = mixColors(this.style.accentColor, this.style.flashColor, pulse * 0.45);
      const startX = boxRect.x + boxRect.width / 2;
      const startY = boxRect.y + boxRect.height / 2;
      this.queueLine(
        startX + (boxRect.x + 4 - startX) * checkT,
        startY + (boxRect.y + boxRect.height / 2 - startY) * checkT,
        startX + (boxRect.x + boxRect.width / 2 - startX) * checkT,
        startY + (boxRect.y + boxRect.height - 4 - startY) * checkT,
        2,
        withAlpha(markColor, checkT)
      );
      this.queueLine(
        startX + (boxRect.x + boxRect.width / 2 - startX) * checkT,
        startY + (boxRect.y + boxRect.height - 4 - startY) * checkT,
        startX + (boxRect.x + boxRect.width - 4 - startX) * checkT,
        startY + (boxRect.y + 4 - startY) * checkT,
        2,
        withAlpha(markColor, checkT)
      );
    }

    this.queueText(
      rect.x + this.style.checkboxSize + this.style.horizontalPadding,
      rect.y + this.style.verticalPadding,
      displayText,
      this.style.font,
      mixColors(this.style.textColor, this.style.accentColor, checkT * 0.2)
    );

    return nextValue;
  }

  sliderFloat(label: string, value: number, min: number, max: number): number {
    this.assertFrameActive();
    this.recordWidgetCall();

    const { displayText, idText } = this.splitLabel(label);
    const id = this.nextWidgetId("sliderFloat", idText);
    const rect = this.allocateRect(this.style.sliderWidth, this.style.widgetHeight);
    const hovered = this.updateHotState(id, rect, this.currentWindowId(), this.currentInteractionClipRect());
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
    const visual = this.updateVisualState(id, hovered, this.activeId === id && this.input.mouseDown);
    const displayedValue = this.animateValue(
      visual,
      normalized,
      this.activeId === id ? this.style.valueAnimationRate * 1.8 : this.style.valueAnimationRate
    );
    const pulse = this.samplePulse(visual, this.activeId === 0 && this.input.mouseReleased && hovered);
    const fillWidth = rect.width * displayedValue;
    const handleX = rect.x + fillWidth;
    const borderColor = mixColors(
      this.style.borderColor,
      this.style.accentColor,
      clamp01(visual.hover * 0.55 + visual.active * 0.7 + pulse * 0.45)
    );
    const fillColor = mixColors(this.style.accentColor, this.style.flashColor, pulse * 0.25);

    this.queueRect(rect.x, rect.y, rect.width, rect.height, this.style.panelColor);
    this.queueRect(rect.x, rect.y, fillWidth, rect.height, fillColor);
    this.queueRect(
      handleX - 2,
      rect.y - 1,
      4,
      rect.height + 2,
      mixColors(this.style.focusColor, this.style.flashColor, pulse * 0.25)
    );
    this.queueRectOutline(rect, borderColor);
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
    this.recordWidgetCall();

    const { displayText, idText } = this.splitLabel(label);
    const id = this.nextWidgetId("inputText", idText);
    const rect = this.allocateRect(this.style.inputWidth, this.style.widgetHeight);
    const hovered = this.updateHotState(id, rect, this.currentWindowId(), this.currentInteractionClipRect());
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

    const visual = this.updateVisualState(id, hovered, false, this.focusedId === id);
    const contentReveal = this.animateAux(visual, this.focusedId === id ? 1 : 0, this.style.hoverAnimationRate);
    const blink = easeInOutCubic(blinkWave(this.timeSeconds, this.style.caretBlinkRate));
    const caretAlpha = clamp01(contentReveal * blink);
    const panelColor = mixColors(
      this.style.panelColor,
      this.style.focusColor,
      clamp01(visual.focus * 0.85 + visual.hover * 0.12)
    );
    const borderColor = mixColors(
      this.style.borderColor,
      this.style.accentColor,
      clamp01(visual.focus * 0.75 + visual.hover * 0.45)
    );

    this.queueRect(rect.x, rect.y, rect.width, rect.height, panelColor);
    this.queueRectOutline(rect, borderColor);
    this.queueText(
      rect.x + this.style.horizontalPadding,
      rect.y + this.style.verticalPadding,
      `${displayText}: ${nextValue}`,
      this.style.font,
      this.style.textColor
    );

    if (this.focusedId === id && caretAlpha > 0.01) {
      const caretX =
        rect.x +
        this.style.horizontalPadding +
        this.measureText(`${displayText}: ${nextValue}`);
      const caretTop = rect.y + this.style.verticalPadding;
      const caretBottom = caretTop + this.style.fontSize;

      this.queueLine(
        caretX + 1,
        caretTop,
        caretX + 1,
        caretBottom,
        1.5,
        withAlpha(this.style.caretColor, caretAlpha)
      );
    }

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
      scrollX: 0,
      scrollY: 0,
      deltaTime: 1 / 60,
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
      scrollX: input.scrollX ?? 0,
      scrollY: input.scrollY ?? 0,
      deltaTime: this.normalizeDeltaTime(input.deltaTime),
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

  private assertBalancedFrame(): void {
    if (this.windowStack.length !== 0) {
      throw new Error("Unbalanced window scopes at endFrame(). Each beginWindow() must be paired with endWindow().");
    }

    if (this.layoutStack.length !== 1) {
      throw new Error(
        "Unbalanced layout scopes at endFrame(). Each beginVertical()/beginHorizontal() must be paired with endLayout()."
      );
    }

    if (this.idStack.length !== 1) {
      throw new Error(
        "Unbalanced ID scopes at endFrame(). Each pushId() must be paired with popId()."
      );
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

  private recordWidgetCall(): void {
    this.widgetCount += 1;
  }

  private normalizeDeltaTime(deltaTime: number | undefined): number {
    if (deltaTime === undefined || Number.isNaN(deltaTime) || !Number.isFinite(deltaTime)) {
      return 1 / 60;
    }

    return clamp(deltaTime, 0, 0.25);
  }

  private getVisualState(id: number): WidgetVisualState {
    let state = this.visualStates.get(id);

    if (!state) {
      state = createWidgetVisualState(this.frameNumber);
      this.visualStates.set(id, state);
    }

    state.lastSeenFrame = this.frameNumber;
    return state;
  }

  private updateVisualState(
    id: number,
    hovered: boolean,
    active: boolean,
    focused = false
  ): WidgetVisualState {
    const state = this.getVisualState(id);
    state.hover = damp(state.hover, hovered ? 1 : 0, this.style.hoverAnimationRate, this.deltaTime);
    state.active = damp(state.active, active ? 1 : 0, this.style.emphasisAnimationRate, this.deltaTime);
    state.focus = damp(state.focus, focused ? 1 : 0, this.style.emphasisAnimationRate, this.deltaTime);
    return state;
  }

  private animateValue(state: WidgetVisualState, target: number, rate = this.style.valueAnimationRate): number {
    state.value = damp(state.value, target, rate, this.deltaTime);
    return state.value;
  }

  private animateAux(state: WidgetVisualState, target: number, rate = this.style.valueAnimationRate): number {
    state.aux = damp(state.aux, target, rate, this.deltaTime);
    return state.aux;
  }

  private samplePulse(state: WidgetVisualState, trigger: boolean): number {
    if (trigger) {
      state.pulseStartTime = this.timeSeconds;
      state.pulseDuration = this.style.pulseDuration;
    }

    if (state.pulseDuration <= 0) {
      return 0;
    }

    const elapsed = this.timeSeconds - state.pulseStartTime;
    if (elapsed < 0 || elapsed > state.pulseDuration) {
      return 0;
    }

    return easeOutCubic(1 - elapsed / state.pulseDuration);
  }

  private pruneVisualStates(): void {
    const minFrame = this.frameNumber - this.style.animationRetentionFrames;

    for (const [id, state] of this.visualStates) {
      if (state.lastSeenFrame < minFrame) {
        this.visualStates.delete(id);
      }
    }
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

  private makeStableId(kind: string, seed: string): number {
    return this.hashCombine(
      this.hashCombine(this.idStack[this.idStack.length - 1], this.hashValue(kind)),
      this.hashValue(seed)
    );
  }

  private makeSubId(parentId: number, seed: string): number {
    return this.hashCombine(parentId, this.hashValue(seed));
  }

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

  private updateHotState(id: number, rect: UIRect, windowId = 0, clipRect?: UIRect): boolean {
    const hovered = this.canHoverRect(rect, windowId, clipRect);

    if (hovered) {
      this.hotId = id;
    }

    return hovered;
  }

  private canHoverRect(rect: UIRect, windowId: number, clipRect?: UIRect): boolean {
    if (!containsPoint(rect, this.input.mouseX, this.input.mouseY)) {
      return false;
    }

    if (clipRect && !containsPoint(clipRect, this.input.mouseX, this.input.mouseY)) {
      return false;
    }

    if (windowId === 0) {
      return this.hoveredWindowId === 0;
    }

    return this.hoveredWindowId === 0 || this.hoveredWindowId === windowId || this.activeWindowId === windowId;
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

  private currentWindowId(): number {
    const window = this.windowStack[this.windowStack.length - 1];
    return window?.frame.id ?? 0;
  }

  private currentInteractionClipRect(): UIRect | undefined {
    const window = this.windowStack[this.windowStack.length - 1];
    return window?.frame.geometry.contentRect;
  }

  private getOrCreateWindowState(id: number, options: FluxUIWindowOptions): WindowState {
    let state = this.windowStates.get(id);

    if (!state) {
      state = {
        x: options.x ?? this.origin.x + 24,
        y: options.y ?? this.origin.y + 24,
        width: Math.max(160, options.width ?? 320),
        height: Math.max(96, options.height ?? 220),
        scrollY: 0,
        contentHeight: 0,
        zOrder: this.nextWindowZ++,
        openAmount: options.open === false ? 0 : 1,
        lastSeenFrame: this.frameNumber
      };
      this.windowStates.set(id, state);
    }

    if (options.width !== undefined) {
      state.width = Math.max(160, options.width);
    }

    if (options.height !== undefined) {
      state.height = Math.max(96, options.height);
    }

    return state;
  }

  private buildWindowGeometry(
    state: WindowState,
    titleBar: boolean,
    padding: number,
    scrollable: boolean
  ): WindowGeometry {
    const animationT = easeOutCubic(state.openAmount);
    const height = Math.round(state.height * animationT);
    const titleHeight = titleBar ? Math.min(this.style.windowTitleHeight, height) : 0;
    const rect: UIRect = {
      x: state.x,
      y: state.y,
      width: state.width,
      height
    };
    const bodyRect: UIRect = {
      x: rect.x,
      y: rect.y + titleHeight,
      width: rect.width,
      height: Math.max(0, rect.height - titleHeight)
    };
    const visibleBodyHeight = Math.max(0, bodyRect.height - padding * 2);
    const reserveScrollbar = scrollable && state.contentHeight > visibleBodyHeight && visibleBodyHeight > 0;
    const scrollbarWidth = reserveScrollbar ? this.style.windowScrollbarWidth : 0;
    const contentRect: UIRect = {
      x: bodyRect.x + padding,
      y: bodyRect.y + padding,
      width: Math.max(0, bodyRect.width - padding * 2 - scrollbarWidth - (reserveScrollbar ? 4 : 0)),
      height: visibleBodyHeight
    };
    const titleRect: UIRect = {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: titleHeight
    };

    if (!reserveScrollbar || contentRect.height <= 0) {
      return {
        rect,
        titleRect,
        bodyRect,
        contentRect,
        animationT
      };
    }

    const maxScroll = this.getMaxScroll(state, contentRect.height);
    const thumbHeight = Math.max(
      24,
      contentRect.height * (contentRect.height / Math.max(contentRect.height, state.contentHeight))
    );
    const thumbTravel = Math.max(0, contentRect.height - thumbHeight);
    const thumbOffset = maxScroll <= 0 ? 0 : (state.scrollY / maxScroll) * thumbTravel;
    const scrollbarRect: UIRect = {
      x: bodyRect.x + bodyRect.width - padding - this.style.windowScrollbarWidth,
      y: contentRect.y,
      width: this.style.windowScrollbarWidth,
      height: contentRect.height
    };
    const scrollbarThumbRect: UIRect = {
      x: scrollbarRect.x,
      y: scrollbarRect.y + thumbOffset,
      width: scrollbarRect.width,
      height: thumbHeight
    };

    return {
      rect,
      titleRect,
      bodyRect,
      contentRect,
      scrollbarRect,
      scrollbarThumbRect,
      animationT
    };
  }

  private getMaxScroll(state: WindowState, viewportHeight: number): number {
    return Math.max(0, state.contentHeight - viewportHeight);
  }

  private canCaptureWindow(windowId: number): boolean {
    return this.hoveredWindowId === 0 || this.hoveredWindowId === windowId || this.activeWindowId === windowId;
  }

  private bringWindowToFront(windowId: number, state: WindowState): void {
    if (this.topWindowId !== windowId) {
      state.zOrder = this.nextWindowZ++;
    }

    this.topWindowId = windowId;
  }

  private findTopWindowId(): number {
    let topId = 0;
    let topZ = -1;

    for (const [id, state] of this.windowStates) {
      if (state.openAmount <= 0.01) {
        continue;
      }

      if (state.zOrder > topZ) {
        topId = id;
        topZ = state.zOrder;
      }
    }

    return topId;
  }

  private findHoveredWindowId(x: number, y: number): number {
    let topId = 0;
    let topZ = -1;

    for (const [id, state] of this.windowStates) {
      if (state.openAmount <= 0.01) {
        continue;
      }

      const rect = this.buildWindowGeometry(state, true, this.style.windowPadding, true).rect;
      if (!containsPoint(rect, x, y)) {
        continue;
      }

      if (state.zOrder > topZ) {
        topId = id;
        topZ = state.zOrder;
      }
    }

    return topId;
  }

  private emitCommands(renderer: UIRenderer, commands: readonly DrawCommand[]): void {
    for (const command of commands) {
      if (command.kind === "rect") {
        renderer.drawRect(command.x, command.y, command.width, command.height, command.color);
      } else if (command.kind === "text") {
        renderer.drawText(command.x, command.y, command.text, command.font, command.color);
      } else if (command.kind === "line") {
        renderer.drawLine(
          command.x1,
          command.y1,
          command.x2,
          command.y2,
          command.thickness,
          command.color
        );
      } else if (command.kind === "clipPush") {
        renderer.pushClipRect?.(command.x, command.y, command.width, command.height);
      } else {
        renderer.popClipRect?.();
      }
    }
  }

  private emitWindow(renderer: UIRenderer, window: WindowFrame): void {
    const { geometry } = window;
    if (geometry.rect.height <= 0 || geometry.rect.width <= 0) {
      return;
    }

    const shadowAlpha = geometry.animationT * 0.75;
    if (this.style.windowShadowSize > 0 && shadowAlpha > 0.01) {
      renderer.drawRect(
        geometry.rect.x - this.style.windowShadowSize,
        geometry.rect.y + Math.floor(this.style.windowShadowSize * 0.5),
        geometry.rect.width + this.style.windowShadowSize * 2,
        geometry.rect.height + this.style.windowShadowSize,
        withAlpha(this.style.windowShadowColor, shadowAlpha * 0.28)
      );
    }

    const focusT = clamp01(window.windowVisual.focus * 0.6 + window.windowVisual.hover * 0.25);
    const frameColor = mixColors(this.style.windowColor, this.style.focusColor, focusT * 0.2);
    renderer.drawRect(geometry.rect.x, geometry.rect.y, geometry.rect.width, geometry.rect.height, frameColor);

    if (window.titleBar && geometry.titleRect.height > 0) {
      const titleColor = mixColors(
        this.style.windowTitleColor,
        this.style.windowTitleHotColor,
        clamp01(window.windowVisual.focus * 0.8 + window.windowVisual.hover * 0.45)
      );
      renderer.drawRect(
        geometry.titleRect.x,
        geometry.titleRect.y,
        geometry.titleRect.width,
        geometry.titleRect.height,
        titleColor
      );
      renderer.drawText(
        geometry.titleRect.x + 10,
        geometry.titleRect.y + Math.max(4, Math.floor((geometry.titleRect.height - this.style.fontSize) / 2)),
        window.title,
        this.style.font,
        withAlpha(this.style.windowTitleTextColor, clamp01(0.4 + geometry.animationT * 0.6))
      );
    }

    this.emitRectOutline(
      renderer,
      geometry.rect,
      mixColors(this.style.borderColor, this.style.accentColor, clamp01(window.windowVisual.focus * 0.5))
    );

    if (window.closeRect && window.closeBackgroundColor && window.closeColor) {
      renderer.drawRect(
        window.closeRect.x,
        window.closeRect.y,
        window.closeRect.width,
        window.closeRect.height,
        window.closeBackgroundColor
      );
      renderer.drawLine(
        window.closeRect.x + 4,
        window.closeRect.y + 4,
        window.closeRect.x + window.closeRect.width - 4,
        window.closeRect.y + window.closeRect.height - 4,
        1.5,
        window.closeColor
      );
      renderer.drawLine(
        window.closeRect.x + window.closeRect.width - 4,
        window.closeRect.y + 4,
        window.closeRect.x + 4,
        window.closeRect.y + window.closeRect.height - 4,
        1.5,
        window.closeColor
      );
    }

    if (geometry.contentRect.width > 0 && geometry.contentRect.height > 0) {
      renderer.pushClipRect?.(
        geometry.contentRect.x,
        geometry.contentRect.y,
        geometry.contentRect.width,
        geometry.contentRect.height
      );
      this.emitCommands(renderer, window.commands);
      renderer.popClipRect?.();
    }

    if (window.scrollable && geometry.scrollbarRect && geometry.scrollbarThumbRect) {
      renderer.drawRect(
        geometry.scrollbarRect.x,
        geometry.scrollbarRect.y,
        geometry.scrollbarRect.width,
        geometry.scrollbarRect.height,
        withAlpha(this.style.borderColor, 0.2)
      );
      renderer.drawRect(
        geometry.scrollbarThumbRect.x,
        geometry.scrollbarThumbRect.y,
        geometry.scrollbarThumbRect.width,
        geometry.scrollbarThumbRect.height,
        this.style.windowScrollbarColor
      );
    }
  }

  private emitRectOutline(renderer: UIRenderer, rect: UIRect, color: string): void {
    const right = rect.x + rect.width;
    const bottom = rect.y + rect.height;
    renderer.drawLine(rect.x, rect.y, right, rect.y, 1, color);
    renderer.drawLine(right, rect.y, right, bottom, 1, color);
    renderer.drawLine(right, bottom, rect.x, bottom, 1, color);
    renderer.drawLine(rect.x, bottom, rect.x, rect.y, 1, color);
  }

  private measureText(text: string): number {
    if (this.lastRenderer?.measureText) {
      return this.lastRenderer.measureText(text, this.style.font);
    }

    return Math.ceil(text.length * this.style.fontSize * 0.6);
  }

  private currentCommandTarget(): DrawCommand[] {
    const window = this.windowStack[this.windowStack.length - 1];
    return window?.frame.commands ?? this.drawCommands;
  }

  private queueRect(x: number, y: number, width: number, height: number, color: string): void {
    this.currentCommandTarget().push({ kind: "rect", x, y, width, height, color });
  }

  private queueText(x: number, y: number, text: string, font: string, color: string): void {
    this.currentCommandTarget().push({ kind: "text", x, y, text, font, color });
  }

  private queueLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    thickness: number,
    color: string
  ): void {
    this.currentCommandTarget().push({ kind: "line", x1, y1, x2, y2, thickness, color });
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
