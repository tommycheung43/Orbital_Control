import * as Phaser from 'phaser';
import session from '../game/StationSession.js';
export default class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }
  async create() {
    try {
      await session.init();
      this.scene.start('GameScene');
    } catch (error) {
      document.getElementById('status-message').textContent = `Station initialization failed: ${error.message}. Reload to retry.`;
      console.error(error);
    }
  }
}
