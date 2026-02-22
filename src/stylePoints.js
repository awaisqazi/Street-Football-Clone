import * as THREE from 'three';

export class StyleManager {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;

        this.score = { player: 0, cpu: 0 };
        this.gbThreshold = 50000;

        this.gbActive = { player: false, cpu: false };

        // UI Elements
        this.playerProgressBar = document.getElementById('player-style-fill');
        this.cpuProgressBar = document.getElementById('cpu-style-fill');

        this.popups = [];
        this.uiLayer = document.getElementById('ui-layer');
    }

    addStylePoints(team, amount, label, worldPos) {
        if (this.gbActive[team]) return; // Don't gain points while active

        this.score[team] += amount;
        if (this.score[team] > this.gbThreshold) {
            this.score[team] = this.gbThreshold;
            console.log(`GAMEBREAKER READY FOR ${team.toUpperCase()}!`);
        }

        // Update Progress Bars
        const pct = (this.score[team] / this.gbThreshold) * 100;
        if (team === 'player') this.playerProgressBar.style.width = `${pct}%`;
        else this.cpuProgressBar.style.width = `${pct}%`;

        this.spawnFloatingPopup(label, amount, worldPos);
    }

    spawnFloatingPopup(label, amount, worldPos) {
        // Convert 3D position to 2D screen coordinates
        const vector = worldPos.clone();
        vector.y += 4; // Above head
        vector.project(this.camera);

        const x = (vector.x * .5 + .5) * window.innerWidth;
        const y = (vector.y * -.5 + .5) * window.innerHeight;

        const el = document.createElement('div');
        el.className = 'style-popup';
        el.innerHTML = `+${amount}<br/>${label}`;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;

        this.uiLayer.appendChild(el);

        // Animate up and fade
        let opacity = 1.0;
        let upY = y;

        const animObj = { el, opacity, upY, active: true };
        this.popups.push(animObj);
    }

    update(deltaTime) {
        // Animate popups
        for (let i = this.popups.length - 1; i >= 0; i--) {
            const p = this.popups[i];
            p.upY -= 50 * deltaTime; // Float up
            p.opacity -= 1.0 * deltaTime; // Fade out 1s

            if (p.opacity <= 0) {
                this.uiLayer.removeChild(p.el);
                this.popups.splice(i, 1);
            } else {
                p.el.style.top = `${p.upY}px`;
                p.el.style.opacity = p.opacity;
                p.el.style.transform = `scale(${1 + (1 - p.opacity)})`; // Grow slightly
            }
        }
    }

    activateGamebreaker(team) {
        if (this.score[team] >= this.gbThreshold && !this.gbActive[team]) {
            this.gbActive[team] = true;
            this.score[team] = 0; // reset

            // Reset UI immediately
            if (team === 'player') this.playerProgressBar.style.width = '0%';
            else this.cpuProgressBar.style.width = '0%';

            // Big center screen alert
            const alert = document.createElement('div');
            alert.className = 'gb-alert';
            alert.innerText = "GAMEBREAKER!";
            this.uiLayer.appendChild(alert);
            setTimeout(() => this.uiLayer.removeChild(alert), 2000);

            return true; // Activated successfully
        }
        return false;
    }
}
