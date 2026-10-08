import type Phaser from 'phaser';
import { validateLevel, type LevelDefinition } from './types';
import { DogTreat } from '../entities/DogTreat';
export function loadLevel(scene: Phaser.Scene, level: LevelDefinition) {
  validateLevel(level);
  const terrain = scene.physics.add.staticGroup();
  for (const p of level.platforms) {
    const zone = scene.add.zone(
      p.x + p.width / 2,
      p.y + p.height / 2,
      p.width,
      p.height,
    );
    scene.physics.add.existing(zone, true);
    terrain.add(zone);
  }
  return { terrain, treats: level.treats.map((t) => new DogTreat(scene, t)) };
}
