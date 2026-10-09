import sheet from './sheet.json';
export const superJumpAppearance = {
  ...sheet,
  anticipationFrames: [0, 1, 2],
  launchFrames: [3, 4, 5, 6, 7],
  handoffAt: 0.7,
  sophieFeetOffset: 28,
  belowFeet: sheet.frameHeight - sheet.anchorY,
} as const;
export interface SuperJumpPose {
  phase: 'anticipation' | 'launch';
  progress: number;
  x: number;
  y: number;
}
export function superJumpFrame(pose: SuperJumpPose) {
  const frames =
    pose.phase === 'anticipation'
      ? superJumpAppearance.anticipationFrames
      : superJumpAppearance.launchFrames;
  return frames[
    Math.min(
      frames.length - 1,
      Math.floor(Math.max(0, pose.progress) * frames.length),
    )
  ]!;
}
/** Include the sheet's trailing motion pixels when aligning exit with the SFX peak. */
export function superJumpY(
  ground: number,
  top: number,
  progress: number,
  scale = 1,
) {
  return (
    ground -
    (ground - top + superJumpAppearance.belowFeet * scale + 1) * progress ** 2
  );
}
