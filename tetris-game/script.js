class TetrisGame extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.COLS = 10;
        this.ROWS = 20;
        this.COLORS = [
            null,
            'oklch(65% 0.25 250)', // I (Cyan)
            'oklch(60% 0.2 60)',   // J (Blue)
            'oklch(60% 0.2 30)',   // L (Orange)
            'oklch(70% 0.2 140)',  // O (Yellow)
            'oklch(65% 0.2 180)',  // S (Green)
            'oklch(65% 0.2 320)',  // T (Purple)
            'oklch(60% 0.2 0)'     // Z (Red)
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
        this.boardWrapper = this.shadowRoot.querySelector('.main-board');
        this.flashOverlay = this.shadowRoot.querySelector('.flash-overlay');
        
        this.db = window.db || null;

        const observer = new ResizeObserver(() => this.resizeCanvas());
        observer.observe(this.shadowRoot.querySelector('.game-layout'));
        
        this.initGame();
        this.addEventListeners();
        setTimeout(() => this.resizeCanvas(), 50);
    }

    resizeCanvas() {
        if (!this.boardWrapper) return;
        const rect = this.boardWrapper.getBoundingClientRect();
        const padding = 20;
        const availableW = rect.width - padding;
        const availableH = rect.height - padding;

        if (availableH <= 0 || availableW <= 0) return;

        let size = Math.floor(availableH / this.ROWS);
        if (size * this.COLS > availableW) {
            size = Math.floor(availableW / this.COLS);
        }

        this.BLOCK_SIZE = Math.max(size, 10);
        this.canvas.width = this.BLOCK_SIZE * this.COLS;
        this.canvas.height = this.BLOCK_SIZE * this.ROWS;
        
        this.NEXT_BLOCK_SIZE = Math.floor(this.BLOCK_SIZE * 0.8);
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

    // [New] Ghost Piece 위치 계산
    getGhostPos() {
        const ghost = { pos: { ...this.piece.pos }, matrix: this.piece.matrix };
        while (!this.collide(ghost)) {
            ghost.pos.y++;
        }
        ghost.pos.y--;
        return ghost.pos;
    }

    draw() {
        if (!this.BLOCK_SIZE || !this.ctx) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 1. 보드 배경 격자 (Subtle Grid)
        this.ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        this.ctx.lineWidth = 1;
        for(let i=0; i<=this.COLS; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(i*this.BLOCK_SIZE, 0);
            this.ctx.lineTo(i*this.BLOCK_SIZE, this.canvas.height);
            this.ctx.stroke();
        }
        for(let i=0; i<=this.ROWS; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, i*this.BLOCK_SIZE);
            this.ctx.lineTo(this.canvas.width, i*this.BLOCK_SIZE);
            this.ctx.stroke();
        }

        // 2. 쌓인 블록들
        this.drawMatrix(this.board, { x: 0, y: 0 }, this.ctx, this.BLOCK_SIZE);
        
        // 3. 고스트 블록 (반투명)
        const gPos = this.getGhostPos();
        this.drawMatrix(this.piece.matrix, gPos, this.ctx, this.BLOCK_SIZE, true);

        // 4. 현재 조작 블록
        this.drawMatrix(this.piece.matrix, this.piece.pos, this.ctx, this.BLOCK_SIZE);

        // 5. 다음 블록 미리보기
        this.nextCtx.fillStyle = 'rgba(0,0,0,0.3)';
        this.nextCtx.fillRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
        const nx = (4 - this.nextPiece.matrix[0].length) / 2;
        const ny = (4 - this.nextPiece.matrix.length) / 2;
        this.drawMatrix(this.nextPiece.matrix, { x: nx, y: ny }, this.nextCtx, this.NEXT_BLOCK_SIZE);
    }

    // [Upgrade] Bevel & Gradient 효과가 적용된 블록 렌더링
    drawMatrix(matrix, offset, context, size, isGhost = false) {
        matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    const bx = (x + offset.x) * size;
                    const by = (y + offset.y) * size;
                    const color = this.COLORS[value];

                    if (isGhost) {
                        context.strokeStyle = color.replace('oklch(', 'oklch(40% '); // 채도/명도 낮춤
                        context.setLineDash([2, 2]);
                        context.strokeRect(bx + 2, by + 2, size - 4, size - 4);
                        context.setLineDash([]);
                        return;
                    }

                    // 블록 본체 그라데이션
                    const grad = context.createLinearGradient(bx, by, bx + size, by + size);
                    grad.addColorStop(0, color);
                    grad.addColorStop(1, color.replace('oklch(', 'oklch(40% '));
                    context.fillStyle = grad;
                    context.shadowBlur = size / 4;
                    context.shadowColor = color;
                    context.fillRect(bx, by, size - 1, size - 1);
                    context.shadowBlur = 0;

                    // Bevel 효과 (하이라이트)
                    context.fillStyle = 'rgba(255,255,255,0.3)';
                    context.fillRect(bx, by, size - 1, 2); // 상단
                    context.fillRect(bx, by, 2, size - 1); // 좌측

                    // Bevel 효과 (그림자)
                    context.fillStyle = 'rgba(0,0,0,0.2)';
                    context.fillRect(bx, by + size - 3, size - 1, 2); // 하단
                    context.fillRect(bx + size - 3, by, 2, size - 1); // 우측
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
                item.style = 'display:flex; justify-content:space-between; margin-bottom:6px; font-size:0.85rem; color:#ccc; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:2px;';
                item.innerHTML = `<span>${data.nickname}</span> <span style="color:oklch(70% 0.2 150)">${data.score}</span>`;
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
            this.shadowRoot.querySelector('#submit-btn').innerText = "OK";
            this.loadRankings();
        } catch (e) { console.error(e); }
    }

    collide(customPiece) {
        const p = customPiece || this.piece;
        const [m, o] = [p.matrix, p.pos];
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
            this.triggerFlash();
            this.showComboEffect();
        } else { this.combo = 0; }
    }

    triggerFlash() {
        this.flashOverlay.classList.add('active');
        setTimeout(() => this.flashOverlay.classList.remove('active'), 150);
    }

    showComboEffect() {
        const comboEl = this.shadowRoot.querySelector('#combo-text');
        if (this.combo > 1) {
            comboEl.innerText = `COMBO X${this.combo}`;
            comboEl.classList.add('pop');
            setTimeout(() => comboEl.classList.remove('pop'), 600);
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
        this.shadowRoot.querySelector('#submit-btn').innerText = "SAVE";
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
            if (!el) return;
            el.addEventListener('touchstart', (e) => {
                if (e.cancelable) e.preventDefault();
                if (isRepeat) this.startRepeat(action); else action();
            }, { passive: false });
            el.addEventListener('touchend', (e) => {
                if (e.cancelable) e.preventDefault();
                this.stopRepeat();
            }, { passive: false });
            el.addEventListener('touchcancel', () => this.stopRepeat(), { passive: false });
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
                :host { 
                    display: block; height: 100%; width: 100%; font-family: 'Orbitron', sans-serif; color: white; user-select: none; 
                    background: radial-gradient(circle at center, oklch(20% 0.05 250), #000), 
                                url('data:image/svg+xml,<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.65" stitchTiles="stitch" /></filter><rect width="100%" height="100%" filter="url(%23n)" opacity="0.05"/></svg>');
                    overflow: hidden; 
                }
                .game-layout { display: flex; flex-direction: column; height: 100%; width: 100%; padding: 15px; box-sizing: border-box; }
                
                .game-main { flex: 1; display: flex; gap: 30px; align-items: center; justify-content: center; min-height: 0; }
                
                /* [Glassmorphism Board] */
                .main-board { 
                    position: relative; height: 100%; display: flex; align-items: center; justify-content: center; 
                    background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); 
                    backdrop-filter: blur(5px); padding: 10px; box-shadow: 0 20px 50px rgba(0,0,0,0.5);
                }
                #game-canvas { border: 2px solid rgba(255,255,255,0.1); background: #000; border-radius: 4px; }
                
                .side-panel { display: flex; flex-direction: column; gap: 20px; width: 140px; }
                .panel-box { 
                    background: rgba(20, 20, 30, 0.6); padding: 15px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); 
                    text-align: center; backdrop-filter: blur(15px); box-shadow: inset 0 0 20px rgba(255,255,255,0.02);
                }
                .label { color: #888; font-size: 11px; margin-bottom: 8px; letter-spacing: 2px; font-weight: 300; }
                .value { color: white; font-size: 24px; font-weight: bold; text-shadow: 0 0 15px oklch(60% 0.2 150); }
                #next-canvas { background: transparent; border-radius: 4px; margin: auto; }

                /* [Effects] */
                .flash-overlay { position: absolute; inset: 0; background: white; opacity: 0; pointer-events: none; transition: 0.1s; border-radius: 12px; z-index: 2; }
                .flash-overlay.active { opacity: 0.3; }

                #combo-text { 
                    position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%); color: oklch(75% 0.3 150); 
                    font-size: 2.5rem; font-weight: 900; pointer-events: none; opacity: 0; z-index: 5; text-shadow: 0 0 20px currentColor; 
                }
                #combo-text.pop { opacity: 1; animation: popScale 0.6s cubic-bezier(0.17, 0.89, 0.32, 1.49); }
                @keyframes popScale { 0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; } 50% { transform: translate(-50%, -60%) scale(1.3); opacity: 1; } 100% { transform: translate(-50%, -70%) scale(1); opacity: 0; } }

                #game-over { 
                    position: absolute; inset: 0; background: rgba(0,0,0,0.9); display: none; flex-direction: column; align-items: center; 
                    justify-content: center; z-index: 10; border-radius: 12px; text-align: center; padding: 25px; backdrop-filter: blur(10px);
                }
                #game-over.visible { display: flex; }

                /* [Premium Controller] */
                .controls { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; padding: 20px; justify-items: center; align-items: center; }
                .mobile-btn { 
                    width: 75px; height: 75px; background: linear-gradient(145deg, oklch(35% 0.05 250), oklch(25% 0.05 250)); 
                    border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; color: white; display: flex; align-items: center; 
                    justify-content: center; font-size: 2rem; cursor: pointer; box-shadow: 5px 5px 15px rgba(0,0,0,0.4), -2px -2px 10px rgba(255,255,255,0.05); 
                    transition: 0.1s;
                }
                .mobile-btn:active { 
                    transform: scale(0.92) translateY(2px); background: oklch(50% 0.2 250); 
                    box-shadow: 0 0 30px oklch(50% 0.2 250); border-color: white; 
                }

                @media (max-width: 1023px) {
                    .game-layout { padding: 10px; }
                    .game-main { flex-direction: column; gap: 10px; }
                    .side-panel { 
                        flex-direction: row; width: 100%; max-width: 450px; order: -1; gap: 8px; margin: 0 auto;
                    }
                    .side-panel .panel-box { flex: 1; padding: 8px; border-radius: 12px; }
                    .side-panel .label { font-size: 8px; margin-bottom: 2px; }
                    .side-panel .value { font-size: 18px; }
                    #next-canvas { width: 32px !important; height: 32px !important; }
                    .controls { height: 160px; grid-template-columns: repeat(3, 80px); grid-template-rows: repeat(2, 70px); gap: 15px; }
                    .mobile-btn { width: 70px; height: 70px; border-radius: 50%; }
                }

                @media (min-width: 1024px) { .controls { display: none; } }
            </style>
            <div class="game-layout">
                <div class="game-main">
                    <div class="main-board">
                        <div class="flash-overlay"></div>
                        <canvas id="game-canvas"></canvas>
                        <div id="combo-text">COMBO!</div>
                        <div id="game-over">
                            <h2 style="color:red; margin-bottom:10px; letter-spacing:4px;">GAME OVER</h2>
                            <div style="font-size:3rem; margin-bottom:20px; font-weight:900;" id="final-score-val">0</div>
                            <div id="rank-list" style="width:100%; max-width:220px; margin-bottom:20px; background:rgba(255,255,255,0.05); padding:15px; border-radius:12px;"></div>
                            <input type="text" id="nick-input" placeholder="NICKNAME" maxlength="10" style="padding:12px; background:rgba(0,0,0,0.5); border:1px solid #444; color:white; width:160px; text-align:center; margin-bottom:15px; font-family:inherit; border-radius:8px;">
                            <div style="display:flex; gap:15px;">
                                <button id="submit-btn" style="padding:12px 28px; background:oklch(65% 0.2 150); border:none; border-radius:8px; font-weight:bold; cursor:pointer; color:black;">SAVE</button>
                                <button id="restart-btn" style="padding:12px 28px; background:oklch(60% 0.2 250); color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">RETRY</button>
                            </div>
                        </div>
                    </div>
                    <div class="side-panel">
                        <div class="panel-box"><div class="label">NEXT</div><canvas id="next-canvas"></canvas></div>
                        <div class="panel-box"><div class="label">SCORE</div><div class="value score-val">0</div></div>
                        <div class="panel-box"><div class="label">COMBO</div><div class="value combo-val">0</div></div>
                    </div>
                </div>
                <div class="controls">
                    <div class="mobile-btn" style="grid-column: 2; grid-row: 1" id="btn-up">↑</div>
                    <div class="mobile-btn" style="grid-column: 1; grid-row: 2" id="btn-left">←</div>
                    <div class="mobile-btn" style="grid-column: 2; grid-row: 2" id="btn-down">↓</div>
                    <div class="mobile-btn" style="grid-column: 3; grid-row: 2" id="btn-right">→</div>
                </div>
            </div>
        `;
    }
}
customElements.define('tetris-game', TetrisGame);
