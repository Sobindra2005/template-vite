import { Scene, Math as PhaserMath, Geom } from 'phaser';
const Phaser = { Math: PhaserMath, Geom };

export class MainMenu extends Scene {
    constructor() {
        super('MainMenu');
    }

    create() {
        this._buildUI();

        let resizeTimer;
        const resizeEvent = (size) => {
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                this.children.removeAll(true);
                this.tweens.killAll();
                this.time.removeAllEvents();
                this._buildUI();
            }, 150);
        };

        this.scale.on('resize', resizeEvent);
        this.events.once('shutdown', () => {
            this.scale.off('resize', resizeEvent);
        });

        this.time.delayedCall(250, () => this.scene.start('Game'));

    }

    _buildUI() {
        const w = this.scale.width;
        const h = this.scale.height;

        // Dark gradient background
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x0b0e14, 0x0b0e14, 0x151924, 0x151924, 1);
        bg.fillRect(0, 0, w, h);

        // Animated particles
        this.particles = [];
        for (let i = 0; i < 30; i++) {
            const x = Phaser.Math.Between(0, w);
            const y = Phaser.Math.Between(0, h);
            const size = Phaser.Math.FloatBetween(1, 3);
            const alpha = Phaser.Math.FloatBetween(0.1, 0.5);
            const p = this.add.circle(x, y, size, 0x00e5ff, alpha);
            this.particles.push({ obj: p, speed: Phaser.Math.FloatBetween(0.2, 1) });
        }

        // Grid lines for trading aesthetic
        const grid = this.add.graphics();
        grid.lineStyle(1, 0x222a3f, 0.4);
        const cols = 8;
        const rows = 12;
        for (let i = 0; i <= cols; i++) {
            grid.lineBetween(i * w / cols, 0, i * w / cols, h);
        }
        for (let i = 0; i <= rows; i++) {
            grid.lineBetween(0, i * h / rows, w, i * h / rows);
        }

        // Glow circle
        const glowCircle = this.add.circle(w / 2, h * 0.38, Math.min(w, h) * 0.18, 0x00e5ff, 0.04);
        this.tweens.add({
            targets: glowCircle,
            scaleX: 1.15,
            scaleY: 1.15,
            alpha: 0.08,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Logo ring
        const ring = this.add.graphics();
        ring.lineStyle(2, 0x00e5ff, 0.6);
        ring.strokeCircle(w / 2, h * 0.38, Math.min(w, h) * 0.11);
        const innerRing = this.add.graphics();
        innerRing.lineStyle(1, 0x00e5ff, 0.3);
        innerRing.strokeCircle(w / 2, h * 0.38, Math.min(w, h) * 0.09);

        this.tweens.add({
            targets: [ring, innerRing],
            rotation: Math.PI * 2,
            duration: 12000,
            repeat: -1,
            ease: 'Linear'
        });

        // Chart icon inside circle
        const chartIcon = this.add.graphics();
        const cx = w / 2;
        const cy = h * 0.38;
        const r = Math.min(w, h) * 0.065;
        chartIcon.lineStyle(2, 0x00e5ff, 0.9);
        chartIcon.lineBetween(cx - r * 0.7, cy + r * 0.4, cx - r * 0.35, cy - r * 0.1);
        chartIcon.lineBetween(cx - r * 0.35, cy - r * 0.1, cx, cy + r * 0.2);
        chartIcon.lineBetween(cx, cy + r * 0.2, cx + r * 0.35, cy - r * 0.5);
        chartIcon.lineBetween(cx + r * 0.35, cy - r * 0.5, cx + r * 0.7, cy - r * 0.2);
        chartIcon.lineStyle(1, 0x00e5ff, 0.3);
        chartIcon.lineBetween(cx - r * 0.7, cy + r * 0.6, cx + r * 0.7, cy + r * 0.6);

        // Title
        const titleFontSize = Math.min(52, w * 0.085);
        const title = this.add.text(w / 2, h * 0.58, 'EUPHORIA', {
            fontFamily: '"Orbitron", "Arial Black", sans-serif',
            fontSize: titleFontSize,
            color: '#ffffff',
            letterSpacing: 6,
            stroke: '#00e5ff',
            strokeThickness: 1
        }).setOrigin(0.5);

        const subtitle = this.add.text(w / 2, h * 0.64, 'TRADE · PREDICT · WIN', {
            fontFamily: 'Arial',
            fontSize: Math.min(13, w * 0.022),
            color: '#00e5ff',
            letterSpacing: 5,
            alpha: 0.8
        }).setOrigin(0.5);

        // Stats bar
        const statsY = h * 0.72;
        const statsData = [
            { label: 'WIN RATE', value: '68.4%' },
            { label: 'PRIZE POOL', value: '$24,500' },
            { label: 'PLAYERS', value: '1,247' }
        ];
        const statW = Math.min(w * 0.28, 100);
        statsData.forEach((s, i) => {
            const sx = w / 2 + (i - 1) * (statW + 10);
            const statBg = this.add.rectangle(sx, statsY, statW, 52, 0x151924, 0.9).setStrokeStyle(1, 0x222a3f, 0.6);
            this.add.text(sx, statsY - 10, s.value, {
                fontFamily: 'Arial Black',
                fontSize: Math.min(15, w * 0.025),
                color: '#00e5ff'
            }).setOrigin(0.5);
            this.add.text(sx, statsY + 10, s.label, {
                fontFamily: 'Arial',
                fontSize: Math.min(9, w * 0.015),
                color: '#ffffff55',
                letterSpacing: 2
            }).setOrigin(0.5);
        });

        // Play button
        const btnW = Math.min(220, w * 0.55);
        const btnH = 54;
        const btnY = h * 0.84;

        // Group the interactive button
        const btnZone = this.add.zone(w / 2, btnY, btnW, btnH).setInteractive({ useHandCursor: true });
        const btnBg = this.add.rectangle(w / 2, btnY, btnW, btnH, 0x00e5ff);

        const btnGradient = this.add.graphics();
        btnGradient.fillGradientStyle(0x00b8d4, 0x0091ea, 0x00e5ff, 0x00b8d4, 1);
        btnGradient.fillRect(w / 2 - btnW / 2, btnY - btnH / 2, btnW, btnH);

        const btnText = this.add.text(w / 2, btnY, 'START TRADING', {
            fontFamily: '"Orbitron", Arial Black',
            fontSize: Math.min(15, w * 0.025),
            color: '#000000',
            letterSpacing: 3,
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Button hover effects on zone
        btnZone.on('pointerover', () => {
            this.tweens.add({ targets: [btnBg, btnGradient], scaleX: 1.04, scaleY: 1.04, duration: 120, ease: 'Power2' });
        });
        btnZone.on('pointerout', () => {
            this.tweens.add({ targets: [btnBg, btnGradient], scaleX: 1, scaleY: 1, duration: 120, ease: 'Power2' });
        });
        btnZone.on('pointerdown', () => {
        });

        // Pulse animation on button group
        this.tweens.add({
            targets: [btnBg, btnGradient, btnText, btnZone],
            y: `-=3`,
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Disclaimer text
        this.add.text(w / 2, h * 0.93, 'Virtual currency only • No real money involved', {
            fontFamily: 'Arial',
            fontSize: Math.min(10, w * 0.017),
            color: '#ffffff33',
            letterSpacing: 1
        }).setOrigin(0.5);

        // Animate title
        this.tweens.add({
            targets: [title],
            alpha: { from: 0, to: 1 },
            y: { from: h * 0.62, to: h * 0.58 },
            duration: 800,
            ease: 'Power2'
        });

        // Float particles
        this.time.addEvent({
            delay: 50,
            repeat: -1,
            callback: () => {
                this.particles.forEach(p => {
                    if (!p.obj.active) return;
                    p.obj.y -= p.speed;
                    if (p.obj.y < -10) p.obj.y = h + 10;
                });
            }
        });
    }
}
