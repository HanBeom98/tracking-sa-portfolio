class TetrisGame extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.COLS = 10;
        this.ROWS = 20;
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
        this.repeatTimer = null;
        this.db = null; // Firestore 참조
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

    connectedCallback() {
        this.render();
        this.canvas = this.shadowRoot.querySelector('#game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.nextCanvas = this.shadowRoot.querySelector('#next-canvas');
        this.nextCtx = this.nextCanvas.getContext('2d');
        this.boardContainer = this.shadowRoot.querySelector('.main-board');
        
        // Firestore 초기화 (firebase-config.js가 전역에 로드되어 있어야 함)
        if (window.db) {
            this.db = window.db;
        }

        const observer = new ResizeObserver(() => this.autoScale());
        observer.observe(this.boardContainer);
        
        this.initGame();
        this.addEventListeners();
    }

    autoScale() {
        const rect = this.boardContainer.getBoundingClientRect();
        const padding = 10;
        const availableW = rect.width - padding;
        const availableH = rect.height - padding;

        let size = Math.floor(availableH / this.ROWS);
        const maxWidthSize = Math.floor(Math.min(availableW, 350) / this.COLS);
        if (size > maxWidthSize) size = maxWidthSize;

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
        if (!this.BLOCK_SIZE) return;
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
            this.showGameOverUI();
        }
    }

    showGameOverUI() {
        const ui = this.shadowRoot.querySelector('#game-over');
        this.shadowRoot.querySelector('#final-score').innerText = this.score;
        ui.classList.add('visible');
        this.loadRankings();
    }

    async loadRankings() {
        if (!this.db) return;
        try {
            const snapshot = await this.db.collection('tetris_rankings')
                .orderBy('score', 'desc')
                .limit(5)
                .get();
            
            const listEl = this.shadowRoot.querySelector('#rank-list');
            listEl.innerHTML = '';
            snapshot.forEach(doc => {
                const data = doc.data();
                const item = document.createElement('div');
                item.className = 'rank-item';
                item.innerHTML = `<span>${data.nickname}</span> <span>${data.score}</span>`;
                listEl.appendChild(item);
            });
        } catch (e) {
            console.error("Error loading rankings:", e);
        }
    }

    async submitScore() {
        const nickname = this.shadowRoot.querySelector('#nick-input').value.trim();
        if (!nickname || !this.db) {
            alert("닉네임을 입력해주세요!");
            return;
        }

        try {
            await this.db.collection('tetris_rankings').add({
                nickname: nickname,
                score: this.score,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            this.shadowRoot.querySelector('#nick-input').disabled = true;
            this.shadowRoot.querySelector('#submit-btn').disabled = true;
            this.shadowRoot.querySelector('#submit-btn').innerText = "DONE";
            this.loadRankings();
        } catch (e) {
            console.error("Error saving score:", e);
            alert("점수 등록에 실패했습니다.");
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
        this.shadowRoot.querySelector('#nick-input').disabled = false;
        this.shadowRoot.querySelector('#nick-input').value = '';
        this.shadowRoot.querySelector('#submit-btn').disabled = false;
        this.shadowRoot.querySelector('#submit-btn').innerText = "REGISTER";
        this.updateScore();
        this.update();
    }

    startRepeat(action) {
        this.stopRepeat();
        action();
        this.repeatTimer = setInterval(action, 100);
    }

    stopRepeat() {
        if (this.repeatTimer) {
            clearInterval(this.repeatTimer);
            this.repeatTimer = null;
        }
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
                if (isRepeat) this.startRepeat(action);
                else action();
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
                :host { display: flex; flex-direction: column; height: 100%; width: 100%; box-sizing: border-box; font-family: 'Orbitron', sans-serif; color: white; user-select: none; }
                .game-container { display: flex; flex-direction: column; height: 100%; width: 100%; gap: 5px; padding: 5px; }
                
                .top-panel { display: flex; justify-content: space-around; background: rgba(20,20,20,0.8); padding: 8px; border-radius: 12px; border: 1px solid #333; }
                .panel-box { text-align: center; flex: 1; }
                .label { color: #888; font-size: 10px; letter-spacing: 1px; margin-bottom: 2px; }
                .value { color: #fff; font-size: 16px; font-weight: bold; }
                .preview-box { width: 40px; height: 40px; margin: auto; }
                
                .main-board { flex: 1; position: relative; display: flex; justify-content: center; align-items: center; min-height: 0; padding: 5px; }
                #game-canvas { border: 3px solid #444; background: #000; border-radius: 8px; max-height: 100%; max-width: 100%; box-shadow: 0 0 20px rgba(0,0,0,0.5); }
                
                #combo-text { position: absolute; top: 20%; color: oklch(70% 0.3 150); font-size: 2rem; font-weight: bold; pointer-events: none; opacity: 0; z-index: 5; text-shadow: 0 0 15px currentColor; }
                #combo-text.pop { opacity: 1; animation: pop 0.5s ease-out; }
                @keyframes pop { 0% { transform: scale(0.5); opacity: 0; } 50% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(1); opacity: 0; } }
                
                /* [Game Over & Ranking UI] */
                #game-over { 
                    position: absolute; inset: 0; 
                    background: rgba(0,0,0,0.95); 
                    display: none; flex-direction: column; 
                    align-items: center; justify-content: center; 
                    z-index: 10; border-radius: 8px; 
                    padding: 20px;
                    text-align: center;
                }
                #game-over.visible { display: flex; }
                #game-over h2 { color: oklch(60% 0.2 20); font-size: 1.5rem; margin: 0 0 10px 0; }
                .score-display { font-size: 2rem; color: #fff; margin-bottom: 20px; }
                
                .ranking-section { width: 100%; max-width: 200px; margin-bottom: 20px; border-top: 1px solid #333; padding-top: 15px; }
                .ranking-title { font-size: 0.8rem; color: #888; margin-bottom: 10px; }
                .rank-item { display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 5px; color: #ccc; }
                
                .registration { display: flex; flex-direction: column; gap: 10px; width: 100%; max-width: 200px; }
                #nick-input { 
                    padding: 8px; background: #111; border: 1px solid #444; 
                    color: white; border-radius: 4px; text-align: center; 
                    font-family: inherit; font-size: 0.9rem;
                }
                .btn-group { display: flex; gap: 10px; width: 100%; }
                .action-btn { flex: 1; padding: 10px; border: none; border-radius: 4px; cursor: pointer; font-family: inherit; font-weight: bold; font-size: 0.8rem; }
                #submit-btn { background: oklch(65% 0.2 150); color: black; }
                #restart-btn { background: oklch(60% 0.2 250); color: white; }
                .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }

                /* [에르고노믹 조이스틱] */
                .controls-grid { 
                    display: grid; 
                    grid-template-columns: repeat(3, 1fr); 
                    grid-template-rows: repeat(2, 60px);
                    gap: 20px;
                    padding: 15px 20px 25px 20px; 
                    justify-items: center;
                    background: rgba(10,10,10,0.5);
                    border-top: 1px solid #222;
                }
                .mobile-btn { 
                    width: 60px; height: 60px; 
                    background: oklch(35% 0.1 250 / 0.8); 
                    border: 2px solid #444; 
                    border-radius: 50%; 
                    color: white; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    font-size: 1.8rem; 
                    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
                }
                .mobile-btn:active { background: oklch(50% 0.2 250); transform: scale(0.9); }
                
                @media (min-width: 1024px) { .controls-grid { display: none; } }
            </style>
            <div class="game-container">
                <div class="top-panel">
                    <div class="panel-box"><div class="label">NEXT</div><canvas id="next-canvas" class="preview-box"></canvas></div>
                    <div class="panel-box"><div class="label">SCORE</div><div class="value" id="score-val">0</div></div>
                    <div class="panel-box"><div class="label">COMBO</div><div class="value" id="combo-val">0</div></div>
                </div>
                <div class="main-board">
                    <canvas id="game-canvas"></canvas>
                    <div id="combo-text">COMBO!</div>
                    <div id="game-over">
                        <h2>GAME OVER</h2>
                        <div class="score-display" id="final-score">0</div>
                        
                        <div class="ranking-section">
                            <div class="ranking-title">TOP 5 RANKING</div>
                            <div id="rank-list">
                                <!-- Rankings injected here -->
                            </div>
                        </div>

                        <div class="registration">
                            <input type="text" id="nick-input" placeholder="NICKNAME" maxlength="10">
                            <div class="btn-group">
                                <button id="submit-btn" class="action-btn">REGISTER</button>
                                <button id="restart-btn" class="action-btn">RETRY</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="controls-grid">
                    <div class="mobile-btn" style="grid-column: 2" id="btn-up">↑</div>
                    <div class="mobile-btn" style="grid-column: 1; grid-row: 2" id="btn-left">←</div>
                    <div class="mobile-btn" style="grid-column: 2; grid-row: 2" id="btn-down">↓</div>
                    <div class="mobile-btn" style="grid-column: 3; grid-row: 2" id="btn-right">→</div>
                </div>
            </div>
        `;
    }
}
customElements.define('tetris-game', TetrisGame);
