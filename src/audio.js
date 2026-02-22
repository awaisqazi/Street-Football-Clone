// Primitive procedural audio since we don't have .wav/.mp3 access
export class AudioManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.bgmPlaying = false;
    }

    resume() {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playBGM() {
        if (this.bgmPlaying) return;
        this.resume();
        this.bgmPlaying = true;

        // Very simple synth bass loop
        const playBassNote = (time, freq, dur) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, time);

            gain.gain.setValueAtTime(0.1, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(time);
            osc.stop(time + dur);
        };

        let nextTime = this.ctx.currentTime;
        const tempo = 120; // BPM
        const beatLen = 60 / tempo;

        // Loop
        this.bgmInterval = setInterval(() => {
            if (this.ctx.currentTime > nextTime - 0.2) {
                // 1 bar loop
                playBassNote(nextTime, 55, beatLen * 0.8); // G1
                playBassNote(nextTime + beatLen, 55, beatLen * 0.8);
                playBassNote(nextTime + beatLen * 2, 65.41, beatLen * 0.5); // C2
                playBassNote(nextTime + beatLen * 2.5, 61.74, beatLen * 0.5); // B1
                playBassNote(nextTime + beatLen * 3, 49, beatLen * 0.8); // G1 drop

                nextTime += beatLen * 4;
            }
        }, 100);
    }

    stopBGM() {
        if (this.bgmInterval) clearInterval(this.bgmInterval);
        this.bgmPlaying = false;
    }

    playTackle() {
        this.resume();
        // Crunchy low frequency hit
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + 0.2);

        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }

    playWhistle() {
        this.resume();
        // High pitch trill
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(2000, this.ctx.currentTime);
        // Freq mod for trill effect could be added with an LFO, but keep it simple
        osc.frequency.linearRampToValueAtTime(1800, this.ctx.currentTime + 0.5);

        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.5);
    }
}
