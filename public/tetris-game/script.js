class TetrisGame extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.COLS = 10;
        this.ROWS = 20;
        this.BLOCK_SIZE = 20;
        this.COLORS = [
            null,
            'oklch(60% 0.15 250)', // I
            'oklch(60% 0.15 60)',  // J
            'oklch(60% 0.15 30)',  // L
            'oklch(60% 0.15 140)', // O
            'oklch(60% 0.15 180)', // S
            'oklch(60% 0.15 320)', // T
            'oklch(60% 0.15 0)'    // Z
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
        this.resetInternalState();
    }

    resetInternalState() {
        this.score = 0;
        this.combo = 0;
        this.board = Array.from({ length: this.ROWS }, () => Array(this.COLS).fill(0));
        this.isGameOver = false;
        this.nextPiece = this.generatePiece();
        this.piece = this.generatePiece();
    }

    initAudio() {
        if (this.audioCtx) return;
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    playNote(freq, duration, type = 'square', volume = 0.1) {
        if (!this.audioCtx) return;
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

    soundMove() { this.playNote(150, 0.05, 'sine'); }
    soundRotate() { this.playNote(300, 0.05, 'sine'); }
    soundClear() { this.playNote(400 + (this.combo * 100), 0.2); }
    soundGameOver() { this.playNote(100, 0.8, 'sawtooth'); }

    connectedCallback() {
        this.render();
        this.canvas = this.shadowRoot.querySelector('#game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.nextCanvas = this.shadowRoot.querySelector('#next-canvas');
        this.nextCtx = this.nextCanvas.getContext('2d');
        
        this.resizeCanvas();
        this.initGame();
        this.addEventListeners();
        window.addEventListener('resize', () => { this.resizeCanvas(); this.draw(); });
    }

    resizeCanvas() {
        const isSmallScreen = window.innerWidth < 600;
        // 모바일일 때 헤더/푸터/버튼 공간을 더 보수적으로 잡음 (최소 300px 확보)
        const reservedH = isSmallScreen ? 320 : 220; 
        const availableW = window.innerWidth - 40;
        const availableH = window.innerHeight - reservedH;

        let size = Math.floor(availableH / this.ROWS);
        const maxWidthSize = Math.floor(Math.min(availableW, 350) / this.COLS);
        if (size > maxWidthSize) size = maxWidthSize;

        this.BLOCK_SIZE = Math.max(size, 12);
        this.canvas.width = this.BLOCK_SIZE * this.COLS;
        this.canvas.height = this.BLOCK_SIZE * this.ROWS;
        
        this.NEXT_BLOCK_SIZE = Math.floor(this.BLOCK_SIZE * 0.6);
        this.nextCanvas.width = this.NEXT_BLOCK_SIZE * 4;
        this.nextCanvas.height = this.NEXT_BLOCK_SIZE * 4;
    }

    initGame() {
        this.dropCounter = 0;
        this.dropInterval = 1000;
        this.lastTime = 0;
        this.update();
    }

    generatePiece() {
        const id = Math.floor(Math.random() * (this.SHAPES.length - 1)) + 1;
        return { pos: { x: 3, y: 0 }, matrix: JSON.parse(JSON.stringify(this.SHAPES[id])), colorId: id };
    }

    draw() {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawMatrix(this.board, { x: 0, y: 0 }, this.ctx, this.BLOCK_SIZE);
        this.drawMatrix(this.piece.matrix, this.piece.pos, this.ctx, this.BLOCK_SIZE);

        this.nextCtx.fillStyle = '#111';
        this.nextCtx.fillRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
        const nx = (4 - this.nextPiece.matrix[0].length) / 2;
        const ny = (4 - this.nextPiece.matrix.length) / 2;
        this.drawMatrix(this.nextPiece.matrix, { x: nx, y: ny }, this.nextCtx, this.NEXT_BLOCK_SIZE);
    }

    drawMatrix(matrix, offset, context, size) {
        matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    context.shadowBlur = size / 4;
                    context.shadowColor = this.COLORS[value];
                    context.fillStyle = this.COLORS[value];
                    context.fillRect((x + offset.x) * size, (y + offset.y) * size, size - 1, size - 1);
                    context.shadowBlur = 0;
                }
            });
        });
    }

    playerDrop() {
        if (this.isGameOver) return;
        this.initAudio();
        this.piece.pos.y++;
        if (this.collide()) {
            this.piece.pos.y--;
            this.merge();
            this.playerReset();
            this.arenaSweep();
            this.updateScore();
        }
        this.dropCounter = 0;
    }

    playerMove(dir) {
        if (this.isGameOver) return;
        this.initAudio();
        this.piece.pos.x += dir;
        if (this.collide()) this.piece.pos.x -= dir;
        else this.soundMove();
    }

    playerRotate(dir) {
        if (this.isGameOver) return;
        this.initAudio();
        const pos = this.piece.pos.x;
        let offset = 1;
        this.rotate(this.piece.matrix, dir);
        while (this.collide()) {
            this.piece.pos.x += offset;
            offset = -(offset + (offset > 0 ? 1 : -1));
            if (offset > this.piece.matrix[0].length) {
                this.rotate(this.piece.matrix, -dir);
                this.piece.pos.x = pos;
                return;
            }
        }
        this.soundRotate();
    }

    rotate(matrix, dir) {
        for (let y = 0; y < matrix.length; ++y) {
            for (let x = 0; x < y; ++x) [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
        }
        if (dir > 0) matrix.forEach(row => row.reverse());
        else matrix.reverse();
    }

    playerReset() {
        this.piece = this.nextPiece;
        this.nextPiece = this.generatePiece();
        if (this.collide()) {
            this.isGameOver = true;
            this.soundGameOver();
            this.shadowRoot.querySelector('#game-over').classList.add('visible');
        }
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
            this.soundClear();
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

    updateScore() {
        this.shadowRoot.querySelector('#score-val').innerText = this.score;
        this.shadowRoot.querySelector('#combo-val').innerText = this.combo;
    }

    update(time = 0) {
        if (this.isGameOver) return;
        const deltaTime = time - this.lastTime;
        this.lastTime = time;
        this.dropCounter += deltaTime;
        if (this.dropCounter > this.dropInterval) this.playerDrop();
        this.draw();
        requestAnimationFrame(this.update.bind(this));
    }

    restart() {
        this.resetInternalState();
        this.shadowRoot.querySelector('#game-over').classList.remove('visible');
        this.updateScore();
        this.update();
    }

    addEventListeners() {
        document.addEventListener('keydown', e => {
            if (this.isGameOver) return;
            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
            if (e.keyCode === 37) this.playerMove(-1);
            else if (e.keyCode === 39) this.playerMove(1);
            else if (e.keyCode === 40) this.playerDrop();
            else if (e.keyCode === 38) this.playerRotate(1);
        });
        this.shadowRoot.querySelector('#btn-left').onclick = (e) => { e.preventDefault(); this.playerMove(-1); };
        this.shadowRoot.querySelector('#btn-right').onclick = (e) => { e.preventDefault(); this.playerMove(1); };
        this.shadowRoot.querySelector('#btn-down').onclick = (e) => { e.preventDefault(); this.playerDrop(); };
        this.shadowRoot.querySelector('#btn-up').onclick = (e) => { e.preventDefault(); this.playerRotate(1); };
        this.shadowRoot.querySelector('#restart-btn').onclick = () => this.restart();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host { display: flex; flex-direction: column; align-items: center; background: #050505; padding: 10px; border-radius: 20px; user-select: none; touch-action: none; font-family: 'Orbitron', sans-serif; color: white; width: fit-content; margin: auto; }
                .game-layout { display: flex; gap: 10px; align-items: flex-start; }
                .main-board { position: relative; }
                #game-canvas { border: 2px solid #333; background: #000; border-radius: 4px; }
                .side-panel { display: flex; flex-direction: column; gap: 8px; width: 70px; }
                .panel-box { background: #111; padding: 5px; border-radius: 8px; border: 1px solid #222; text-align: center; }
                .label { color: #666; font-size: 7px; margin-bottom: 2px; letter-spacing: 1px; }
                .value { color: white; font-size: 12px; text-shadow: 0 0 10px oklch(60% 0.2 250); }
                #next-canvas { background: #000; border-radius: 2px; width: 100%; }
                #combo-text { position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%); color: oklch(70% 0.3 150); font-size: 1.2rem; font-weight: bold; pointer-events: none; opacity: 0; z-index: 5; }
                #combo-text.pop { opacity: 1; transform: translate(-50%, -60%) scale(1.2); }
                #game-over { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 4px; opacity: 0; pointer-events: none; transition: opacity 0.5s; z-index: 10; }
                #game-over.visible { opacity: 1; pointer-events: auto; }
                #restart-btn { padding: 8px 16px; background: oklch(60% 0.2 250); color: white; border: none; border-radius: 4px; cursor: pointer; }
                .controls-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px; }
                .mobile-btn { width: 40px; height: 40px; background: oklch(25% 0.05 250); color: white; border: 1px solid #333; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; cursor: pointer; }
                .mobile-btn:active { background: oklch(40% 0.1 250); transform: scale(0.9); }
                @media (max-width: 600px) {
                    .game-layout { flex-direction: column; align-items: center; }
                    .side-panel { flex-direction: row; width: 100%; justify-content: space-around; margin-bottom: 5px; }
                    .side-panel .panel-box { flex: 1; }
                }
                @media (min-width: 1024px) { .controls-grid { display: none; } }
            </style>
            <div class="game-layout">
                <div class="side-panel">
                    <div class="panel-box"><div class="label">NEXT</div><canvas id="next-canvas"></canvas></div>
                    <div class="panel-box"><div class="label">SCORE</div><div class="value" id="score-val">0</div></div>
                    <div class="panel-box"><div class="label">COMBO</div><div class="value" id="combo-val">0</div></div>
                </div>
                <div class="main-board">
                    <canvas id="game-canvas"></canvas>
                    <div id="combo-text">COMBO!</div>
                    <div id="game-over"><h2>OVER</h2><button id="restart-btn">RESTART</button></div>
                </div>
            </div>
            <div class="controls-grid">
                <div class="mobile-btn" style="grid-column: 2" id="btn-up">↑</div>
                <div class="mobile-btn" style="grid-column: 1; grid-row: 2" id="btn-left">←</div>
                <div class="mobile-btn" style="grid-column: 2; grid-row: 2" id="btn-down">↓</div>
                <div class="mobile-btn" style="grid-column: 3; grid-row: 2" id="btn-right">→</div>
            </div>
        `;
    }
}
customElements.define('tetris-game', TetrisGame);
