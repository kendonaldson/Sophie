import type Phaser from 'phaser';
interface Particle {
  object: Phaser.GameObjects.Rectangle;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}
interface Ghost {
  object: Phaser.GameObjects.Image;
  life: number;
}
export class Effects {
  private particles: Particle[] = [];
  private ghosts: Ghost[] = [];
  private trailMs = 0;
  constructor(private readonly scene: Phaser.Scene) {}
  dust(x: number, y: number, color = 0xe7d8b6, count = 6) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      this.particles.push({
        object: this.scene.add
          .rectangle(Math.round(x), Math.round(y), 2 + (i % 2), 2, color)
          .setDepth(12),
        vx: Math.cos(angle) * 35,
        vy: Math.sin(angle) * 35 - 22,
        life: 330,
        maxLife: 330,
      });
    }
  }
  update(ms: number, sprite: Phaser.GameObjects.Sprite, dashing: boolean) {
    this.trailMs += ms;
    if (dashing && this.trailMs >= 24) {
      this.trailMs = 0;
      this.ghosts.push({
        object: this.scene.add
          .image(
            Math.round(sprite.x),
            Math.round(sprite.y),
            sprite.texture.key,
            sprite.frame.name,
          )
          .setFlipX(sprite.flipX)
          .setTint(0xccebc4)
          .setAlpha(0.4)
          .setDepth(9),
        life: 130,
      });
      this.dust(sprite.x, sprite.y + 12, 0xe7dca9, 1);
    }
    for (const p of this.particles) {
      p.life -= ms;
      p.object.x += (p.vx * ms) / 1000;
      p.object.y += (p.vy * ms) / 1000;
      p.object.setAlpha(Math.max(0, p.life / p.maxLife));
      if (p.life <= 0) p.object.destroy();
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const g of this.ghosts) {
      g.life -= ms;
      g.object.setAlpha(Math.max(0, (g.life / 130) * 0.4));
      if (g.life <= 0) g.object.destroy();
    }
    this.ghosts = this.ghosts.filter((g) => g.life > 0);
  }
  clear() {
    this.particles.forEach((p) => p.object.destroy());
    this.ghosts.forEach((g) => g.object.destroy());
    this.particles = [];
    this.ghosts = [];
    this.trailMs = 0;
  }
}
