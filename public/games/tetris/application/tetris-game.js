import { fetchRankings, saveRanking } from "../infra/firebase-runtime.js";

export class TetrisGame extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.COLS = 10;
        this.ROWS = 20;
        this.COLORS = [
            null,
            'oklch(65% 0.25 250)', // I
            'oklch(60% 0.2 60)',   // J
            'oklch(60% 0.2 30)',   // L
            'oklch(75% 0.2 140)',  // O
            'oklch(65% 0.2 180)',  // S
            'oklch(65% 0.2 320)',  // T
            'oklch(60% 0.2 0)'      // Z
        ];
        this.SHAPES = [
            [],
            [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
            [[2, 0, 0], [2, 2, 2], [0, 0, 0]],
            [[0, 0, 3], [3, 3, 3], [0, 0, 0]],
            [[4, 4], [4, 4]],
            [[0, 5, 5], [5, 5, 0], [0, 0, 0]],
            [[0, 6, 0], [6, 6, 6], [0, 0, 0]],
            [[7, 7, 0], [0, 7, 7], [0, 0, 0]]
        ];
        this.audioCtx = null;
        this.isMuted = false;
        this.bgmNode = null;
        this.bgmTimeout = null;
        
        this.controlsTimers = {};
        this.resetInternalState();
    }

    resetInternalState() {
        this.score = 0;
        this.combo = 0;
        this.board = Array.from({ length: this.ROWS }, () => Array(this.COLS).fill(0));
        this.isGameOver = false;
        this.nextPiece = this.generatePiece();
        this.piece = this.generatePiece();
        this.dropCounter = 0;
        this.dropInterval = 1000;
        this.lastTime = 0;
    }

    initAudio() {
        if (this.audioCtx) return;
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.startBGM();
    }

    startBGM() {
        if (this.isMuted || this.bgmNode) return;
        
        const melody = [
            ['E4', 4], ['B3', 8], ['C4', 8], ['D4', 4], ['C4', 8], ['B3', 8],
            ['A3', 4], ['A3', 8], ['C4', 8], ['E4', 4], ['D4', 8], ['C4', 8],
            ['B3', 4], ['B3', 8], ['C4', 8], ['D4', 4], ['E4', 4],
            ['C4', 4], ['A3', 4], ['A3', 4], [null, 4],
            ['D4', 4], ['F4', 8], ['A4', 4], ['G4', 8], ['F4', 8],
            ['E4', 4], ['C4', 8], ['E4', 4], ['D4', 8], ['C4', 8],
            ['B3', 4], ['B3', 8], ['C4', 8], ['D4', 4], ['E4', 4],
            ['C4', 4], ['A3', 4], ['A3', 4], [null, 4]
        ];

        const freqs = {
            'A3': 220.00, 'B3': 246.94, 'C4': 261.63, 'D4': 293.66, 
            'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00
        };

        let time = this.audioCtx.currentTime + 0.1;
        const tempo = 150; 
        const beatUnit = 60 / tempo;

        const playMelody = () => {
            if (this.isGameOver || this.isMuted) {
                this.bgmNode = null;
                return;
            }
            
            melody.forEach(([note, duration]) => {
                if (note) {
                    const osc = this.audioCtx.createOscillator();
                    const gain = this.audioCtx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freqs[note], time);
                    gain.gain.setValueAtTime(0.6, time);
                    gain.gain.exponentialRampToValueAtTime(0.0001, time + (4/duration) * beatUnit - 0.05);
                    osc.connect(gain);
                    gain.connect(this.audioCtx.destination);
                    osc.start(time);
                    osc.stop(time + (4/duration) * beatUnit);
                }
                time += (4/duration) * beatUnit;
            });
            
            this.bgmTimeout = setTimeout(playMelody, (time - this.audioCtx.currentTime) * 1000);
        };

        playMelody();
        this.bgmNode = true;
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
            if (this.bgmTimeout) clearTimeout(this.bgmTimeout);
            this.bgmNode = null;
        } else {
            this.initAudio();
            if (this.audioCtx && !this.bgmNode) this.startBGM();
        }
        this.updateMuteUI();
    }

    updateMuteUI() {
        const btn = this.shadowRoot.querySelector('#btn-mute');
        if (btn) btn.innerText = this.isMuted ? '🔇' : '🔊';
    }

    playNote(freq, duration, type = 'sine', volume = 0.06) {
        if (!this.audioCtx || this.isMuted) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
        gain.gain.setValueAtTime(volume, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + duration);
    }

    connectedCallback() {
        this.render();
        this.updateLayoutStyles();
        
        this.canvas = this.shadowRoot.querySelector('#game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.nextCanvas = this.shadowRoot.querySelector('#next-canvas');
        this.nextCtx = this.nextCanvas.getContext('2d');
        this.boardWrapper = this.shadowRoot.querySelector('.main-board');
        this.layoutEl = this.shadowRoot.querySelector('.game-layout');
        this.controlsEl = this.shadowRoot.querySelector('.controls');

        const observer = new ResizeObserver(() => {
            this.updateLayoutStyles();
            this.resizeCanvas();
        });
        observer.observe(document.body);
        observer.observe(this.boardWrapper);

        this.addEventListeners();
        requestAnimationFrame(this.update.bind(this));
    }

    updateLayoutStyles() {
        const header = document.querySelector('header');
        const headerHeight = header ? header.offsetHeight : 70;
        this.style.setProperty('--header-height', `${headerHeight}px`);
    }

    resizeCanvas() {
        const rect = this.boardWrapper.getBoundingClientRect();
        const isDesktop = window.innerWidth >= 1024;
        const padding = 14; 
        const availableW = this.boardWrapper.clientWidth - padding;
        
        let availableH;
        if (isDesktop) {
            availableH = Math.min(rect.height, window.innerHeight - 100) - padding;
        } else {
            const layoutRect = this.layoutEl ? this.layoutEl.getBoundingClientRect() : { height: window.innerHeight };
            const controlsHeight = this.controlsEl ? this.controlsEl.getBoundingClientRect().height : 130;
            const styles = this.layoutEl ? window.getComputedStyle(this.layoutEl) : null;
            const layoutPaddingTop = styles ? parseFloat(styles.paddingTop) || 0 : 0;
            const layoutPaddingBottom = styles ? parseFloat(styles.paddingBottom) || 0 : 0;
            availableH = layoutRect.height - controlsHeight - layoutPaddingTop - layoutPaddingBottom - 20;
        }
        
        let size = Math.floor(availableH / this.ROWS);
        if (size * this.COLS > availableW) {
            size = Math.floor(availableW / this.COLS);
        }
        
        this.BLOCK_SIZE = Math.max(size, 10);
        this.canvas.width = this.BLOCK_SIZE * this.COLS;
        this.canvas.height = this.BLOCK_SIZE * this.ROWS;
        this.canvas.style.width = `${this.canvas.width}px`;
        this.canvas.style.height = `${this.canvas.height}px`;
        this.draw();
    }

    generatePiece() {
        const id = Math.floor(Math.random() * (this.SHAPES.length - 1)) + 1;
        return { pos: { x: 3, y: 0 }, matrix: JSON.parse(JSON.stringify(this.SHAPES[id])), colorId: id };
    }

    update(time = 0) {
        if (this.isGameOver) return;
        const deltaTime = time - this.lastTime;
        this.lastTime = time;
        this.dropCounter += deltaTime;
        if (this.dropCounter > this.dropInterval) this.playerDrop(false);
        this.draw();
        requestAnimationFrame(this.update.bind(this));
    }

    playerDrop(isSoftDrop = true) {
        this.piece.pos.y++;
        if (this.collide()) {
            this.piece.pos.y--;
            this.merge();
            this.playerReset();
            this.arenaSweep();
            this.updateUI();
            this.playNote(100, 0.1, 'square', 0.02);
        } else if (isSoftDrop) {
            this.playNote(150, 0.05, 'sine', 0.01);
        }
        this.dropCounter = 0;
    }

    collide() {
        const [m, o] = [this.piece.matrix, this.piece.pos];
        for (let y = 0; y < m.length; ++y) {
            for (let x = 0; x < m[y].length; ++x) {
                if (m[y][x] !== 0 && (this.board[y + o.y] && this.board[y + o.y][x + o.x]) !== 0) return true;
            }
        }
        return false;
    }

    merge() {
        this.piece.matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) this.board[y + this.piece.pos.y][x + this.piece.pos.x] = value;
            });
        });
    }

    playerReset() {
        this.piece = this.nextPiece;
        this.nextPiece = this.generatePiece();
        if (this.collide()) {
            this.isGameOver = true;
            this.playNote(100, 0.8, 'sawtooth');
            this.shadowRoot.querySelector('#game-over').classList.add('visible');
            this.loadRankings();
        }
    }

    arenaSweep() {
        let linesCleared = 0;
        outer: for (let y = this.board.length - 1; y > 0; --y) {
            for (let x = 0; x < this.board[y].length; ++x) {
                if (this.board[y][x] === 0) continue outer;
            }
            const row = this.board.splice(y, 1)[0].fill(0);
            this.board.unshift(row);
            ++y;
            linesCleared++;
        }
        if (linesCleared > 0) {
            this.combo++;
            this.score += (linesCleared * 100) * this.combo;
            this.playNote(400 + (this.combo * 100), 0.3, 'sine', 0.1);
            this.showComboEffect();
        } else { this.combo = 0; }
    }

    showComboEffect() {
        const comboEl = this.shadowRoot.querySelector('#combo-text');
        if (this.combo > 1) {
            comboEl.innerText = `COMBO X${this.combo}`;
            comboEl.classList.add('pop');
            setTimeout(() => comboEl.classList.remove('pop'), 500);
        }
    }

    updateUI() {
        this.shadowRoot.querySelector('#score-val').innerText = this.score;
        this.shadowRoot.querySelector('#combo-val').innerText = this.combo;
    }

    async loadRankings() {
        if (typeof window.db === "undefined") return;
        try {
            const docs = await fetchRankings(window.db);
            const list = this.shadowRoot.querySelector('#rank-list');
            list.innerHTML = docs.map(d => {
                return `<div style="display:flex;justify-content:space-between;margin:2px 0;"><span>${d.nickname}</span><span>${d.score}</span></div>`;
            }).join('');
        } catch (e) { console.error(e); }
    }

    async submitScore() {
        if (typeof window.db === "undefined") return;
        const nick = this.shadowRoot.querySelector('#nick-input').value.trim();
        if (!nick || this.score === 0) return;
        try {
            await saveRanking(window.db, {
                nickname: nick, score: this.score
            });
            this.shadowRoot.querySelector('#submit-btn').disabled = true;
            this.loadRankings();
        } catch (e) { console.error(e); }
    }

    draw() {
        this.ctx.fillStyle = '#050505';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawGhost();
        this.drawMatrix(this.board, { x: 0, y: 0 }, this.ctx);
        this.drawMatrix(this.piece.matrix, this.piece.pos, this.ctx);
        this.drawNext();
    }

    drawGhost() {
        const ghost = JSON.parse(JSON.stringify(this.piece));
        while (!this.collideGhost(ghost)) { ghost.pos.y++; }
        ghost.pos.y--;
        this.ctx.globalAlpha = 0.2;
        this.drawMatrix(ghost.matrix, ghost.pos, this.ctx);
        this.ctx.globalAlpha = 1.0;
    }

    collideGhost(ghost) {
        const [m, o] = [ghost.matrix, ghost.pos];
        for (let y = 0; y < m.length; ++y) {
            for (let x = 0; x < m[y].length; ++x) {
                if (m[y][x] !== 0 && (this.board[y + o.y] && this.board[y + o.y][x + o.x]) !== 0) return true;
            }
        }
        return false;
    }

    drawMatrix(matrix, offset, context) {
        matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    const color = this.COLORS[value];
                    context.fillStyle = color;
                    // Soft shadow for depth
                    context.shadowBlur = 4;
                    context.shadowColor = 'rgba(0,0,0,0.1)';
                    context.fillRect((x + offset.x) * this.BLOCK_SIZE, (y + offset.y) * this.BLOCK_SIZE, this.BLOCK_SIZE - 1, this.BLOCK_SIZE - 1);
                    context.shadowBlur = 0;
                    
                    // Clean border
                    context.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                    context.lineWidth = 1;
                    context.strokeRect((x + offset.x) * this.BLOCK_SIZE, (y + offset.y) * this.BLOCK_SIZE, this.BLOCK_SIZE - 1, this.BLOCK_SIZE - 1);
                }
            });
        });
    }

    drawNext() {
        this.nextCtx.fillStyle = '#000';
        this.nextCtx.fillRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
        const s = 15;
        this.nextPiece.matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    this.nextCtx.fillStyle = this.COLORS[value];
                    this.nextCtx.fillRect(x * s + 10, y * s + 10, s - 1, s - 1);
                }
            });
        });
    }

    addEventListeners() {
        this.shadowRoot.querySelector('#submit-btn').onclick = () => this.submitScore();
        this.shadowRoot.querySelector('#btn-mute').onclick = () => this.toggleMute();
        
        const move = (dir) => { 
            this.initAudio(); 
            this.piece.pos.x += dir; 
            if (this.collide()) this.piece.pos.x -= dir; 
            else this.playNote(250, 0.05, 'sine', 0.03);
        };

        const startContinuousAction = (action, interval = 100) => {
            this.initAudio();
            action();
            const timerId = setInterval(action, interval);
            return timerId;
        };

        const stopContinuousAction = (timerKey) => {
            if (this.controlsTimers[timerKey]) {
                clearInterval(this.controlsTimers[timerKey]);
                delete this.controlsTimers[timerKey];
            }
        };

        const setupButton = (id, action, interval) => {
            const btn = this.shadowRoot.querySelector(`#${id}`);
            const start = (e) => {
                e.preventDefault();
                if (this.controlsTimers[id]) return;
                this.controlsTimers[id] = startContinuousAction(action, interval);
            };
            const end = (e) => {
                e.preventDefault();
                stopContinuousAction(id);
            };
            btn.onmousedown = start;
            btn.onmouseup = end;
            btn.onmouseleave = end;
            btn.ontouchstart = start;
            btn.ontouchend = end;
            btn.ontouchcancel = end;
        };

        setupButton('btn-left', () => move(-1), 120);
        setupButton('btn-right', () => move(1), 120);
        setupButton('btn-down', () => this.playerDrop(true), 60);

        this.shadowRoot.querySelector('#btn-up').onclick = () => {
            this.initAudio();
            this.rotate(this.piece.matrix, 1);
            if (this.collide()) this.rotate(this.piece.matrix, -1);
            else this.playNote(350, 0.08, 'triangle', 0.04);
        };

        document.addEventListener('keydown', e => {
            if (this.isGameOver) return;
            const keysToPrevent = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '];
            if (keysToPrevent.includes(e.key)) e.preventDefault();
            if (e.key === 'ArrowLeft') move(-1);
            if (e.key === 'ArrowRight') move(1);
            if (e.key === 'ArrowDown') { this.initAudio(); this.playerDrop(true); }
            if (e.key === 'ArrowUp') this.shadowRoot.querySelector('#btn-up').click();
        });
    }

    rotate(matrix, dir) {
        for (let y = 0; y < matrix.length; ++y) {
            for (let x = 0; x < y; ++x) [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
        }
        if (dir > 0) matrix.forEach(row => row.reverse()); else matrix.reverse();
    }

    render() {
        this.shadowRoot.innerHTML = `
        <style>
            @import url("/style.css");
            :host { 
                display: block; 
                position: relative; 
                width: 100%; 
                height: 100%; 
                min-height: 100dvh; 
                font-family: 'Pretendard', sans-serif; 
                background: oklch(98% 0.01 250); 
                color: var(--text-main); 
                overflow: hidden; 
            }
            
            .game-layout { 
                display: flex; 
                flex-direction: column; 
                height: 100%; 
                min-height: 100dvh; 
                padding: 20px; 
                box-sizing: border-box; 
                position: relative; 
                z-index: 1; 
                max-width: 1200px;
                margin: 0 auto;
            }
            
            @media (max-width: 768px) {
                .game-layout {
                    padding-top: calc(var(--header-height, 70px) + 10px);
                    padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 10px);
                    padding-left: 10px;
                    padding-right: 10px;
                }
                .controls { min-height: 120px !important; gap: 12px !important; }
                .side-panel { width: 80px !important; }
                .btn { font-size: 24px !important; }
            }

            .game-main { 
                flex: 1; 
                display: flex; 
                justify-content: center; 
                align-items: stretch;
                gap: 20px; 
                min-height: 0; 
            }

            .main-board { 
                position: relative; 
                flex: 1; 
                background: white; 
                border: 2px solid oklch(92% 0.02 260); 
                border-radius: 24px; 
                display: flex; 
                justify-content: center; 
                align-items: center;
                overflow: hidden; 
                box-shadow: 0 20px 40px rgba(2, 6, 23, 0.06);
                box-sizing: border-box;
            }

            #game-canvas {
                display: block;
                max-width: 100%;
                max-height: 100%;
                background: #fdfdfd;
            }

            .side-panel { 
                width: 120px; 
                display: flex; 
                flex-direction: column; 
                gap: 15px; 
            }

            .panel-box { 
                background: white;
                padding: 15px; 
                border-radius: 20px; 
                border: 1px solid oklch(92% 0.02 260); 
                text-align: center;
                box-shadow: 0 10px 20px rgba(2, 6, 23, 0.03);
            }

            .label { font-size: 0.7rem; color: var(--text-sub); font-weight: 800; letter-spacing: 1px; margin-bottom: 8px; text-transform: uppercase; }
            .value { font-size: 1.5rem; font-weight: 900; color: var(--p-blue); }

            #combo-text { 
                position: absolute; 
                top: 25%; left: 50%; 
                transform: translateX(-50%); 
                color: var(--p-blue); 
                font-size: 2rem; 
                font-weight: 900; 
                opacity: 0; 
                pointer-events: none; 
                transition: 0.3s; 
                z-index: 10;
                text-shadow: 0 4px 12px rgba(from var(--p-blue) l c h / 0.3);
            }
            #combo-text.pop { opacity: 1; transform: translate(-50%, -30px); }

            #game-over { 
                display: none; 
                position: absolute; 
                inset: 0; 
                background: rgba(255, 255, 255, 0.9); 
                backdrop-filter: blur(10px);
                z-index: 100; 
                flex-direction: column; 
                align-items: center; 
                justify-content: center; 
                padding: 30px; 
                text-align: center; 
            }
            #game-over.visible { display: flex; }

            .controls { 
                display: grid; 
                grid-template-columns: repeat(3, 1fr); 
                gap: 15px; 
                padding: 20px 0; 
                height: 160px; 
            }
            
            @media (min-width: 1024px) {
                .controls { display: none; }
                .game-main { align-items: center; }
                .main-board { flex: none; height: 80vh; width: calc(80vh * 0.5); max-width: 400px; }
            }

            .btn { 
                background: white; 
                border: 2px solid oklch(92% 0.02 260); 
                border-radius: 20px; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                font-size: 32px; 
                color: var(--text-main);
                box-shadow: 0 8px 15px rgba(2, 6, 23, 0.05); 
                transition: all 0.2s; 
                cursor: pointer; 
                touch-action: manipulation; 
            }
            .btn:active { 
                transform: translateY(4px); 
                box-shadow: 0 2px 5px rgba(2, 6, 23, 0.1); 
                background: var(--bg-main);
                border-color: var(--p-blue);
            }

            #btn-mute { 
                position: absolute; 
                top: 20px; right: 20px; 
                background: white; 
                border: 1px solid oklch(92% 0.02 260); 
                border-radius: 12px;
                padding: 8px;
                color: var(--text-main); 
                font-size: 20px; 
                cursor: pointer; 
                z-index: 10; 
                box-shadow: 0 4px 10px rgba(0,0,0,0.05);
            }

            #nick-input {
                padding: 12px 16px;
                border-radius: 12px;
                border: 2px solid oklch(92% 0.02 260);
                background: white;
                color: var(--text-main);
                font-weight: 700;
                margin-bottom: 15px;
                width: 180px;
                text-align: center;
                outline: none;
            }
            #nick-input:focus { border-color: var(--p-blue); }

            #submit-btn {
                padding: 14px 32px;
                background: var(--p-blue);
                color: white;
                border: none;
                border-radius: 12px;
                font-weight: 800;
                cursor: pointer;
                box-shadow: 0 8px 20px -5px var(--p-blue);
            }
        </style>
        <div class="game-layout">
            <button id="btn-mute">🔊</button>
            <div class="game-main">
                <div class="main-board">
                    <canvas id="game-canvas"></canvas>
                    <div id="combo-text">COMBO!</div>
                    <div id="game-over">
                        <h2 style="color:var(--p-blue); margin-bottom:20px; font-size: 2.5rem; font-weight: 950;">GAME OVER</h2>
                        <div id="rank-list" style="width:100%; max-width: 240px; margin-bottom:25px; font-size:14px; color:var(--text-sub); background: var(--bg-main); padding: 15px; border-radius: 16px;"></div>
                        <input type="text" id="nick-input" placeholder="NICKNAME" maxlength="8">
                        <button id="submit-btn">SAVE SCORE</button>
                        <button onclick="location.reload()" style="margin-top:20px; color:var(--text-sub); background:none; border:none; text-decoration:underline; font-weight: 600; cursor: pointer;">RETRY</button>
                    </div>
                </div>
                <div class="side-panel">
                    <div class="panel-box">
                        <div class="label">NEXT</div>
                        <canvas id="next-canvas" width="60" height="60" style="background: #fafafa; border-radius: 8px;"></canvas>
                    </div>
                    <div class="panel-box">
                        <div class="label">SCORE</div>
                        <div id="score-val" class="value">0</div>
                    </div>
                    <div class="panel-box">
                        <div class="label">COMBO</div>
                        <div id="combo-val" class="value">0</div>
                    </div>
                </div>
            </div>
            <div class="controls">
                <div class="btn" id="btn-up" style="grid-column: 2; grid-row: 1">↻</div>
                <div class="btn" id="btn-left" style="grid-column: 1; grid-row: 2">←</div>
                <div class="btn" id="btn-down" style="grid-column: 2; grid-row: 2">↓</div>
                <div class="btn" id="btn-right" style="grid-column: 3; grid-row: 2">→</div>
            </div>
        </div>
        `;
    }
}
