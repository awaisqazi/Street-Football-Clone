export const GameState = {
    MAIN_MENU: -1,
    PLAY_SELECTION: 0,
    PRE_SNAP: 1,
    LIVE_ACTION: 2,
    POST_PLAY_DEAD: 3,
    GAME_OVER: 4,
    PAT_SELECTION: 5
};

import { Playbook } from './playbook.js';

export class GameManager {
    constructor() {
        this.currentState = GameState.MAIN_MENU;

        // Football Rules State
        this.lineOfScrimmageZ = 0; // Center field
        this.firstDownZ = -10; // 10 yards ahead (negative Z = forward for player)
        this.down = 1;
        this.yardsToGlow = 10;

        this.score = { player: 0, cpu: 0 };
        this.possession = 'player'; // or 'cpu'
        this.winScore = 21; // First to 21 street rules

        this.activePlay = null; // Stores what the user selected

        // PAT state
        this.isPAT = false;
        this.patTeam = null;
        this.patPoints = 0;
    }

    updateHUD() {
        const downSt = ['1st', '2nd', '3rd', '4th', 'Turnover'][this.down - 1];
        document.getElementById('down-distance').innerText = `${downSt} & ${Math.floor(this.yardsToGlow)}`;

        let stateText = "";
        if (this.currentState === GameState.PLAY_SELECTION) stateText = "Play Selection";
        if (this.currentState === GameState.PRE_SNAP) stateText = "Press SPACE to Snap";
        if (this.currentState === GameState.LIVE_ACTION) stateText = "LIVE!";
        if (this.currentState === GameState.POST_PLAY_DEAD) stateText = "Play Dead";

        document.getElementById('game-status').innerText = stateText;
        document.getElementById('score').innerText = `Player: ${this.score.player} | CPU: ${this.score.cpu}`;
    }

    setPlaySelectionMenu(uiManager, playbookObj) {
        this.currentState = GameState.PLAY_SELECTION;

        // Show Playbook
        uiManager.showPlaybook(this.possession === 'player' ? playbookObj.offense : playbookObj.defense, (selectedPlay) => {
            this.activePlay = selectedPlay;
            uiManager.hidePlaybook();
            this.transitionToPreSnap();
        });

        this.updateHUD();
    }

    transitionToPreSnap() {
        this.currentState = GameState.PRE_SNAP;
        this.updateHUD();
        console.log("Pre-snap. Waiting for SPACE...");
        // Main.js should handle snapping the ball if in this state
    }

    snapBall(aiManager, offenseTeam, defenseTeam) {
        if (this.currentState !== GameState.PRE_SNAP) return;
        this.currentState = GameState.LIVE_ACTION;

        // Assign routes and coverages
        if (this.activePlay) {
            if (this.possession === 'player') {
                aiManager.assignPlay(offenseTeam, this.activePlay, defenseTeam, true);
                aiManager.assignPlay(defenseTeam, Playbook.defense[0], offenseTeam, false); // Default Man-to-man for now
            } else {
                aiManager.assignPlay(defenseTeam, this.activePlay, offenseTeam, true);
                aiManager.assignPlay(offenseTeam, Playbook.defense[0], defenseTeam, false);
            }
        }

        this.updateHUD();
        console.log("HUT! Play is live with AI assigned.");
    }

    endPlay(tackleZ) {
        if (this.currentState !== GameState.LIVE_ACTION) return;
        this.currentState = GameState.POST_PLAY_DEAD;
        console.log("Whistle blown! Ball spotted at Z: " + tackleZ);

        // Simplistic arcade football logic
        // Player drives -Z (forward), CPU drives +Z
        const yardsGained = this.possession === 'player' ? this.lineOfScrimmageZ - tackleZ : tackleZ - this.lineOfScrimmageZ;

        this.lineOfScrimmageZ = tackleZ;
        this.yardsToGlow -= yardsGained;

        // First Down Check
        if (this.yardsToGlow <= 0) {
            this.down = 1;
            this.yardsToGlow = 10;
            this.firstDownZ = this.possession === 'player' ? this.lineOfScrimmageZ - 10 : this.lineOfScrimmageZ + 10;
            console.log("FIRST DOWN!");
        } else {
            this.down++;
        }

        // Turnover Check
        if (this.down > 4) {
            console.log("TURNOVER ON DOWNS!");
            this.flipPossession();
        }

        this.updateHUD();

        // Short delay before going back to play selection
        setTimeout(() => {
            if (this.currentState !== GameState.GAME_OVER) {
                this.currentState = GameState.PLAY_SELECTION;
            }
        }, 2000);
    }

    flipPossession() {
        this.possession = this.possession === 'player' ? 'cpu' : 'player';
        this.down = 1;
        this.yardsToGlow = 10;
        this.firstDownZ = this.possession === 'player' ? this.lineOfScrimmageZ - 10 : this.lineOfScrimmageZ + 10;
    }

    checkTouchdown(carrierPos, audioManager, uiManager) {
        if (this.currentState !== GameState.LIVE_ACTION) return false;

        // Simplistic Endzone Check (Past +/- 45 Z)
        const fieldEnds = 45;
        let isTD = false;

        if (this.possession === 'player' && carrierPos.z < -fieldEnds) isTD = true;
        if (this.possession === 'cpu' && carrierPos.z > fieldEnds) isTD = true;

        if (isTD) {
            this.currentState = GameState.POST_PLAY_DEAD;

            if (this.isPAT) {
                // PAT attempt succeeded — award the extra points
                this.score[this.patTeam] += this.patPoints;
                this.isPAT = false;

                if (uiManager) uiManager.showTouchdown(this.patTeam);
                if (audioManager) {
                    audioManager.playWhistle();
                    setTimeout(() => audioManager.playWhistle(), 300);
                }

                if (this.score[this.patTeam] >= this.winScore) {
                    this.currentState = GameState.GAME_OVER;
                    if (uiManager) uiManager.showGameOver(this.patTeam === 'player' ? "YOU WIN" : "CPU WINS");
                    return true;
                }

                this.lineOfScrimmageZ = 0;
                this.flipPossession();
                this.updateHUD();

                setTimeout(() => {
                    if (this.currentState !== GameState.GAME_OVER) {
                        if (uiManager) uiManager.hideTouchdown();
                        this.currentState = GameState.PLAY_SELECTION;
                    }
                }, 2500);

                return true;
            }

            // Regular touchdown — 6 points, then PAT selection
            this.score[this.possession] += 6;
            this.patTeam = this.possession;

            if (uiManager) uiManager.showTouchdown(this.possession);
            if (audioManager) {
                audioManager.playWhistle();
                setTimeout(() => audioManager.playWhistle(), 300);
            }

            if (this.score[this.possession] >= this.winScore) {
                this.currentState = GameState.GAME_OVER;
                if (uiManager) uiManager.showGameOver(this.possession === 'player' ? "YOU WIN" : "CPU WINS");
                return true;
            }

            this.updateHUD();

            // Transition to PAT selection after a short delay
            setTimeout(() => {
                if (this.currentState !== GameState.GAME_OVER) {
                    if (uiManager) uiManager.hideTouchdown();
                    this.currentState = GameState.PAT_SELECTION;
                }
            }, 2500);

            return true;
        }
        return false;
    }

    startPAT(choice) {
        this.isPAT = true;
        if (choice === 'run') {
            this.patPoints = 1;
            // Spot at 5-yard line toward the endzone
            this.lineOfScrimmageZ = this.patTeam === 'player' ? -40 : 40;
        } else {
            this.patPoints = 2;
            // Spot at 10-yard line
            this.lineOfScrimmageZ = this.patTeam === 'player' ? -35 : 35;
        }
        this.down = 1;
        this.yardsToGlow = 10;
        this.firstDownZ = this.patTeam === 'player' ? this.lineOfScrimmageZ - 10 : this.lineOfScrimmageZ + 10;
    }

    endPATPlay() {
        // PAT attempt failed (tackled before endzone)
        this.isPAT = false;
        this.lineOfScrimmageZ = 0;
        this.flipPossession();
        this.updateHUD();

        setTimeout(() => {
            if (this.currentState !== GameState.GAME_OVER) {
                this.currentState = GameState.PLAY_SELECTION;
            }
        }, 2000);
    }
}
