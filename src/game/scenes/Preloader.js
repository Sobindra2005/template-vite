import { Scene } from 'phaser';

export class Preloader extends Scene {
    constructor() {
        super('Preloader');
    }

    init() {
        const w = this.scale.width;
        const h = this.scale.height;

        // Dark background
        this.add.rectangle(w / 2, h / 2, w, h, 0x0b0e14);

        // Brand text
        this.add.text(w / 2, h / 2 - 80, 'EUPHORIA', {
            fontFamily: '"Orbitron", "Arial Black", sans-serif',
            fontSize: Math.min(48, w * 0.08),
            color: '#00e5ff',
            letterSpacing: 8
        }).setOrigin(0.5);

        this.add.text(w / 2, h / 2 - 40, 'TRADE', {
            fontFamily: '"Orbitron", "Arial", sans-serif',
            fontSize: Math.min(18, w * 0.03),
            color: '#ffffff66',
            letterSpacing: 12
        }).setOrigin(0.5);

        // Progress bar bg
        const barW = Math.min(300, w * 0.7);
        this.add.rectangle(w / 2, h / 2 + 40, barW, 4, 0x222a3f);

        // Progress bar fill
        this.progressBar = this.add.rectangle(w / 2 - barW / 2, h / 2 + 40, 0, 4, 0x00e5ff).setOrigin(0, 0.5);
        this.barWidth = barW;

        // Loading text
        this.loadingText = this.add.text(w / 2, h / 2 + 65, 'LOADING...', {
            fontFamily: 'Arial',
            fontSize: 12,
            color: '#ffffff44',
            letterSpacing: 4
        }).setOrigin(0.5);

        this.load.on('progress', (progress) => {
            this.progressBar.width = this.barWidth * progress;
        });
    }

    preload() {
        this.load.setPath('assets');
        this.load.image('logo', 'logo.png');
    }

    create() {
        this.scene.start('MainMenu');
    }
}
