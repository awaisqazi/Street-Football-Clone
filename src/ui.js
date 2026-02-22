export class UIManager {
    constructor() {
        this.menu = document.getElementById('playbook-menu');
        this.title = document.getElementById('playbook-title');
        this.optionsContainer = document.getElementById('playbook-options');

        this.mainMenu = document.getElementById('main-menu');
        this.tutorialMenu = document.getElementById('tutorial-menu');
        this.rosterMenu = document.getElementById('roster-menu');
        this.gameOverMenu = document.getElementById('game-over');
        this.touchdownBanner = document.getElementById('touchdown-banner');
        this.patMenu = document.getElementById('pat-menu');
    }

    showPATMenu(onChoice) {
        this.patMenu.style.display = 'flex';
        document.getElementById('pat-run-btn').onclick = () => {
            this.hidePATMenu();
            onChoice('run');
        };
        document.getElementById('pat-pass-btn').onclick = () => {
            this.hidePATMenu();
            onChoice('pass');
        };
    }

    hidePATMenu() {
        this.patMenu.style.display = 'none';
    }

    showPlaybook(plays, onSelectCallback) {
        this.optionsContainer.innerHTML = '';

        plays.forEach(play => {
            const btn = document.createElement('button');
            btn.className = 'play-btn';
            btn.innerText = play.name;
            btn.onclick = () => onSelectCallback(play);
            this.optionsContainer.appendChild(btn);
        });

        this.menu.style.display = 'block';
    }

    hidePlaybook() {
        this.menu.style.display = 'none';
    }

    showMainMenu(onStartGame) {
        this.mainMenu.style.display = 'flex';

        document.getElementById('start-btn').onclick = () => {
            this.mainMenu.style.display = 'none';
            onStartGame();
        };

        document.getElementById('tutorial-btn').onclick = () => {
            this.mainMenu.style.display = 'none';
            this.tutorialMenu.style.display = 'flex';
        };

        document.getElementById('close-tutorial-btn').onclick = () => {
            this.tutorialMenu.style.display = 'none';
            this.mainMenu.style.display = 'flex';
        };
    }

    showRosterMenu(onComplete) {
        this.rosterMenu.style.display = 'flex';
        // Simplistic: user selects preset archetypes by just hitting 'Draft Team'
        document.getElementById('draft-btn').onclick = () => {
            this.rosterMenu.style.display = 'none';
            onComplete();
        };
    }

    showTouchdown(team) {
        this.touchdownBanner.style.display = 'flex';
        this.touchdownBanner.innerText = team.toUpperCase() + " TOUCHDOWN!";
    }

    hideTouchdown() {
        this.touchdownBanner.style.display = 'none';
    }

    showGameOver(msg) {
        this.gameOverMenu.style.display = 'flex';
        document.getElementById('go-msg').innerText = msg;
        document.getElementById('rematch-btn').onclick = () => location.reload();
    }
}
