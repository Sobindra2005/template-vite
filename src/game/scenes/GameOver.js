import { Scene, Math as PhaserMath } from 'phaser';

export class GameOver extends Scene {
    constructor() {
        super('GameOver');
    }

    init(data) {
        this.finalBalance = data?.balance ?? 0;
        this.wins  = data?.wins  ?? 0;
        this.losses = data?.losses ?? 0;
    }

    create() {
        const W = this.scale.width;
        const H = this.scale.height;

        // Dark background
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x0b0e14, 0x0b0e14, 0x150505, 0x150505, 1);
        bg.fillRect(0, 0, W, H);

        // Grid
        bg.lineStyle(1, 0xff2a2a, 0.1);
        const cols = 8, rows = 12;
        for (let i = 1; i < cols; i++) bg.lineBetween(i * W / cols, 0, i * W / cols, H);
        for (let i = 1; i < rows; i++) bg.lineBetween(0, i * H / rows, W, i * H / rows);

        // Broken chart graphic
        const chart = this.add.graphics();
        chart.lineStyle(4, 0xff2a2a, 0.3);
        chart.beginPath();
        let cx = 0;
        let cy = H * 0.2;
        chart.moveTo(cx, cy);
        for(let i=0; i<8; i++) {
            cx += W * 0.15;
            cy += PhaserMath.Between(10, H * 0.15); // always going down
            chart.lineTo(cx, cy);
        }
        chart.strokePath();

        // Game Over Text
        const title = this.add.text(W / 2, H * 0.35, 'LIQUIDATED', {
            fontFamily: '"Orbitron", Arial Black',
            fontSize: Math.min(64, W * 0.1),
            color: '#ff2a2a',
            letterSpacing: 8,
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        this.tweens.add({
            targets: title,
            alpha: { from: 0, to: 1 },
            scale: { from: 0.8, to: 1 },
            duration: 800,
            ease: 'Bounce.easeOut'
        });

        // Stats panel
        const panelW = Math.min(400, W * 0.8);
        const panelH = 120;
        const panelY = H * 0.55;
        this.add.rectangle(W / 2, panelY, panelW, panelH, 0x151924, 0.9)
            .setStrokeStyle(1, 0xff2a2a, 0.4);

        const totalRounds = this.wins + this.losses;
        const winRate = totalRounds > 0 ? Math.round((this.wins / totalRounds) * 100) : 0;

        const statStyle = { fontFamily: 'Arial', fontSize: Math.min(14, W * 0.03), color: '#ffffff88', letterSpacing: 2 };
        const valStyle = { fontFamily: '"Orbitron", Arial Black', fontSize: Math.min(24, W * 0.05), color: '#ffffff' };

        this.add.text(W / 2 - panelW * 0.25, panelY - 20, 'ROUNDS', statStyle).setOrigin(0.5);
        this.add.text(W / 2 - panelW * 0.25, panelY + 15, totalRounds.toString(), valStyle).setOrigin(0.5);

        this.add.text(W / 2 + panelW * 0.25, panelY - 20, 'WIN RATE', statStyle).setOrigin(0.5);
        this.add.text(W / 2 + panelW * 0.25, panelY + 15, `${winRate}%`, { ...valStyle, color: winRate >= 50 ? '#00c896' : '#ff2a2a' }).setOrigin(0.5);

        // Play Again Button
        const btnW = Math.min(240, W * 0.6);
        const btnH = 50;
        const btnY = H * 0.8;
        
        const btnBg = this.add.rectangle(W / 2, btnY, btnW, btnH, 0xff2a2a)
            .setInteractive({ useHandCursor: true });
        
        const btnText = this.add.text(W / 2, btnY, 'RESTART TRADING', {
            fontFamily: '"Orbitron", Arial Black',
            fontSize: Math.min(14, W * 0.03),
            color: '#000000',
            letterSpacing: 2,
            fontStyle: 'bold'
        }).setOrigin(0.5);

        btnBg.on('pointerover', () => {
            this.tweens.add({ targets: btnBg, scaleX: 1.05, scaleY: 1.05, duration: 100 });
        });
        btnBg.on('pointerout', () => {
            this.tweens.add({ targets: btnBg, scaleX: 1, scaleY: 1, duration: 100 });
        });
        btnBg.on('pointerdown', () => {
            this.time.delayedCall(250, () => this.scene.start('Game'));
        });

        // Resize handler
        let resizeTimer;
        const resizeEvent = () => {
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                this.children.removeAll(true);
                this.tweens.killAll();
                this.create();
            }, 150);
        };
        this.scale.on('resize', resizeEvent);
        this.events.once('shutdown', () => {
            this.scale.off('resize', resizeEvent);
        });
    }
}
