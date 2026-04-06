/**
 * Input snapshot provided to FluxUI each frame.
 */
export interface UIInput {
  /**
   * Mouse cursor x coordinate in UI space.
   */
  readonly mouseX: number;
  /**
   * Mouse cursor y coordinate in UI space.
   */
  readonly mouseY: number;
  /**
   * True while the primary mouse button is held.
   */
  readonly mouseDown: boolean;
  /**
   * Keys that are currently held this frame.
   */
  readonly keysDown?: readonly string[];
  /**
   * Keys that transitioned to the pressed state this frame.
   */
  readonly keysPressed?: readonly string[];
  /**
   * Keys that transitioned to the released state this frame.
   */
  readonly keysReleased?: readonly string[];
  /**
   * Text typed during this frame, already processed by the host platform.
   */
  readonly typedText?: string;
}
