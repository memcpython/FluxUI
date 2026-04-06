/**
 * Style settings used by FluxUI widgets and layout.
 */
export interface FluxUIStyle {
  /**
   * Font used for all text rendering.
   */
  readonly font: string;
  /**
   * Approximate font size used for layout calculations.
   */
  readonly fontSize: number;
  /**
   * Default text color.
   */
  readonly textColor: string;
  /**
   * Button background at rest.
   */
  readonly buttonColor: string;
  /**
   * Button background when hovered.
   */
  readonly buttonHotColor: string;
  /**
   * Button background when pressed.
   */
  readonly buttonActiveColor: string;
  /**
   * Generic panel or field background.
   */
  readonly panelColor: string;
  /**
   * Background for focused text inputs.
   */
  readonly focusColor: string;
  /**
   * Border or outline color.
   */
  readonly borderColor: string;
  /**
   * Accent color for toggles and sliders.
   */
  readonly accentColor: string;
  /**
   * Accent used for short-lived flashes and confirmation pulses.
   */
  readonly flashColor: string;
  /**
   * Color used for the text caret in focused inputs.
   */
  readonly caretColor: string;
  /**
   * Widget height used for controls such as buttons.
   */
  readonly widgetHeight: number;
  /**
   * Horizontal padding applied inside controls.
   */
  readonly horizontalPadding: number;
  /**
   * Vertical padding applied inside controls.
   */
  readonly verticalPadding: number;
  /**
   * Default spacing between widgets in a layout.
   */
  readonly itemSpacing: number;
  /**
   * Default checkbox square size.
   */
  readonly checkboxSize: number;
  /**
   * Default slider width.
   */
  readonly sliderWidth: number;
  /**
   * Default text input width.
   */
  readonly inputWidth: number;
  /**
   * General interpolation rate used by hover transitions.
   */
  readonly hoverAnimationRate: number;
  /**
   * Interpolation rate used by press and focus transitions.
   */
  readonly emphasisAnimationRate: number;
  /**
   * Interpolation rate used by value animations such as sliders and toggles.
   */
  readonly valueAnimationRate: number;
  /**
   * Duration in seconds for short pulse animations.
   */
  readonly pulseDuration: number;
  /**
   * Caret blink frequency in cycles per second.
   */
  readonly caretBlinkRate: number;
  /**
   * Number of frames to keep animation state for widgets that disappeared.
   */
  readonly animationRetentionFrames: number;
  /**
   * Background fill used for floating windows and panels.
   */
  readonly windowColor: string;
  /**
   * Title bar fill used by windows.
   */
  readonly windowTitleColor: string;
  /**
   * Title bar fill when the window is frontmost or hovered.
   */
  readonly windowTitleHotColor: string;
  /**
   * Color used for window titles.
   */
  readonly windowTitleTextColor: string;
  /**
   * Shadow color drawn behind floating windows.
   */
  readonly windowShadowColor: string;
  /**
   * Color used for window scrollbars.
   */
  readonly windowScrollbarColor: string;
  /**
   * Title bar height for floating windows.
   */
  readonly windowTitleHeight: number;
  /**
   * Padding applied inside the window content region.
   */
  readonly windowPadding: number;
  /**
   * Width of the window scrollbar gutter.
   */
  readonly windowScrollbarWidth: number;
  /**
   * Shadow spread around windows.
   */
  readonly windowShadowSize: number;
  /**
   * Scroll distance applied per wheel step.
   */
  readonly windowScrollStep: number;
  /**
   * Interpolation rate used for window open and close transitions.
   */
  readonly windowAnimationRate: number;
}

/**
 * The default visual style used by FluxUI.
 */
export const defaultStyle: FluxUIStyle = {
  font: "14px sans-serif",
  fontSize: 14,
  textColor: "#f5f7fb",
  buttonColor: "#2b3440",
  buttonHotColor: "#3a4656",
  buttonActiveColor: "#4b5a6f",
  panelColor: "#1d2530",
  focusColor: "#2f4d76",
  borderColor: "#7f8da3",
  accentColor: "#4ec9b0",
  flashColor: "#f0c674",
  caretColor: "#ffffff",
  widgetHeight: 28,
  horizontalPadding: 10,
  verticalPadding: 6,
  itemSpacing: 8,
  checkboxSize: 18,
  sliderWidth: 220,
  inputWidth: 240,
  hoverAnimationRate: 10,
  emphasisAnimationRate: 16,
  valueAnimationRate: 12,
  pulseDuration: 0.18,
  caretBlinkRate: 1.6,
  animationRetentionFrames: 24,
  windowColor: "#161d27",
  windowTitleColor: "#233040",
  windowTitleHotColor: "#304155",
  windowTitleTextColor: "#f8fbff",
  windowShadowColor: "rgba(3, 8, 16, 0.32)",
  windowScrollbarColor: "#506579",
  windowTitleHeight: 30,
  windowPadding: 12,
  windowScrollbarWidth: 10,
  windowShadowSize: 10,
  windowScrollStep: 32,
  windowAnimationRate: 10
};
