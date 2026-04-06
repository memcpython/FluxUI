import type { UIRect } from "./geometry.js";

/**
 * The orientation used for flow layouts.
 */
export type LayoutDirection = "vertical" | "horizontal";

/**
 * Public options for creating a new layout scope.
 */
export interface LayoutOptions {
  /**
   * Optional identifier for user-managed layout scoping.
   */
  readonly id?: string | number;
  /**
   * Optional absolute x coordinate for the layout origin.
   */
  readonly x?: number;
  /**
   * Optional absolute y coordinate for the layout origin.
   */
  readonly y?: number;
  /**
   * Space inserted between sibling items.
   */
  readonly spacing?: number;
  /**
   * Inner padding applied on all sides of the layout container.
   */
  readonly padding?: number;
}

/**
 * Internal mutable layout frame.
 */
export interface LayoutState {
  direction: LayoutDirection;
  originX: number;
  originY: number;
  cursorX: number;
  cursorY: number;
  spacing: number;
  padding: number;
  contentWidth: number;
  contentHeight: number;
  ownsIdScope: boolean;
}

/**
 * Creates a new layout state anchored at the supplied position.
 */
export function createLayout(
  direction: LayoutDirection,
  x: number,
  y: number,
  spacing: number,
  padding: number,
  ownsIdScope: boolean
): LayoutState {
  const startX = x + padding;
  const startY = y + padding;

  return {
    direction,
    originX: x,
    originY: y,
    cursorX: startX,
    cursorY: startY,
    spacing,
    padding,
    contentWidth: 0,
    contentHeight: 0,
    ownsIdScope
  };
}

/**
 * Registers an item within the layout and advances the flow cursor.
 */
export function placeLayoutItem(
  layout: LayoutState,
  width: number,
  height: number
): UIRect {
  const rect: UIRect = {
    x: layout.cursorX,
    y: layout.cursorY,
    width,
    height
  };

  const relativeRight = rect.x - (layout.originX + layout.padding) + width;
  const relativeBottom = rect.y - (layout.originY + layout.padding) + height;

  layout.contentWidth = Math.max(layout.contentWidth, relativeRight);
  layout.contentHeight = Math.max(layout.contentHeight, relativeBottom);

  if (layout.direction === "vertical") {
    layout.cursorY += height + layout.spacing;
  } else {
    layout.cursorX += width + layout.spacing;
  }

  return rect;
}

/**
 * Computes the total size of a layout, including padding.
 */
export function measureLayout(layout: LayoutState): UIRect {
  return {
    x: layout.originX,
    y: layout.originY,
    width: layout.contentWidth + layout.padding * 2,
    height: layout.contentHeight + layout.padding * 2
  };
}
