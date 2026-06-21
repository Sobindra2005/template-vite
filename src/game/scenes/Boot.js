import { Scene } from 'phaser';

export class Boot extends Scene {
    constructor() {
        super('Boot');
    }

    preload() {
        // Load minimal assets needed for the preloader screen
        this.load.setPath('assets');
        this.load.image('background', 'bg.png');
    }

    create() {
        this.scene.start('Preloader');
    }
}
