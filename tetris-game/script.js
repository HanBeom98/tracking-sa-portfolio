class TetrisGame extends HTMLElement {
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
            'oklch(70% 0.2 140)',  // O
            'oklch(65% 0.2 180)',  // S
            'oklch(65% 0.2 320)',  // T
            'oklch(60% 0.2 0)'     // Z
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
        this.repeatTimer = null;
        this.db = null;
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

    playNote(freq, duration, type = 'square', volume = 0.05) {
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

    connectedCallback() {
        this.render();
        this.canvas = this.shadowRoot.querySelector('#game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.nextCanvas = this.shadowRoot.querySelector('#next-canvas');
        this.nextCtx = this.nextCanvas.getContext('2d');
        this.boardArea = this.shadowRoot.querySelector('.board-area');
        
        if (window.db) this.db = window.db;

        const observer = new ResizeObserver(() => this.autoScale());
        observer.observe(this.shadowRoot.querySelector('.main-container'));
        
        this.initGame();
        this.addEventListeners();
        setTimeout(() => this.autoScale(), 50);
    }

    autoScale() {
        const rect = this.boardArea.getBoundingClientRect();
        const padding = 10;
        const availableW = rect.width - padding;
        const availableH = rect.height - padding;

        if (availableH <= 0 || availableW <= 0) return;

        let size = Math.floor(availableH / this.ROWS);
        if (size * this.COLS > availableW) {
            size = Math.floor(availableW / this.COLS);
        }

        this.BLOCK_SIZE = Math.max(size, 5);
        this.canvas.width = this.BLOCK_SIZE * this.COLS;
        this.canvas.height = this.BLOCK_SIZE * this.ROWS;
        
        this.NEXT_BLOCK_SIZE = Math.floor(this.BLOCK_SIZE * 0.6);
        this.nextCanvas.width = this.NEXT_BLOCK_SIZE * 4;
        this.nextCanvas.height = this.NEXT_BLOCK_SIZE * 4;
        this.draw();
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
        if (!this.BLOCK_SIZE || !this.ctx) return;
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
                    context.shadowBlur = size / 3;
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
        else this.playNote(150, 0.05, 'sine');
    }

    playerRotate(dir) {
        if (this.isGameOver) return;
        this.initAudio();
        this.rotate(this.piece.matrix, dir);
        if (this.collide()) this.rotate(this.piece.matrix, -dir);
        else this.playNote(300, 0.05, 'sine');
    }

    playerReset() {
        this.piece = this.nextPiece;
        this.nextPiece = this.generatePiece();
        if (this.collide()) {
            this.isGameOver = true;
            this.playNote(100, 0.8, 'sawtooth');
            this.shadowRoot.querySelector('#game-over').classList.add('visible');
            this.shadowRoot.querySelector('#final-score-val').innerText = this.score;
            this.loadRankings();
        }
    }

    async loadRankings() {
        this.db = window.db || null;
        if (!this.db) return;
        try {
            const snapshot = await this.db.collection('tetris_rankings').orderBy('score', 'desc').limit(5).get();
            const listEl = this.shadowRoot.querySelector('#rank-list');
            listEl.innerHTML = '';
            snapshot.forEach(doc => {
                const data = doc.data();
                const item = document.createElement('div');
                item.style = 'display:flex; justify-content:space-between; margin-bottom:4px; font-size:0.8rem; color:#aaa;';
                item.innerHTML = `<span>${data.nickname}</span> <span>${data.score}</span>`;
                listEl.appendChild(item);
            });
        } catch (e) { console.error(e); }
    }

    async submitScore() {
        const nickname = this.shadowRoot.querySelector('#nick-input').value.trim();
        this.db = window.db || null;
        if (!nickname || !this.db) return;
        try {
            await this.db.collection('tetris_rankings').add({
                nickname: nickname,
                score: this.score,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            this.shadowRoot.querySelector('#nick-input').disabled = true;
            this.shadowRoot.querySelector('#submit-btn').disabled = true;
            this.loadRankings();
        } catch (e) { console.error(e); }
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
            this.playNote(400 + (this.combo * 100), 0.2);
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
        this.shadowRoot.querySelectorAll('.score-val').forEach(el => el.innerText = this.score);
        this.shadowRoot.querySelectorAll('.combo-val').forEach(el => el.innerText = this.combo);
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
        this.shadowRoot.querySelector('#nick-input').disabled = false;
        this.shadowRoot.querySelector('#nick-input').value = '';
        this.shadowRoot.querySelector('#submit-btn').disabled = false;
        this.updateScore();
        this.update();
    }

    startRepeat(action) {
        this.stopRepeat();
        action();
        this.repeatTimer = setInterval(action, 80);
    }

    stopRepeat() {
        if (this.repeatTimer) { clearInterval(this.repeatTimer); this.repeatTimer = null; }
    }

    addEventListeners() {
        document.addEventListener('keydown', e => {
            if (this.isGameOver) return;
            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
            if (e.keyCode === 37) this.playerMove(-1);
            else if (e.keyCode === 39) this.playerMove(1);
            else if (e.keyCode === 40) this.playerDrop();
            else if (e.keyCode === 38) this.playerRotate(1);
        });

        const handleTouch = (id, action, isRepeat = true) => {
            const el = this.shadowRoot.querySelector(`#${id}`);
            el.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (isRepeat) this.startRepeat(action); else action();
            });
            el.addEventListener('touchend', () => this.stopRepeat());
            el.addEventListener('touchcancel', () => this.stopRepeat());
        };

        handleTouch('btn-left', () => this.playerMove(-1));
        handleTouch('btn-right', () => this.playerMove(1));
        handleTouch('btn-down', () => this.playerDrop());
        handleTouch('btn-up', () => this.playerRotate(1), false);

        this.shadowRoot.querySelector('#restart-btn').onclick = () => this.restart();
        this.shadowRoot.querySelector('#submit-btn').onclick = () => this.submitScore();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; height: 100%; width: 100%; font-family: 'Orbitron', sans-serif; color: white; user-select: none; background: #050505; overflow: hidden; }
                .main-container { display: flex; flex-direction: column; height: 100%; width: 100%; }
                
                /* [Desktop Layout] */
                @media (min-width: 1024px) {
                    .main-container { flex-direction: row; align-items: center; justify-content: center; gap: 40px; padding: 20px; }
                    .side-panel { display: flex; flex-direction: column; gap: 20px; width: 150px; }
                    .mobile-hud, .controls { display: none; }
                }

                /* [Mobile Layout] */
                @media (max-width: 1023px) {
                    .side-panel { display: none; }
                    .mobile-hud { height: 50px; display: flex; justify-content: space-between; align-items: center; background: #111; padding: 0 15px; border-bottom: 1px solid #333; flex-shrink: 0; }
                    .controls { height: 200px; display: flex; justify-content: center; align-items: center; background: #0a0a0a; border-top: 1px solid #222; flex-shrink: 0; }
                }

                .hud-item { display: flex; align-items: center; gap: 10px; }
                .hud-label { font-size: 10px; color: #666; }
                .hud-value { font-size: 16px; font-weight: bold; color: #fff; }
                #next-canvas { width: 35px; height: 35px; background: #000; border-radius: 4px; }

                .board-area { flex: 1; position: relative; display: flex; justify-content: center; align-items: center; min-height: 0; background: #000; }
                #game-canvas { border: 2px solid #444; background: #000; box-shadow: 0 0 30px rgba(0,0,0,0.8); border-radius: 4px; }

                .panel-box { background: #111; padding: 15px; border-radius: 12px; border: 1px solid #333; text-align: center; }

                #combo-text { position: absolute; top: 20%; color: oklch(70% 0.3 150); font-size: 2rem; font-weight: bold; pointer-events: none; opacity: 0; z-index: 5; text-shadow: 0 0 15px currentColor; }
                #combo-text.pop { opacity: 1; animation: pop 0.5s ease-out; }
                @keyframes pop { 0% { transform: scale(0.5); opacity: 0; } 50% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(1); opacity: 0; } }

                #game-over { position: absolute; inset: 0; background: rgba(0,0,0,0.95); display: none; flex-direction: column; align-items: center; justify-content: center; z-index: 10; padding: 20px; }
                #game-over.visible { display: flex; }

                /* [D-PAD 스타일 컨트롤러] */
                .d-pad { display: grid; grid-template-columns: repeat(3, 70px); grid-template-rows: repeat(2, 70px); gap: 10px; }
                .mobile-btn { width: 70px; height: 70px; background: oklch(30% 0.05 250); border: 2px solid #444; border-radius: 12px; color: white; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; box-shadow: 0 4px 0 #000; }
                .mobile-btn:active { background: oklch(45% 0.1 250); transform: translateY(4px); box-shadow: none; }
            </style>
            <div class="main-container">
                <!-- Mobile HUD (Top) -->
                <div class="mobile-hud">
                    <div class="hud-item"><div class="hud-label">NEXT</div><canvas id="next-canvas"></canvas></div>
                    <div class="hud-item"><div class="hud-label">SCORE</div><div class="hud-value score-val">0</div></div>
                    <div class="hud-item"><div class="hud-label">COMBO</div><div class="hud-value combo-val">0</div></div>
                </div>

                <!-- Desktop Left -->
                <div class="side-panel">
                    <div class="panel-box"><div class="hud-label">SCORE</div><div class="hud-value score-val">0</div></div>
                    <div class="panel-box"><div class="hud-label">COMBO</div><div class="hud-value combo-val">0</div></div>
                </div>

                <!-- Game Board -->
                <div class="board-area">
                    <canvas id="game-canvas"></canvas>
                    <div id="combo-text">COMBO!</div>
                    <div id="game-over">
                        <h2 style="color:red; margin-bottom:10px;">GAME OVER</h2>
                        <div style="font-size:2rem; margin-bottom:20px;"><span id="final-score-val">0</span></div>
                        <div id="rank-list" style="width:180px; margin-bottom:20px;"></div>
                        <input type="text" id="nick-input" placeholder="NICKNAME" maxlength="10" style="padding:10px; background:#111; border:1px solid #444; color:white; width:150px; text-align:center; margin-bottom:15px; font-family:inherit;">
                        <div style="display:flex; gap:10px;">
                            <button id="submit-btn" style="padding:12px 24px; background:oklch(65% 0.2 150); border:none; border-radius:8px; font-weight:bold; cursor:pointer;">SAVE</button>
                            <button id="restart-btn" style="padding:12px 24px; background:oklch(60% 0.2 250); color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">RETRY</button>
                        </div>
                    </div>
                </div>

                <!-- Desktop Right -->
                <div class="side-panel">
                    <div class="panel-box"><div class="hud-label">NEXT</div><canvas id="next-canvas-desktop" style="width:60px; height:60px; background:#000; border-radius:8px;"></canvas></div>
                </div>

                <!-- Mobile Controls (Bottom) -->
                <div class="controls">
                    <div class="d-pad">
                        <div class="mobile-btn" id="btn-left" style="grid-column: 1; grid-row: 2">←</div>
                        <div class="mobile-btn" id="btn-up" style="grid-column: 2; grid-row: 1">↑</div>
                        <div class="mobile-btn" id="btn-down" style="grid-column: 2; grid-row: 2">↓</div>
                        <div class="mobile-btn" id="btn-right" style="grid-column: 3; grid-row: 2">→</div>
                    </div>
                </div>
            </div>
        `;
        // Desktop 전용 미리보기 캔버스를 위해 참조 업데이트
        const desktopNext = this.shadowRoot.querySelector('#next-canvas-desktop');
        if (desktopNext) {
            this.nextCanvas = desktopNext;
            this.nextCtx = desktopNext.getContext('2d');
        }
    }
}
customElements.define('tetris-game', TetrisGame);
