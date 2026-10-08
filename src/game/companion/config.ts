import { physics } from '../config/physics';
export const companionConfig = {
  followDelayMs: 300,
  maxSeparation: 460,
  stuckMs: 1600,
  recoveryFadeMs: 240,
  physics: {
    ...physics,
    coyoteTimeMs: 180,
    jumpBufferMs: 160,
    cornerCorrectionPixels: 8,
    edgeForgivenessPixels: 8,
  },
} as const;
/** Prepared atlas contract; replace the asset here without changing follower behavior. */
export const jimmyAppearance = {
  key: 'jimmy',
  asset: 'assets/jimmy.png',
  frameWidth: 64,
  frameHeight: 64,
} as const;
