// Urban Gridiron League — 10-Attribute RPG Position System (0–20 scale)

export const Positions = {
    QB: {
        name: "Quarterback",
        // Visual / Physics
        radius: 1.0,
        height: 2.0,
        mass: 90,
        color: 0x00ccff,      // Cyan
        // Legacy physics (consumed by character.js)
        speed: 80,
        acceleration: 120,
        jumpPower: 14,
        // RPG Attributes (0–20)
        passing: 18,
        speed_attr: 10,
        blocking: 3,
        agility: 12,
        catching: 6,
        runPower: 7,
        carrying: 15,
        tackling: 2,
        coverage: 2,
        dMoves: 3
    },

    WR: {
        name: "Wide Receiver",
        radius: 0.8,
        height: 1.85,
        mass: 70,
        color: 0xffaa00,      // Orange
        speed: 100,
        acceleration: 200,
        jumpPower: 20,
        passing: 2,
        speed_attr: 18,
        blocking: 3,
        agility: 17,
        catching: 19,
        runPower: 5,
        carrying: 10,
        tackling: 2,
        coverage: 4,
        dMoves: 6
    },

    RB: {
        name: "Running Back",
        radius: 0.95,
        height: 1.85,
        mass: 85,
        color: 0xff3300,      // Red
        speed: 92,
        acceleration: 180,
        jumpPower: 18,
        passing: 3,
        speed_attr: 15,
        blocking: 6,
        agility: 16,
        catching: 12,
        runPower: 17,
        carrying: 18,
        tackling: 4,
        coverage: 3,
        dMoves: 5
    },

    OL: {
        name: "Offensive Lineman",
        radius: 1.4,
        height: 2.2,
        mass: 130,
        color: 0x888888,      // Grey
        speed: 55,
        acceleration: 80,
        jumpPower: 8,
        passing: 1,
        speed_attr: 4,
        blocking: 19,
        agility: 4,
        catching: 2,
        runPower: 16,
        carrying: 3,
        tackling: 8,
        coverage: 1,
        dMoves: 2
    },

    DL: {
        name: "Defensive Lineman",
        radius: 1.35,
        height: 2.2,
        mass: 125,
        color: 0x444488,      // Steel Blue
        speed: 60,
        acceleration: 90,
        jumpPower: 10,
        passing: 0,
        speed_attr: 5,
        blocking: 14,
        agility: 6,
        catching: 3,
        runPower: 18,
        carrying: 2,
        tackling: 17,
        coverage: 3,
        dMoves: 15
    },

    DB: {
        name: "Defensive Back",
        radius: 0.8,
        height: 1.8,
        mass: 68,
        color: 0x0055ff,      // Blue
        speed: 98,
        acceleration: 190,
        jumpPower: 20,
        passing: 1,
        speed_attr: 17,
        blocking: 2,
        agility: 18,
        catching: 16,
        runPower: 4,
        carrying: 5,
        tackling: 10,
        coverage: 19,
        dMoves: 8
    },

    LB: {
        name: "Linebacker",
        radius: 1.2,
        height: 2.1,
        mass: 105,
        color: 0x0000aa,      // Navy
        speed: 75,
        acceleration: 130,
        jumpPower: 14,
        passing: 1,
        speed_attr: 10,
        blocking: 10,
        agility: 10,
        catching: 8,
        runPower: 14,
        carrying: 4,
        tackling: 18,
        coverage: 15,
        dMoves: 12
    }
};

// Keep legacy Archetypes export so character.js and existing code don't break
export const Archetypes = {
    BRUISER: Positions.OL,
    ACROBAT: Positions.WR,
    CANNON: Positions.QB
};
