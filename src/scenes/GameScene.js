import * as Phaser from 'phaser';
import session from '../game/StationSession.js';
import OperationsApp from '../ui/OperationsApp.js';
export default class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }
  create() {
    this.networkObjects = [];
    this.add.text(400, 34, 'ORBITAL CONTROL / SYSTEMS NETWORK', { fontFamily: 'Consolas, monospace', fontSize: '15px', color: '#8eabb6' }).setOrigin(0.5);
    this.add.text(400, 425, 'CONTROL THE STATION  /  QUERY THE CONSEQUENCES', { fontFamily: 'Consolas, monospace', fontSize: '13px', color: '#587482' }).setOrigin(0.5);
    this.app = new OperationsApp(session);
    this.unsubscribe = session.subscribe(() => this.renderStation());
    this.renderStation();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.unsubscribe(); this.app.destroy(); session.close(); });
  }
  rebuildNetwork(modules) {
    this.networkObjects.forEach(object => object.destroy());
    this.networkObjects = [];
    this.cards = [];
    const columns = modules.length <= 4 ? modules.length : 4;
    const rows = Math.ceil(modules.length / columns);
    const cardWidth = columns <= 3 ? 220 : 170;
    const cardHeight = rows === 1 ? 150 : rows === 2 ? 125 : 96;
    const gapX = columns <= 3 ? 35 : 20;
    const gapY = rows === 1 ? 0 : 15;
    const totalWidth = columns * cardWidth + (columns - 1) * gapX;
    const startX = (800 - totalWidth) / 2 + cardWidth / 2;
    const totalHeight = rows * cardHeight + (rows - 1) * gapY;
    const startY = 225 - totalHeight / 2 + cardHeight / 2;
    modules.forEach((module, index) => {
      const column = index % columns; const row = Math.floor(index / columns);
      const x = startX + column * (cardWidth + gapX); const y = startY + row * (cardHeight + gapY);
      const box = this.add.rectangle(x, y, cardWidth, cardHeight, 0x0b1720).setStrokeStyle(1, 0x294655);
      const title = this.add.text(x, y - cardHeight * 0.25, module.module_name.toUpperCase(), {
        fontFamily: 'Consolas, monospace', fontSize: columns === 4 ? '13px' : '16px', color: '#e8f6fa',
      }).setOrigin(0.5);
      const status = this.add.text(x, y + 12, '', { fontFamily: 'Consolas, monospace', fontSize: '13px', color: '#68d391', align: 'center' }).setOrigin(0.5);
      this.networkObjects.push(box, title, status);
      this.cards.push({ box, title, status });
    });
    this.moduleSignature = modules.map(module => `${module.module_id}:${module.module_name}`).join('|');
  }
  renderStation() {
    const modules = session.snapshot().modules;
    const signature = modules.map(module => `${module.module_id}:${module.module_name}`).join('|');
    if (signature !== this.moduleSignature) this.rebuildNetwork(modules);
    modules.forEach((module, index) => {
      this.cards[index].status.setText(`${module.status}\n${module.mw} MW allocated`);
      this.cards[index].status.setColor(module.status === 'Normal' ? '#68d391' : module.status === 'Critical' ? '#ff6b6b' : '#ffb454');
    });
  }
  update(_time, delta) { session.advance(delta); }
}
