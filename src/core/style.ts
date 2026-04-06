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
  widgetHeight: 28,
  horizontalPadding: 10,
  verticalPadding: 6,
  itemSpacing: 8,
  checkboxSize: 18,
  sliderWidth: 220,
  inputWidth: 240
};
