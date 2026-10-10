/** An orthogonal, temporary ability. The owner controls its lifetime; no scene,
 * sprite, input, collision, or Jimmy state is stored here. */
export const pizzaPowerConfig = { speedMultiplier: 3 } as const;

export class PizzaPower {
  active = false;
  get speedMultiplier() {
    return this.active ? pizzaPowerConfig.speedMultiplier : 1;
  }
  activate() {
    if (this.active) return false;
    this.active = true;
    return true;
  }
  reset() {
    this.active = false;
  }
}
