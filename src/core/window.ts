import type { UIRect } from "./geometry.js";

/**
 * Options used when building a floating FluxUI window.
 */
export interface FluxUIWindowOptions {
  /**
   * Optional hidden identifier. Defaults to the parsed window title label.
   */
  readonly id?: string | number;
  /**
   * Initial x coordinate for the window.
   */
  readonly x?: number;
  /**
   * Initial y coordinate for the window.
   */
  readonly y?: number;
  /**
   * Window width. When omitted, the existing width is kept after the first frame.
   */
  readonly width?: number;
  /**
   * Window height. When omitted, the existing height is kept after the first frame.
   */
  readonly height?: number;
  /**
   * Target open state. Keep calling beginWindow/endWindow while visible is true
   * if you want the close animation to finish.
   */
  readonly open?: boolean;
  /**
   * Enables dragging from the title bar.
   */
  readonly movable?: boolean;
  /**
   * Enables mouse wheel scrolling inside the content region.
   */
  readonly scrollable?: boolean;
  /**
   * Draws a close button in the title bar.
   */
  readonly closable?: boolean;
  /**
   * Enables resizing from the bottom-right corner.
   */
  readonly resizable?: boolean;
  /**
   * Hides the title bar while keeping the window body and clipping behavior.
   */
  readonly titleBar?: boolean;
  /**
   * Overrides the default window padding.
   */
  readonly padding?: number;
}

/**
 * Window state returned from beginWindow().
 */
export interface FluxUIWindowHandle {
  /**
   * True while the content region should be populated this frame.
   */
  readonly visible: boolean;
  /**
   * The next open value after processing close-button interaction.
   */
  readonly open: boolean;
  /**
   * True when the pointer is over the window.
   */
  readonly hovered: boolean;
  /**
   * True when the window is frontmost.
   */
  readonly focused: boolean;
  /**
   * Screen-space bounds of the animated window frame.
   */
  readonly rect: UIRect;
  /**
   * Screen-space viewport used for clipped window contents.
   */
  readonly contentRect: UIRect;
  /**
   * Current vertical scroll offset.
   */
  readonly scrollY: number;
}
