class AIEvolution2048 {
    constructor() {
        this.grid = Array(4).fill().map(() => Array(4).fill(0));
        this.score = 0;
        this.bestScore = parseInt(localStorage.getItem('ai_evolution_best')) || 0;
        this.undoBuffer = null;
        this.maxTileReached = 2;
        this.isGameOver = false;
        this.tileMap = {
            2: "Data", 4: "Algorithm", 8: "Model", 16: "Neural Net",
            32: "Deep Learning", 64: "Transformer", 128: "LLM", 256: "AGI",
            512: "Super AI", 1024: "Singularity", 2048: "AI Overlord"
        };
        this.init();
    }

    init() {
        this.tileLayer = document.getElementById('tile-layer');
        this.scoreElem = document.getElementById('current-score');
        this.bestElem = document.getElementById('best-score');
        this.undoBtn = document.getElementById('undo-btn');
        this.statusMsg = document.getElementById('status-message');
        this.modal = document.getElementById('game-over-modal');
        
        this.bestElem.innerText = this.bestScore;
        this.setupEvents();
        this.newGame();
    }

    setupEvents() {
        document.addEventListener('keydown', (e) => {
            if (this.isGameOver) return;
            const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
            if (map[e.key]) {
                e.preventDefault();
                this.move(map[e.key]);
            }
        });

        let tsX, tsY;
        document.addEventListener('touchstart', (e) => {
            tsX = e.touches[0].clientX;
            tsY = e.touches[0].clientY;
        }, { passive: false });

        document.addEventListener('touchend', (e) => {
            if (this.isGameOver || !tsX || !tsY) return;
            const dx = e.changedTouches[0].clientX - tsX;
            const dy = e.changedTouches[0].clientY - tsY;
            if (Math.abs(dx) > 30 || Math.abs(dy) > 30) {
                if (Math.abs(dx) > Math.abs(dy)) this.move(dx > 0 ? 'right' : 'left');
                else this.move(dy > 0 ? 'down' : 'up');
            }
            tsX = tsY = null;
        }, { passive: false });

        document.getElementById('new-game-btn').onclick = () => this.newGame();
        document.getElementById('restart-btn').onclick = () => { this.modal.classList.add('hidden'); this.newGame(); };
        document.getElementById('undo-btn').onclick = () => this.undo();
        document.getElementById('share-btn').onclick = () => this.share();
        document.getElementById('modal-share-btn').onclick = () => this.share();
    }

    newGame() {
        this.grid = Array(4).fill().map(() => Array(4).fill(0));
        this.score = 0;
        this.undoBuffer = null;
        this.maxTileReached = 2;
        this.isGameOver = false;
        this.updateScore(0);
        this.undoBtn.disabled = true;
        this.statusMsg.innerText = "";
        this.addRandomTile();
        this.addRandomTile();
        this.render();
    }

    addRandomTile() {
        const empty = [];
        for (let r = 0; r < 4; r++)
            for (let c = 0; c < 4; c++)
                if (this.grid[r][c] === 0) empty.push({ r, c });
        if (empty.length > 0) {
            const { r, c } = empty[Math.floor(Math.random() * empty.length)];
            this.grid[r][c] = Math.random() < 0.9 ? 2 : 4;
        }
    }

    move(dir) {
        const prevGrid = JSON.stringify(this.grid);
        const prevScore = this.score;
        
        const rotate = (g) => g[0].map((_, i) => g.map(row => row[i]).reverse());
        let temp = JSON.parse(prevGrid);

        const slide = (row) => {
            let filtered = row.filter(v => v !== 0);
            for (let i = 0; i < filtered.length - 1; i++) {
                if (filtered[i] === filtered[i + 1]) {
                    filtered[i] *= 2;
                    this.score += filtered[i];
                    filtered.splice(i + 1, 1);
                    if (filtered[i] > this.maxTileReached) this.notifyEvolution(filtered[i]);
                }
            }
            while (filtered.length < 4) filtered.push(0);
            return filtered;
        };

        if (dir === 'up') { temp = rotate(rotate(rotate(temp))).map(slide); temp = rotate(temp); }
        else if (dir === 'down') { temp = rotate(temp).map(slide); temp = rotate(rotate(rotate(temp))); }
        else if (dir === 'right') { temp = temp.map(r => slide(r.reverse()).reverse()); }
        else { temp = temp.map(slide); }

        if (JSON.stringify(temp) !== prevGrid) {
            this.undoBuffer = { grid: JSON.parse(prevGrid), score: prevScore };
            this.undoBtn.disabled = false;
            this.grid = temp;
            this.addRandomTile();
            this.updateScore(this.score);
            this.render();
            if (this.checkGameOver()) this.endGame();
        }
    }

    undo() {
        if (!this.undoBuffer) return;
        this.grid = this.undoBuffer.grid;
        this.score = this.undoBuffer.score;
        this.undoBuffer = null;
        this.undoBtn.disabled = true;
        this.updateScore(this.score);
        this.render();
    }

    updateScore(s) {
        this.score = s;
        this.scoreElem.innerText = this.score;
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            this.bestElem.innerText = this.bestScore;
            localStorage.setItem('ai_evolution_best', this.bestScore);
        }
    }

    notifyEvolution(val) {
        this.maxTileReached = val;
        this.statusMsg.innerText = `Evolution Reached: ${this.tileMap[val]}!`;
        setTimeout(() => { if (this.statusMsg.innerText.includes(this.tileMap[val])) this.statusMsg.innerText = ""; }, 2000);
    }

    render() {
        this.tileLayer.innerHTML = '';
        this.grid.forEach((row, r) => {
            row.forEach((val, c) => {
                if (val !== 0) {
                    const tile = document.createElement('div');
                    tile.className = `tile tile-${val} tile-new`;
                    tile.style.top = `${r * 25}%`;
                    tile.style.left = `${c * 25}%`;
                    tile.innerText = this.tileMap[val] || val;
                    this.tileLayer.appendChild(tile);
                }
            });
        });
    }

    checkGameOver() {
        for (let r = 0; r < 4; r++)
            for (let c = 0; c < 4; c++)
                if (this.grid[r][c] === 0) return false;
        for (let r = 0; r < 4; r++)
            for (let c = 0; c < 4; c++) {
                if (c < 3 && this.grid[r][c] === this.grid[r][c + 1]) return false;
                if (r < 3 && this.grid[r][c] === this.grid[r + 1][c]) return false;
            }
        return true;
    }

    endGame() {
        this.isGameOver = true;
        document.getElementById('final-stage-name').innerText = this.tileMap[this.maxTileReached];
        document.getElementById('final-score').innerText = this.score;
        this.modal.classList.remove('hidden');
    }

    share() {
        const text = `[AI EVOLUTION 2048]
Stage: ${this.tileMap[this.maxTileReached]}
Score: ${this.score}
Play: trackingsa.com/ai-evolution`;
        if (navigator.share) {
            navigator.share({ title: 'AI EVOLUTION 2048', text: text, url: 'https://trackingsa.com/ai-evolution' });
        } else {
            navigator.clipboard.writeText(text).then(() => alert("Result copied to clipboard!"));
        }
    }
}

window.onload = () => new AIEvolution2048();
