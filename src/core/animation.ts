export interface WidgetVisualState {
  hover: number;
  active: number;
  focus: number;
  value: number;
  aux: number;
  pulseStartTime: number;
  pulseDuration: number;
  lastSeenFrame: number;
}

export function createWidgetVisualState(frameNumber: number): WidgetVisualState {
  return {
    hover: 0,
    active: 0,
    focus: 0,
    value: 0,
    aux: 0,
    pulseStartTime: Number.NEGATIVE_INFINITY,
    pulseDuration: 0,
    lastSeenFrame: frameNumber
  };
}

export function clamp01(value: number): number {
  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
}

export function damp(current: number, target: number, rate: number, deltaTime: number): number {
  if (deltaTime <= 0) {
    return current;
  }

  const factor = 1 - Math.exp(-rate * deltaTime);
  return current + (target - current) * factor;
}

export function easeOutCubic(value: number): number {
  const t = clamp01(value);
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOutCubic(value: number): number {
  const t = clamp01(value);
  if (t < 0.5) {
    return 4 * t * t * t;
  }

  return 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function blinkWave(timeSeconds: number, frequency: number): number {
  return 0.5 + 0.5 * Math.sin(timeSeconds * Math.PI * 2 * frequency);
}
