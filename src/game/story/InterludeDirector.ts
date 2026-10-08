import { interlude1 as c, interludeLines } from './interlude1';
export type StoryPhase =
  'opening' | 'dialogue' | 'pause' | 'escape' | 'clear' | 'fade' | 'complete';
export type StoryPose = 'idle' | 'sit' | 'walk' | 'run';
/** One scene's choreography, driven by simulation time; it owns no Phaser or DOM objects. */
export class InterludeDirector {
  phase: StoryPhase = 'opening';
  index = -1;
  private time = 0;
  private phaseAt = 0;
  private lookingAtTown = false;
  private alerted = false;
  private walkAt?: number;
  private escapeFrom = 0;
  get line() {
    return interludeLines[this.index];
  }
  get canAdvance() {
    return (
      this.phase === 'dialogue' &&
      this.time + 1e-6 >= this.phaseAt + c.minimumLineMs
    );
  }
  get running() {
    return (
      this.phase === 'escape' && this.time - this.phaseAt >= c.escapeReactionMs
    );
  }
  get fade() {
    if (this.phase === 'opening')
      return 1 - Math.min(1, this.time / c.fadeInMs);
    if (this.phase === 'fade')
      return Math.min(1, (this.time - this.phaseAt) / c.fadeOutMs);
    return this.phase === 'complete' ? 1 : 0;
  }
  private get walkOffset() {
    return this.walkAt === undefined
      ? 0
      : Math.min(
          c.walkDistance,
          ((this.time - this.walkAt) * c.walkSpeed) / 1000,
        );
  }
  get actors() {
    const escaping = ['escape', 'clear', 'fade', 'complete'].includes(
      this.phase,
    );
    let offset = escaping ? this.escapeFrom : this.walkOffset;
    if (escaping) {
      const t = Math.max(
        0,
        (this.time - this.phaseAt - c.escapeReactionMs) / 1000,
      );
      // Stop changing positions once both dogs have cleared the frame.
      const runTime = this.phase === 'escape' ? t : this.escapeDuration;
      const ramp = (c.escapeSpeed - c.escapeStartSpeed) / c.escapeAcceleration;
      const accelTime = Math.min(runTime, ramp);
      offset +=
        c.escapeStartSpeed * accelTime +
        (c.escapeAcceleration * accelTime ** 2) / 2 +
        c.escapeSpeed * Math.max(0, runTime - ramp);
    }
    const walking =
      !escaping &&
      this.walkAt !== undefined &&
      this.walkOffset < c.walkDistance;
    const pose: StoryPose = this.running ? 'run' : walking ? 'walk' : 'idle';
    return {
      sophie: {
        x: c.sophieX + offset,
        y: c.feetY,
        pose,
        flipX: !this.alerted && this.lookingAtTown,
      },
      jimmy: {
        x: c.jimmyX + offset,
        y: c.feetY,
        pose: (this.alerted ? pose : 'sit') as StoryPose,
        flipX: !this.alerted,
      },
    };
  }
  private get escapeDuration() {
    const distance = c.width + c.exitMargin - c.sophieX - this.escapeFrom;
    const ramp = (c.escapeSpeed - c.escapeStartSpeed) / c.escapeAcceleration;
    const rampDistance = ((c.escapeSpeed + c.escapeStartSpeed) * ramp) / 2;
    return ramp + (distance - rampDistance) / c.escapeSpeed;
  }
  advance() {
    if (!this.canAdvance) return;
    const next = interludeLines[this.index + 1];
    if (!next) return;
    this.phaseAt = this.time;
    if (next.pauseBeforeMs) this.phase = 'pause';
    else this.enter(this.index + 1, this.time);
  }
  tick(ms: number) {
    this.time += Math.max(0, ms);
    // A long test tick crosses timed boundaries at their exact timestamps.
    for (let transitions = 0; transitions < 5; transitions++) {
      let duration: number;
      if (this.phase === 'opening') duration = c.fadeInMs;
      else if (this.phase === 'pause')
        duration = interludeLines[this.index + 1]!.pauseBeforeMs!;
      else if (this.phase === 'escape')
        duration = c.escapeReactionMs + this.escapeDuration * 1000;
      else if (this.phase === 'clear') duration = c.clearFrameMs;
      else if (this.phase === 'fade') duration = c.fadeOutMs;
      else break;
      if (this.time < this.phaseAt + duration) break;
      const at = this.phaseAt + duration;
      if (this.phase === 'opening' || this.phase === 'pause')
        this.enter(this.index + 1, at);
      else {
        this.phase =
          this.phase === 'escape'
            ? 'clear'
            : this.phase === 'clear'
              ? 'fade'
              : 'complete';
        this.phaseAt = at;
      }
    }
  }
  private enter(index: number, at: number) {
    this.index = index;
    this.phaseAt = at;
    this.phase = 'dialogue';
    switch (this.line?.cue) {
      case 'town':
        this.lookingAtTown = true;
        break;
      case 'together':
        this.lookingAtTown = false;
        break;
      case 'alert':
        this.alerted = true;
        break;
      case 'walk':
        this.walkAt = at;
        break;
      case 'escape':
        this.escapeFrom = this.walkOffset;
        this.phase = 'escape';
        break;
    }
  }
}
