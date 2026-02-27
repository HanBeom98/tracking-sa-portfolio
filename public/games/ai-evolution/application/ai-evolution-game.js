import { fetchRankings, saveRanking } from "../infra/firebase-runtime.js";

export class AIEvolution2048 {
    constructor() {
        this.grid = Array(4).fill().map(() => Array(4).fill(0));
        this.score = 0;
        this.bestScore = parseInt(localStorage.getItem('ai_evolution_best')) || 0;
        this.undoBuffer = null;
        this.maxTileReached = 2;
        this.isGameOver = false;
        this.isMoving = false;
        
        // Audio
        this.audioCtx = null;
        this.isMuted = false;
        this.bgmNodes = [];
        this.bgmTimeout = null;
        
        this.init();
    }

    init() {
        this.tileLayer = document.getElementById('tile-layer');
        this.scoreElem = document.getElementById('current-score');
        this.bestElem = document.getElementById('best-score');
        this.undoBtn = document.getElementById('undo-btn');
        this.statusMsg = document.getElementById('status-message');
        this.modal = document.getElementById('game-over-modal');
        
        if (!this.tileLayer) {
            console.error("⚠️ [2048] Essential DOM element '#tile-layer' not found. Retrying in next frame...");
            requestAnimationFrame(() => this.init());
            return;
        }

        // Add Mute Button
        const controls = document.querySelector('.main-controls');
        if (controls && !document.getElementById('mute-btn')) {
            const muteBtn = document.createElement('button');
            muteBtn.id = 'mute-btn';
            muteBtn.className = 'action-btn';
            muteBtn.innerText = '🔊';
            muteBtn.onclick = () => this.toggleMute();
            controls.appendChild(muteBtn);
        }

        if (this.bestElem) this.bestElem.innerText = this.bestScore;
        this.setupEvents();
        this.newGame();
    }

    initAudio() {
        if (this.audioCtx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();
        this.startBGM();
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        const muteBtn = document.getElementById('mute-btn');
        if (muteBtn) muteBtn.innerText = this.isMuted ? '🔇' : '🔊';
        
        if (this.isMuted) {
            this.stopBGM();
        } else {
            this.initAudio();
            if (this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume();
            this.startBGM();
        }
    }

    playMergeSound(value) {
        if (!this.audioCtx || this.isMuted) return;
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

        const t = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        
        const notes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
        const index = Math.log2(value) - 1; 
        const freq = notes[index % notes.length] * (1 + Math.floor(index / notes.length));

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 2, t + 0.1);

        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.3);

        if (value >= 64) {
            const osc2 = this.audioCtx.createOscillator();
            const gain2 = this.audioCtx.createGain();
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(freq * 1.5, t);
            gain2.gain.setValueAtTime(0.1, t);
            gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
            osc2.connect(gain2);
            gain2.connect(this.audioCtx.destination);
            osc2.start(t);
            osc2.stop(t + 0.4);
        }
    }

    startBGM() {
        if (this.isMuted || !this.audioCtx || this.bgmNodes.length > 0) return;

        const sequence = [
            { f: 261.63, d: 0.2 }, { f: 329.63, d: 0.2 }, { f: 392.00, d: 0.2 }, { f: 493.88, d: 0.2 },
            { f: 220.00, d: 0.2 }, { f: 261.63, d: 0.2 }, { f: 329.63, d: 0.2 }, { f: 392.00, d: 0.2 }
        ];
        
        let noteIndex = 0;
        const playNextNote = () => {
            if (this.isMuted || !this.audioCtx) return;
            const t = this.audioCtx.currentTime;
            const note = sequence[noteIndex];
            
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            
            osc.type = 'sine';
            osc.frequency.value = note.f;
            
            gain.gain.setValueAtTime(0.03, t);
            gain.gain.linearRampToValueAtTime(0.01, t + note.d * 2);
            
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            
            osc.start(t);
            osc.stop(t + note.d * 2.5);
            
            this.bgmNodes.push(osc);
            if (this.bgmNodes.length > 20) this.bgmNodes.shift();

            noteIndex = (noteIndex + 1) % sequence.length;
            this.bgmTimeout = setTimeout(playNextNote, note.d * 1000);
        };
        playNextNote();
    }

    stopBGM() {
        if (this.bgmTimeout) clearTimeout(this.bgmTimeout);
        this.bgmNodes.forEach(node => {
            try { node.stop(); } catch(e) {}
        });
        this.bgmNodes = [];
    }

    getTileName(val) {
        const key = `tile_${val}`;
        const evolutionNames = {
            2: 'Data', 4: 'Algorithm', 8: 'Model', 16: 'Neural Net', 32: 'Deep Learning',
            64: 'Transformer', 128: 'LLM', 256: 'AGI', 512: 'Super AI', 1024: 'Singularity', 2048: 'AI Overlord'
        };
        return (window.translations && window.translations[window.currentLang] && window.translations[window.currentLang][key]) 
            || evolutionNames[val] || val;
    }

    setupEvents() {
        document.addEventListener('keydown', (e) => {
            if (this.isGameOver || this.isMoving) return;
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

        document.addEventListener('touchmove', (e) => {
            if (e.target.closest('#game-board-container')) e.preventDefault();
        }, { passive: false });

        document.addEventListener('touchend', (e) => {
            if (this.isGameOver || this.isMoving || !tsX || !tsY) return;
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
        this.submitBtn.onclick = () => this.submitScore();
    }

    async loadRankings() {
        if (typeof window.db === "undefined" || !window.db) {
            this.rankList.innerHTML = '<div style="text-align:center; color:#ff4444;">Ranking unavailable</div>';
            return;
        }
        try {
            this.rankList.innerHTML = '<div style="text-align:center;">Loading...</div>';
            const docs = await fetchRankings(window.db);
            this.rankList.innerHTML = docs.map(d => {
                return `<div class="rank-item"><span>${d.nickname}</span><span>${d.score}</span></div>`;
            }).join('') || '<div style="text-align:center;">No records yet</div>';
        } catch (e) {
            console.error("Ranking Load Error:", e);
            this.rankList.innerHTML = '<div style="text-align:center;">Error loading</div>';
        }
    }

    async submitScore() {
        const nick = this.nickInput.value.trim();
        if (!nick) {
            alert("Please enter a nickname.");
            return;
        }
        if (this.score === 0) return;
        if (typeof window.db === "undefined" || !window.db) {
            alert("Database connection failed.");
            return;
        }
        
        this.submitBtn.disabled = true;
        this.submitBtn.innerText = "...";
        try {
            await saveRanking(window.db, {
                nickname: nick,
                score: this.score,
                maxTile: this.maxTileReached
            });
            this.nickInput.value = "";
            this.submitBtn.innerText = "DONE";
            this.loadRankings();
        } catch (e) {
            console.error("Score Submit Error:", e);
            alert("Failed to save score: " + e.message);
            this.submitBtn.disabled = false;
            this.submitBtn.innerText = "SAVE";
        }
    }

    newGame() {
        this.grid = Array(4).fill().map(() => Array(4).fill(0));
        this.score = 0;
        this.undoBuffer = null;
        this.maxTileReached = 2;
        this.isGameOver = false;
        this.updateScoreDisplay();
        this.undoBtn.disabled = true;
        this.submitBtn.disabled = false;
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
        if (this.isMoving) return;
        this.initAudio();
        this.isMoving = true;

        const prevGrid = JSON.stringify(this.grid);
        const rotate = (g) => g[0].map((_, i) => g.map(row => row[i]).reverse());
        
        let tempGrid = JSON.parse(prevGrid);
        let moveScore = 0;
        let moveMaxTile = this.maxTileReached;

        const slide = (row) => {
            let filtered = row.filter(v => v !== 0);
            let newRow = [];
            for (let i = 0; i < filtered.length; i++) {
                if (i < filtered.length - 1 && filtered[i] === filtered[i + 1]) {
                    const newVal = filtered[i] * 2;
                    newRow.push(newVal);
                    moveScore += newVal;
                    if (newVal > moveMaxTile) moveMaxTile = newVal;
                    this.playMergeSound(newVal);
                    i++;
                } else {
                    newRow.push(filtered[i]);
                }
            }
            while (newRow.length < 4) newRow.push(0);
            return newRow;
        };

        if (dir === 'up') {
            tempGrid = rotate(rotate(rotate(tempGrid))).map(slide);
            tempGrid = rotate(tempGrid);
        } else if (dir === 'down') {
            tempGrid = rotate(tempGrid).map(slide);
            tempGrid = rotate(rotate(rotate(tempGrid)));
        } else if (dir === 'right') {
            tempGrid = tempGrid.map(r => slide(r.reverse()).reverse());
        } else {
            tempGrid = tempGrid.map(slide);
        }

        if (JSON.stringify(tempGrid) !== prevGrid) {
            this.undoBuffer = { grid: JSON.parse(prevGrid), score: this.score, maxTile: this.maxTileReached };
            this.undoBtn.disabled = false;
            
            this.grid = tempGrid;
            this.score += moveScore;
            
            if (moveMaxTile > this.maxTileReached) {
                this.notifyEvolution(moveMaxTile);
            }

            this.addRandomTile();
            this.updateScoreDisplay();
            this.render();
            
            if (this.checkGameOver()) {
                setTimeout(() => this.endGame(), 500);
            }
        }

        setTimeout(() => { this.isMoving = false; }, 100);
    }

    undo() {
        if (!this.undoBuffer) return;
        this.grid = this.undoBuffer.grid;
        this.score = this.undoBuffer.score;
        this.maxTileReached = this.undoBuffer.maxTile;
        this.undoBuffer = null;
        this.undoBtn.disabled = true;
        this.updateScoreDisplay();
        this.render();
    }

    updateScoreDisplay() {
        const scoreVal = document.getElementById('current-score');
        if (scoreVal) scoreVal.innerText = this.score;
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            const bestVal = document.getElementById('best-score');
            if (bestVal) bestVal.innerText = this.bestScore;
            localStorage.setItem('ai_evolution_best', this.bestScore);
        }
    }

    notifyEvolution(val) {
        this.maxTileReached = val;
        const name = this.getTileName(val);
        this.statusMsg.innerText = `Evolution Reached: ${name}!`;
        this.statusMsg.classList.remove('fade-out');
        
        setTimeout(() => {
            this.statusMsg.classList.add('fade-out');
            setTimeout(() => {
                if (this.statusMsg.classList.contains('fade-out')) this.statusMsg.innerText = "";
            }, 500);
        }, 2000);
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
                    
                    const inner = document.createElement('span');
                    inner.className = 'tile-inner';
                    inner.innerText = this.getTileName(val);
                    tile.appendChild(inner);
                    
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
        const finalStage = document.getElementById('final-stage-name');
        const finalScore = document.getElementById('final-score');
        if (finalStage) finalStage.innerText = this.getTileName(this.maxTileReached);
        if (finalScore) finalScore.innerText = this.score;
        this.modal.classList.remove('hidden');
        this.loadRankings();
    }

    share() {
        const stageName = this.getTileName(this.maxTileReached);
        const text = `[AI EVOLUTION 2048]\nStage: ${stageName}\nScore: ${this.score}\nPlay: trackingsa.com/ai-evolution`;
        if (navigator.share) {
            navigator.share({ title: 'AI EVOLUTION 2048', text: text, url: 'https://trackingsa.com/ai-evolution' });
        } else {
            navigator.clipboard.writeText(text).then(() => alert("Result copied to clipboard!"));
        }
    }
}
