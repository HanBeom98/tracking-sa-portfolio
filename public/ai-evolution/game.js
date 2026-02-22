class AIEvolution2048 {
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
        
        // Add Mute Button
        const controls = document.querySelector('.main-controls');
        const muteBtn = document.createElement('button');
        muteBtn.id = 'mute-btn';
        muteBtn.className = 'action-btn';
        muteBtn.innerText = '🔊';
        muteBtn.onclick = () => this.toggleMute();
        controls.appendChild(muteBtn);

        this.bestElem.innerText = this.bestScore;
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
        document.getElementById('mute-btn').innerText = this.isMuted ? '🔇' : '🔊';
        
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
        
        // Base frequency based on tile value (Pentatonic scale-ish)
        // 2->C4, 4->D4, 8->E4, 16->G4, 32->A4...
        const notes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
        const index = Math.log2(value) - 1; 
        const freq = notes[index % notes.length] * (1 + Math.floor(index / notes.length));

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 2, t + 0.1); // Pitch sweep for "pop" effect

        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.3);

        // Add a "shimmer" layer for higher tiles
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

        // Ambient Arpeggio Loop (C Major 7 / A Minor 7 feel)
        const sequence = [
            { f: 261.63, d: 0.2 }, { f: 329.63, d: 0.2 }, { f: 392.00, d: 0.2 }, { f: 493.88, d: 0.2 }, // Cmaj7
            { f: 220.00, d: 0.2 }, { f: 261.63, d: 0.2 }, { f: 329.63, d: 0.2 }, { f: 392.00, d: 0.2 }  // Am7
        ];
        
        let noteIndex = 0;
        const playNextNote = () => {
            if (this.isMuted) return;
            const t = this.audioCtx.currentTime;
            const note = sequence[noteIndex];
            
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            
            osc.type = 'sine';
            osc.frequency.value = note.f;
            
            gain.gain.setValueAtTime(0.03, t); // Very quiet ambient
            gain.gain.linearRampToValueAtTime(0.01, t + note.d * 2); // Long decay
            
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            
            osc.start(t);
            osc.stop(t + note.d * 2.5);
            
            this.bgmNodes.push(osc);
            // Cleanup old nodes occasionally
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
        return (window.translations && window.translations[window.currentLang] && window.translations[window.currentLang][key]) 
            || val;
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
            e.preventDefault();
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
    }

    newGame() {
        this.grid = Array(4).fill().map(() => Array(4).fill(0));
        this.score = 0;
        this.undoBuffer = null;
        this.maxTileReached = 2;
        this.isGameOver = false;
        this.updateScoreDisplay();
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
        if (this.isMoving) return;
        this.initAudio(); // Initialize audio context on first interaction
        this.isMoving = true;

        const prevGrid = JSON.stringify(this.grid);
        const rotate = (g) => g[0].map((_, i) => g.map(row => row[i]).reverse());
        
        let tempGrid = JSON.parse(prevGrid);
        let moveScore = 0;
        let moveMaxTile = this.maxTileReached;
        let merged = false;

        const slide = (row) => {
            let filtered = row.filter(v => v !== 0);
            let newRow = [];
            for (let i = 0; i < filtered.length; i++) {
                if (i < filtered.length - 1 && filtered[i] === filtered[i + 1]) {
                    const newVal = filtered[i] * 2;
                    newRow.push(newVal);
                    moveScore += newVal;
                    if (newVal > moveMaxTile) moveMaxTile = newVal;
                    this.playMergeSound(newVal); // Play SFX
                    merged = true;
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
        this.scoreElem.innerText = this.score;
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            this.bestElem.innerText = this.bestScore;
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
        document.getElementById('final-stage-name').innerText = this.getTileName(this.maxTileReached);
        document.getElementById('final-score').innerText = this.score;
        this.modal.classList.remove('hidden');
    }

    share() {
        const stageName = this.getTileName(this.maxTileReached);
        const text = `[AI EVOLUTION 2048]
Stage: ${stageName}
Score: ${this.score}
Play: trackingsa.com/ai-evolution`;
        if (navigator.share) {
            navigator.share({ title: 'AI EVOLUTION 2048', text: text, url: 'https://trackingsa.com/ai-evolution' });
        } else {
            navigator.clipboard.writeText(text).then(() => alert("Result copied to clipboard!"));
        }
    }
}

window.addEventListener('load', () => {
    // Small delay to ensure translations are loaded if they are injected
    setTimeout(() => {
        window.gameInstance = new AIEvolution2048();
    }, 100);
});
