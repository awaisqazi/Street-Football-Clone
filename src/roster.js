// Urban Gridiron League Character Archetypes

export const Archetypes = {
    BRUISER: {
        name: "Bruiser",
        speed: 70,             // Slower acceleration
        acceleration: 100,
        jumpPower: 12,         // Heavy, poor jumper
        mass: 120,             // Hard to knock back
        radius: 1.3,           // Thicker visual/hitbox
        height: 2.2,           // Taller
        color: 0x990000        // Dark Red
    },
    ACROBAT: {
        name: "Acrobat",
        speed: 100,            // Fastest
        acceleration: 200,
        jumpPower: 22,         // Massive hops for hurdling/wall-jumps
        mass: 65,              // Easy to truck
        radius: 0.8,           // Skinnier
        height: 1.8,
        color: 0xffaa00        // Yellow/Orange
    },
    CANNON: {
        name: "Cannon",
        speed: 80,
        acceleration: 120,
        jumpPower: 14,
        mass: 90,
        radius: 1.0,           // Average build
        height: 2.0,
        color: 0x00ccff        // Cyan QB
    }
};
