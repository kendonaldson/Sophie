export type GameplayMode = 'desktop' | 'mobile-landscape' | 'mobile-portrait';
export interface DeviceCapabilities {
  width: number;
  height: number;
  maxTouchPoints: number;
  coarsePointer: boolean;
  userAgent: string;
  platform: string;
  mobileHint: boolean;
}
/** Touch alone must never turn a desktop or convertible laptop into a phone. */
export function gameplayMode(device: DeviceCapabilities): GameplayMode {
  const mobileAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(device.userAgent);
  // iPadOS Safari can advertise a desktop Macintosh user agent.
  const desktopIPad =
    /MacIntel|Macintosh/.test(device.platform + ' ' + device.userAgent) &&
    device.maxTouchPoints > 1 &&
    device.coarsePointer;
  const mobile =
    device.maxTouchPoints > 0 &&
    Math.min(device.width, device.height) <= 1100 &&
    (device.mobileHint || mobileAgent || desktopIPad);
  return mobile
    ? device.width > device.height
      ? 'mobile-landscape'
      : 'mobile-portrait'
    : 'desktop';
}
export function readGameplayMode(): GameplayMode {
  const agent = navigator as Navigator & {
    userAgentData?: { mobile: boolean };
  };
  return gameplayMode({
    width: window.innerWidth,
    height: window.innerHeight,
    maxTouchPoints: navigator.maxTouchPoints,
    coarsePointer: matchMedia('(pointer: coarse)').matches,
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    mobileHint: agent.userAgentData?.mobile ?? false,
  });
}
