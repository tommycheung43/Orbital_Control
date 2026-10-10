import * as Phaser from "phaser";

import BootScene from "./scenes/BootScene.js";
import GameScene from "./scenes/GameScene.js";

const config = {
  type: Phaser.AUTO,

  width: 800,
  height: 450,

  parent: "game-container",

  backgroundColor: "#0b0f14",

  scene: [
    BootScene,
    GameScene,
  ],
};

new Phaser.Game(config);