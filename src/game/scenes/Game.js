import { Scene, Math as PhaserMath } from 'phaser';

// Global color and styling configuration constants
const C = {
    BG: 0x0b0e14,      // Deep slate/dark background for the chart canvas
    PANEL: 0x151924,   // Slightly lighter color for panels, headers, and UI elements
    GRID: 0x222a3f,    // Subtle slate grey color used to draw the background grid lines
    ACCENT: 0x00e5ff,  // Neon cyan accent color for chart line, price dot, and key active borders
    CELL_BG: 0x00e5ff, // Color used for the interactive betting cell backgrounds and default borders
    TEXT: '#e2e8f0',   // Light gray/white color for regular UI text
    TEXT_DIM: '#64748b', // Muted blue-grey color for secondary or dim text
};

/**
 * Game Scene Class
 * Handles the main prediction game loop, including chart rendering, zooming, panning, 
 * historical price simulation, and the interactive future-betting grid system.
 */
export class Game extends Scene {
    constructor() {
        super('Game');
    }

    /**
     * Scene Initialization
     * Invoked when the scene starts. Sets up the initial balance, pricing simulation metrics,
     * zoom parameters, view states, and pre-populates history.
     */
    init() {
        // Initial user balance and the current simulation starting price
        this.balance = 1744.08;
        this.currentPrice = 1744.10;
        this.history = []; // Holds historical { t: timestamp, p: price } points
        this.bets = [];    // Array of bets placed by the user: { t, p, amount }

        // Zoom scale variables defining visual space scaling
        this.basePixelsPerSecond = 12; // Base horizontal scale factor (time axis)
        this.basePixelsPerDollar = 240; // Base vertical scale factor (price axis) — matched to timeInterval for square cells
        this.zoomTarget = 1;           // Target zoom level to smoothly transition towards
        this.currentZoom = 1;          // Active zoom level interpolating towards zoomTarget
        this.minZoom = 0.7;            // Minimum allowed zoom out level (keeps cells readable)
        this.maxZoom = 1.9;            // Maximum allowed zoom in level

        // Viewport camera/navigation state
        this.viewTime = Date.now();       // Current time anchor for the x-axis center
        this.viewPrice = this.currentPrice; // Current price anchor for the y-axis center
        this.isAutoFollowing = true;      // If true, keeps screen centered on the latest price tick
        this.isDragging = false;          // True when user is actively clicking and dragging the viewport
        this.lastClickTime = 0;           // Tracking click intervals to detect double-clicks

        // Active running time variable initialized to current system time
        this.t = this.viewTime;
        this.pixelsPerSecond = this.basePixelsPerSecond;
        this.pixelsPerDollar = this.basePixelsPerDollar;

        // Generate mock historical price data (80 ticks prior to start)
        // This gives the chart line some initial data to draw when the game opens
        let p = this.currentPrice;
        for (let i = 0; i < 80; i++) {
            this.history.unshift({ t: this.t - i * 500, p: p });
            // Random walk: adjust mock price slightly up or down per step
            p += PhaserMath.FloatBetween(-0.2, 0.2);
        }
    }

    /**
     * Scene Creation
     * Sets up UI elements, configures input event listeners (zoom, pan, resize), 
     * and initializes performance tracking text.
     */
    create() {
        // Build the basic graphics layer container and price/balance UI widgets
        this._buildUI();

        // Register Mouse Wheel listener to support zooming in and out of the chart
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            // Negative deltaY means scroll up (zoom in), positive means scroll down (zoom out)
            const zoomAmount = deltaY > 0 ? -0.05 : 0.05;
            // Clamp target zoom value between defined min and max constraints
            this.zoomTarget = PhaserMath.Clamp(this.zoomTarget + zoomAmount, this.minZoom, this.maxZoom);
        });

        // Register Pointer Down listener for panning initiation & double-click auto-follow toggle
        this.input.on('pointerdown', (pointer) => {
            this.dragStartX = pointer.x;
            this.dragStartY = pointer.y;
            this.isDragging = false; // Reset drag state on click

            const now = Date.now();
            // Detect double-click if time elapsed since last click is under 300ms
            if (now - this.lastClickTime < 300) {
                this.isAutoFollowing = true; // Snap viewport focus back to the live price line head
            }
            this.lastClickTime = now;
        });

        // Register Pointer Move listener to update viewport coordinates when dragging
        this.input.on('pointermove', (pointer) => {
            if (pointer.isDown) {
                // Compute pointer displacement distance
                const dist = PhaserMath.Distance.Between(pointer.x, pointer.y, this.dragStartX, this.dragStartY);
                // Require drag threshold of > 5 pixels to distinguish a drag from a simple tap click
                if (dist > 5) {
                    this.isDragging = true;
                }

                if (this.isDragging) {
                    // Calculate pixel difference from previous position
                    const dx = pointer.x - pointer.prevPosition.x;
                    const dy = pointer.y - pointer.prevPosition.y;

                    // Convert screen pixels back into chart units (time in ms, price in dollars)
                    // Panning left shifts viewport forward in time; panning up shifts view up in price
                    this.viewTime -= (dx / this.pixelsPerSecond) * 1000;
                    this.viewPrice += (dy / this.pixelsPerDollar);

                    // Panning manually disables the automatic follow mode
                    this.isAutoFollowing = false;
                }
            }
        });

        // Register Pointer Up listener to release drag state with a slight debounce delay
        this.input.on('pointerup', () => {
            setTimeout(() => { this.isDragging = false; }, 50);
        });

        // Handle Responsive Window Resizing
        // Safely recreates all UI elements after a slight debounce to prevent rendering artifacts
        let resizeTimer;
        const resizeHandler = ({ width, height }) => {
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                this.children.removeAll(true); // Clear all existing GameObjects from Scene list
                this.tweens.killAll();         // Terminate ongoing UI animations
                this._buildUI();               // Rebuild UI components for the new dimensions
            }, 150);
        };
        this.scale.on('resize', resizeHandler);
        // Clean up resize listener on scene shutdown to prevent memory leaks
        this.events.once('shutdown', () => this.scale.off('resize', resizeHandler));

        // Create diagnostic FPS counter text in the upper left corner
        this.fpsText = this.add.text(10, 10, 'FPS: 0', {
            fontSize: '20px',
            color: '#ffffff'
        });
    }

    /**
     * Main Game Update Loop
     * Runs every frame. Updates FPS counter, interpolates zoom levels, ticks time,
     * runs real-time price simulation, and triggers frame redraws.
     */
    update(time, delta) {
        // Display real-time active loops per second (FPS)
        this.fpsText.setText(
            `FPS: ${Math.round(this.game.loop.actualFps)}`
        );
        
        // Wait until UI is built and boundary coordinates are established
        if (!this.chartBounds) return;

        // Smooth zoom transition: interpolate currentZoom towards zoomTarget using a lerp coefficient
        this.currentZoom += (this.zoomTarget - this.currentZoom) * 0.15;
        this.pixelsPerSecond = this.basePixelsPerSecond * this.currentZoom;
        this.pixelsPerDollar = this.basePixelsPerDollar * this.currentZoom;

        // Advance simulation time (delta is time in ms elapsed since last frame)
        this.t += delta;

        // If auto-following, automatically center the viewport on current time and lerp vertical price position
        if (this.isAutoFollowing) {
            this.viewTime = this.t;
            this.viewPrice += (this.currentPrice - this.viewPrice) * 0.03; // Smooth vertical stabilization
        }

        // Simulate Real-time Price Fluctuations (Random Walk)
        // 15% probability per frame to step the price up or down
        if (Math.random() < 0.15) {
            this.currentPrice += PhaserMath.FloatBetween(-0.02, 0.02);
            this.history.push({ t: this.t, p: this.currentPrice });
            // Prune history buffer to keep memory footprints low
            if (this.history.length > 2000) this.history.shift();
        } else if (this.history.length > 0) {
            // Keep the tail of the line updated with the exact current timestamp to make drawing seamless
            this.history[this.history.length - 1].t = this.t;
            this.history[this.history.length - 1].p = this.currentPrice;
        }

        // Trigger redrawing of the grid system, betting boxes, and chart line paths
        this._drawChartAndGrid();
    }

    /**
     * UI Initialization Setup
     * Draws background gradient, defines chart bounds, sets up canvas masking,
     * registers graphics layers, and creates pools for UI text rendering.
     */
    _buildUI() {
        const W = this.scale.width;
        const H = this.scale.height;

        // Render the overall game screen background gradient
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x0b0e14, 0x0b0e14, 0x151924, 0x151924, 1);
        bg.fillRect(0, 0, W, H);
        

        // Chart Area boundary coordinates spanning the full viewport canvas
        this.chartBounds = {
            x: 0,
            y: 0,
            w: W,
            h: H
        };

        // Create geometric mask to clip grid lines and chart graphics inside the chart bounds
        const maskShape = this.add.graphics().fillStyle(0x000000).fillRect(this.chartBounds.x, this.chartBounds.y, this.chartBounds.w, this.chartBounds.h);
        this.chartMask = maskShape.createGeometryMask();

        // Initialize dedicated layers for independent z-ordering and rendering efficiency
        this._gridGraphics = this.add.graphics().setMask(this.chartMask); // Background grid lines & dots
        this._uiGraphics = this.add.graphics().setMask(this.chartMask);   // Interactive boxes & bets
        this._chartGraphics = this.add.graphics().setMask(this.chartMask); // Chart line graph & glowing elements

        // Generate text pool to display cell multiplier texts (e.g. "1.5x") efficiently
        // Pooling text objects prevents constant garbage collection allocation spikes
        this._textPool = [];
        for (let i = 0; i < 200; i++) {
            this._textPool.push(this.add.text(0, 0, '', { 
                fontFamily: 'Arial', 
                fontSize: 19, 
                color: '#ffffffff' 
            }).setOrigin(1, 1).setDepth(100).setMask(this.chartMask).setVisible(false));
        }

        // ── Axis Label Pools ────────────────────────────────────────────────
        // Time axis labels: shown at the top (and bottom) of each vertical grid line
        this._timeLabelPool = [];
        for (let i = 0; i < 30; i++) {
            this._timeLabelPool.push(this.add.text(0, 0, '', {
                fontFamily: 'Arial', fontSize: 15, color: 'rgb(167, 190, 197)'
            }).setOrigin(0.5, 1).setDepth(15).setVisible(false));
        }

        // Price axis labels: shown on the RIGHT edge for each horizontal row line
        this._priceLabelPool = [];
        for (let i = 0; i < 30; i++) {
            this._priceLabelPool.push(this.add.text(0, 0, '', {
                fontFamily: 'Arial', fontSize: 15, color: '#a3a5a8ff', fontStyle: 'bold'
            }).setOrigin(0, 0.5).setDepth(12).setVisible(false));
        }

        // Background pills for axis labels (drawn via a dedicated graphics layer each frame)
        this._axisLabelGraphics = this.add.graphics().setDepth(11);

        // ── Live Right-Axis Price Dot (follows chart line head) ───────────────
        this._priceLabelBg = this.add.rectangle(0, 0, 72, 22, C.ACCENT).setOrigin(0, 0.5).setDepth(20);
        this._priceLabel = this.add.text(0, 0, '', {
            fontFamily: 'Arial', fontSize: 11, color: '#000000', fontStyle: 'bold'
        }).setOrigin(0, 0.5).setDepth(21);
    }

    /**
     * Canvas Redraw Routine
     * Performs vector drawing on background layers. Handles time conversion mappings,
     * draws background grid lines, calculates interactive betting cells, checks for hovers,
     * renders placed bets, and draws the primary continuous price curve.
     */
    _drawChartAndGrid() {
        const b = this.chartBounds;
        const gg = this._gridGraphics;
        const cg = this._chartGraphics;
        const ug = this._uiGraphics;

        // Clear graphics frames prior to drawing current frame
        gg.clear();
        cg.clear();
        ug.clear();
        this._axisLabelGraphics.clear();
        
        // Hide all pooled texts by default; they will be turned on selectively below
        this._textPool.forEach(t => t.setVisible(false));
        this._timeLabelPool.forEach(t => t.setVisible(false));
        this._priceLabelPool.forEach(t => t.setVisible(false));
        let textIdx = 0, timeLblIdx = 0, priceLblIdx = 0;

        const alg = this._axisLabelGraphics; // shorthand for pill drawing

        // Coordinate transformation utilities: Mapping simulation values (t: time, p: price) into canvas pixel space
        const dotX = b.x + b.w * 0.35; // Head of chart line is locked horizontally at 35% viewport width
        // getX converts timestamp to X pixel coord based on viewTime anchor and horizontal scale zoom
        const getX = (time) => dotX + ((time - this.viewTime) / 1000) * this.pixelsPerSecond;
        // getY converts price value to Y pixel coord based on viewPrice anchor and vertical scale zoom
        const getY = (price) => b.y + b.h / 2 - (price - this.viewPrice) * this.pixelsPerDollar;

        // 1. DRAW BACKGROUND GRID
        gg.lineStyle(1, C.GRID, 0.4);

        // Draw vertical columns spaced every 10 seconds (10,000 milliseconds)
        const timeInterval = 10000;
        // Find timestamps matching grid boundaries just outside the left and right viewport limits
        const firstTime = Math.floor((this.viewTime - (dotX - b.x) / this.pixelsPerSecond * 1000) / timeInterval) * timeInterval;
        const lastTime = Math.ceil((this.viewTime + (b.w - (dotX - b.x)) / this.pixelsPerSecond * 1000) / timeInterval) * timeInterval;

        // Helper: format a ms timestamp as HH:MM:SS
        const fmtTime = (ms) => {
            const d = new Date(ms);
            return d.getHours().toString().padStart(2,'0') + ':'
                 + d.getMinutes().toString().padStart(2,'0') + ':'
                 + d.getSeconds().toString().padStart(2,'0');
        };

        for (let t = firstTime; t <= lastTime; t += timeInterval) {
            const x = getX(t);
            if (x >= b.x && x <= b.x + b.w) {
                // Grid line
                gg.lineStyle(1, C.GRID, 0.4);
                gg.lineBetween(x, b.y, x, b.y + b.h);

                // ── Time Label at BOTTOM only, with dark background pill ────────
                if (timeLblIdx < this._timeLabelPool.length) {
                    const lbl = this._timeLabelPool[timeLblIdx++];
                    const lblText = fmtTime(t);
                    const pillW = 70, pillH = 20;
                    const pillX = x - pillW / 2;
                    const pillY = b.y + b.h - pillH - 2;
                    // Draw dark pill bg
                    alg.fillStyle(0x0b0e14, 0.85);
                    alg.strokeStyle = 0;
                    alg.fillRoundedRect(pillX, pillY, pillW, pillH, 4);
                    alg.lineStyle(1, C.GRID, 0.6);
                    alg.strokeRoundedRect(pillX, pillY, pillW, pillH, 4);
                    lbl.setPosition(x, b.y + b.h - 2 - pillH / 2).setText(lblText).setOrigin(0.5, 0.5).setVisible(true);
                }
            }
        }

        // Draw horizontal rows spaced every $0.5
        const priceInterval = 0.5;
        const visiblePriceRange = (b.h / this.pixelsPerDollar);
        const firstPrice = Math.floor((this.viewPrice - visiblePriceRange / 2) / priceInterval) * priceInterval;
        const lastPrice = Math.ceil((this.viewPrice + visiblePriceRange / 2) / priceInterval) * priceInterval;

        for (let p = firstPrice; p <= lastPrice; p += priceInterval) {
            const y = getY(p);
            if (y >= b.y && y <= b.y + b.h) {
                // Grid line
                gg.lineStyle(1, C.GRID, 0.4);
                gg.lineBetween(b.x, y, b.x + b.w, y);

                // ── Price Label on RIGHT edge, with dark background pill ────────
                if (priceLblIdx < this._priceLabelPool.length) {
                    const lbl = this._priceLabelPool[priceLblIdx++];
                    const pillW = 75, pillH = 35;
                    const pillX = b.x + b.w - pillW - 2;
                    const pillY = y - pillH / 2;
                    // Dark pill bg
                    alg.fillStyle(0x0b0e14, 0.85);
                    alg.fillRoundedRect(pillX, pillY, pillW, pillH, 4);
                    alg.lineStyle(1, C.GRID, 0.6);
                    alg.strokeRoundedRect(pillX, pillY, pillW, pillH, 4);
                    lbl.setPosition(b.x + b.w - pillW , y).setText(`$${p.toFixed(1)}`).setOrigin(0, 0.5).setVisible(true);
                }
            }
        }

        // Draw small grid intersection dots
        gg.fillStyle(C.GRID, 0.8);
        for (let t = firstTime; t <= lastTime; t += timeInterval) {
            for (let p = firstPrice; p <= lastPrice; p += priceInterval) {
                const x = getX(t);
                const y = getY(p);
                if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
                    gg.fillCircle(x, y, 2);
                }
            }
        }

        // 2. DRAW INTERACTIVE FUTURE-BETTING GRID
        const pointer = this.input.activePointer;
        let hoveredCell = null;

        // Betable area depth constraints
        const xDepth = 18; // Max columns forward that are fully betable (with multiplier + hover)
        const yDepth = 20; // Max rows up and down from the current price box

        // Determine the price box that currently contains the live price
        const currentPriceBox = Math.floor(this.currentPrice / priceInterval) * priceInterval;

        // Iterate columns starting only from the current time forward (preventing betting on past intervals)
        for (let t = Math.max(firstTime, Math.ceil(this.t / timeInterval) * timeInterval); t <= lastTime; t += timeInterval) {
            const isBetable = (t - this.t) > timeInterval;

            // Compute absolute column offset from the current time (scroll-independent)
            const colIndex = Math.round((t - this.t) / timeInterval);

            // Check if this column is within the X depth for full betting features
            const isWithinXDepth = colIndex <= xDepth;

            let alpha = 0.8;
            if (isBetable) {
                const timeToCutoff = (t - timeInterval) - this.t;
                if (timeToCutoff <= 2000) {
                    const blinkProgress = timeToCutoff / 2000;
                    alpha = blinkProgress * (0.45 + 0.25 * Math.cos(blinkProgress * 4 * Math.PI));
                }
            } else {
                alpha = 0;
            }

            for (let p = firstPrice; p < lastPrice; p += priceInterval) {
                const x = getX(t);
                const y = getY(p + priceInterval); // Y-axis goes downwards; top edge of cell is higher price index
                const w = getX(t + timeInterval) - x;
                const h = getY(p) - y;

                // Calculate row distance from the current price box
                const rowOffset = Math.round((p - currentPriceBox) / priceInterval);
                const isWithinYDepth = Math.abs(rowOffset) <= yDepth;

                // A cell is fully betable only if within both X and Y depth
                const isFullyBetable = isBetable && isWithinXDepth && isWithinYDepth;

                // Base cell borders: draw for all visible future cells
                if (alpha > 0) {
                    ug.lineStyle(1, C.CELL_BG, alpha);
                    ug.strokeRoundedRect(x + 2, y + 2, w - 4, h - 4, 6);

                    // Multiplier label: only render within the fully betable area
                    if (isFullyBetable && textIdx < this._textPool.length) {
                        const txt = this._textPool[textIdx++];
                        // Calculate a deterministic mock payout multiplier based on price coordinates
                        const mult = (100 - ((p % 5) * 10) + ((t % 60000) / 1000)).toFixed(1);
                        txt.setPosition(x + w - 4, y + h - 4).setText(`${mult}x`).setVisible(true).setAlpha(alpha);
                    }
                }

                // Check if user cursor is hovering directly inside this cell's bounding area
                // Only allow hover/click within the fully betable area
                const isHovered = isFullyBetable && pointer.x >= x && pointer.x < x + w && pointer.y >= y && pointer.y < y + h;

                // Draw solid hover fill overlay if mouse pointer resides inside cell boundaries
                if (isHovered && x < b.x + b.w && y > b.y) {
                    hoveredCell = { t, p, x, y, w, h };
                    ug.fillStyle(C.CELL_BG, 0.1 * (alpha / 0.6));
                    ug.fillRoundedRect(x + 2, y + 2, w - 4, h - 4, 6);
                }

                // Render placed bets: Check if current cell coordinates match a stored user bet
                const bet = this.bets.find(bet => bet.t === t && bet.p === p);
                if (bet) {
                    // Highlight the cell with a stronger background glow and accent colored border
                    ug.fillStyle(C.CELL_BG, 0.25);
                    ug.fillRoundedRect(x + 2, y + 2, w - 4, h - 4, 6);
                    ug.lineStyle(2, C.ACCENT, 1);
                    ug.strokeRoundedRect(x + 2, y + 2, w - 4, h - 4, 6);

                    // Draw a user profile indicator bubble on the top-right corner of the cell
                    ug.fillStyle(0x000000, 0.8);
                    ug.fillCircle(x + w - 16, y + 16, 10);
                    ug.lineStyle(1, C.ACCENT, 1);
                    ug.strokeCircle(x + w - 16, y + 16, 10);
                }
            }
        }

        // Process grid interaction clicks (when mouse pointer is down and hovering over an interactive cell)
        if (pointer.isDown && hoveredCell && !this._isClicking && !this.isDragging) {
            this._isClicking = true; // Lock clicking state to trigger exactly once per press
            this._placeBet(hoveredCell.t, hoveredCell.p);
        } else if (!pointer.isDown) {
            this._isClicking = false; // Reset lock when user releases touch/click
        }

        // 3. DRAW THE CHART LINE & SHADING
        if (this.history.length > 0) {
            let lastX = 0, lastY = 0;
            let firstX = getX(this.history[0].t);

            // Shading: Draw filled polygon under the line graph
            cg.beginPath();
            cg.moveTo(firstX, b.y + b.h); // Bottom anchor at first point
            this.history.forEach((pt) => {
                const x = getX(pt.t);
                const y = getY(pt.p);
                cg.lineTo(x, y);
                lastX = x;
                lastY = y;
            });
            cg.lineTo(lastX, b.y + b.h); // Bottom anchor at last point
            cg.closePath();
            cg.fillStyle(C.ACCENT, 0.08); // Semi-transparent blue fill
            cg.fillPath();

            // Glow line: thick semi-transparent backing line simulating a neon tube glow
            cg.lineStyle(8, C.ACCENT, 0.15);
            cg.beginPath();
            this.history.forEach((pt, i) => {
                const x = getX(pt.t);
                const y = getY(pt.p);
                if (i === 0) cg.moveTo(x, y);
                else cg.lineTo(x, y);
            });
            cg.strokePath();

            // Core line: thin opaque foreground indicator line
            cg.lineStyle(2, C.ACCENT, 1);
            cg.beginPath();
            this.history.forEach((pt, i) => {
                const x = getX(pt.t);
                const y = getY(pt.p);
                if (i === 0) cg.moveTo(x, y);
                else cg.lineTo(x, y);
            });
            cg.strokePath();

            // Glowing indicator dot: renders current price coordinates at the head of the graph
            cg.fillStyle(0xffffff, 1); // Solid white core
            cg.fillCircle(lastX, lastY, 4);
            cg.fillStyle(C.ACCENT, 0.3); // Inner glowing ring
            cg.fillCircle(lastX, lastY, 12);
            cg.fillStyle(C.ACCENT, 0.15); // Outer soft flare ring
            cg.fillCircle(lastX, lastY, 24);

            // Position and print the real-time numeric value label on the right edge
            // The pill sits flush against the right border of the chart
            const rightEdge = b.x + b.w;
            this._priceLabelBg.setPosition(rightEdge - 72, lastY);
            this._priceLabel.setPosition(rightEdge - 68, lastY);
            this._priceLabel.setText(`$${this.currentPrice.toFixed(2)}`);
        }
    }

    /**
     * Bet Placement Action
     * Deducts currency from user balance and appends the bet configuration into tracking array.
     */
    _placeBet(t, p) {
        const betAmount = 10;
        if (this.balance >= betAmount) {
            this.balance -= betAmount;
            // Push active bet coordinates so it gets rendered on future frame updates
            this.bets.push({ t, p, amount: betAmount });
            
            // Update balance display in top UI bar if widget reference is defined
            if (this._balanceText) {
                this._balanceText.setText(`$${this.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
            }
        }
    }
}
