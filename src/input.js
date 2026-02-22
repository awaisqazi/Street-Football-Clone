const PASS_KEYS = ['z', 'x', 'c', 'v', 'b', 'n'];

export const Input = {
    keys: {
        w: false,
        a: false,
        s: false,
        d: false,
        q: false, // Juke Left
        e: false, // Juke Right
        f: false, // Spin
        g: false, // Activate Gamebreaker
        z: false, // Pass receiver 1
        x: false, // Pass receiver 2
        c: false, // Pass receiver 3
        v: false, // Pass receiver 4
        b: false, // Pass receiver 5
        n: false, // Pass receiver 6
        space: false, // Jump / Hurdle
        shift: false, // Sprint / Tackle modifier
        alt: false,   // Pitch / Lateral
    },
    keyPressStart: {},       // Timestamp when a pass key was pressed
    keyReleasedDuration: {}, // Duration (ms) a pass key was held before release
    mouse: {
        leftDown: false,
        rightDown: false,
        position: { x: 0, y: 0 }
    },

    init() {
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (this.keys.hasOwnProperty(key)) this.keys[key] = true;
            if (e.key === 'Shift') this.keys.shift = true;
            if (e.key === ' ') this.keys.space = true;
            if (e.key === 'Alt') { this.keys.alt = true; e.preventDefault(); }

            // Track press start time for pass keys (only on initial press)
            if (PASS_KEYS.includes(key) && !this.keyPressStart[key]) {
                this.keyPressStart[key] = performance.now();
            }
        });

        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (this.keys.hasOwnProperty(key)) this.keys[key] = false;
            if (e.key === 'Shift') this.keys.shift = false;
            if (e.key === ' ') this.keys.space = false;
            if (e.key === 'Alt') this.keys.alt = false;

            // Calculate hold duration for pass keys
            if (PASS_KEYS.includes(key) && this.keyPressStart[key]) {
                const duration = performance.now() - this.keyPressStart[key];
                this.keyReleasedDuration[key] = duration;
                delete this.keyPressStart[key];
            }
        });

        window.addEventListener('mousedown', (e) => {
            if (e.button === 0) this.mouse.leftDown = true;
            if (e.button === 2) this.mouse.rightDown = true;
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.mouse.leftDown = false;
            if (e.button === 2) this.mouse.rightDown = false;
        });

        window.addEventListener('mousemove', (e) => {
            // Normalized Device Coordinates (-1 to +1)
            this.mouse.position.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouse.position.y = -(e.clientY / window.innerHeight) * 2 + 1;
        });

        // Prevent context menu on right click for lob passes
        window.addEventListener('contextmenu', e => e.preventDefault());
    }
};
