/**
 * A queued rectangle draw operation.
 */
export interface RectDrawCommand {
  readonly kind: "rect";
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly color: string;
}

/**
 * A queued text draw operation.
 */
export interface TextDrawCommand {
  readonly kind: "text";
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly font: string;
  readonly color: string;
}

/**
 * A queued line draw operation.
 */
export interface LineDrawCommand {
  readonly kind: "line";
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly thickness: number;
  readonly color: string;
}

/**
 * Pushes a rectangular clip region.
 */
export interface ClipPushDrawCommand {
  readonly kind: "clipPush";
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Pops the current clip region.
 */
export interface ClipPopDrawCommand {
  readonly kind: "clipPop";
}

/**
 * A renderer command recorded during a single frame.
 */
export type DrawCommand =
  | RectDrawCommand
  | TextDrawCommand
  | LineDrawCommand
  | ClipPushDrawCommand
  | ClipPopDrawCommand;
