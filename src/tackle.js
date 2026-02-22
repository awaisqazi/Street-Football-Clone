import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export function setupTackling(world, players, styleManager, audioManager) {
    // A simple collision listener to detect "hit stick" arcade tackles
    // In a street game, a tackle is usually triggered if a player is sprinting (shift) into an opponent

    world.addEventListener('beginContact', (event) => {
        const bodyA = event.bodyA;
        const bodyB = event.bodyB;

        // Fast check if these are player bodies (we assume players use the player material)
        if (bodyA.material?.name !== 'player' || bodyB.material?.name !== 'player') return;

        // Find our JS character objects matching the Cannon bodies
        const charA = players.find(p => p.body === bodyA);
        const charB = players.find(p => p.body === bodyB);

        if (!charA || !charB) return;

        // Are they on different teams? (For now, we just assume if one is player-controlled and one isn't, they are opponents)
        if (charA.isPlayer === charB.isPlayer) return;

        // Check for Gamebreaker auto-win
        if (charA.isGamebreakerActive) {
            applyArcadeKnockback(charA, charB, true);
            if (styleManager && charA.isPlayer) styleManager.spawnFloatingPopup("GB TRUCK!", 0, charA.mesh.position);
            return;
        } else if (charB.isGamebreakerActive) {
            applyArcadeKnockback(charB, charA, true);
            if (styleManager && charB.isPlayer) styleManager.spawnFloatingPopup("GB TRUCK!", 0, charB.mesh.position);
            return;
        }

        // Check for Evasive Moves (Missed Tackle)
        if (charA.isEvading) {
            if (styleManager && charA.isPlayer) styleManager.addStylePoints('player', 1500, charA.lastEvasion.toUpperCase() + "!", charA.mesh.position);
            return; // A dodged
        } else if (charB.isEvading) {
            if (styleManager && charB.isPlayer) styleManager.addStylePoints('player', 1500, charB.lastEvasion.toUpperCase() + "!", charB.mesh.position);
            return; // B dodged
        }

        // Determine who is the "Tackler"
        // Usually, the tackler is the defense, but on offense, you can "truck" or stiff-arm.
        // For Phase 2 sandbox, we say: if you are sprinting (velocity > threshold) and hit the other guy, you win the collision and knock them back.

        const vlsSqA = charA.body.velocity.lengthSquared();
        const vlsSqB = charB.body.velocity.lengthSquared();

        const sprintThresholdSquared = 600; // Requires high speed to trigger big hit

        if (vlsSqA > sprintThresholdSquared && vlsSqA > vlsSqB) {
            // A tackles B
            applyArcadeKnockback(charA, charB);
            if (audioManager) audioManager.playTackle();
            if (styleManager && charA.isPlayer) styleManager.addStylePoints('player', 2500, "HIT STICK!", charA.mesh.position);
        } else if (vlsSqB > sprintThresholdSquared && vlsSqB > vlsSqA) {
            // B tackles A
            applyArcadeKnockback(charB, charA);
            if (audioManager) audioManager.playTackle();
            if (styleManager && charB.isPlayer) styleManager.addStylePoints('player', 2500, "HIT STICK!", charB.mesh.position);
        }
    });
}

function applyArcadeKnockback(tackler, target, isGamebreaker = false) {
    // Calculate relative direction
    const direction = new CANNON.Vec3();
    target.body.position.vsub(tackler.body.position, direction);
    direction.y = 0; // Keep knockback mostly horizontal initially
    direction.normalize();

    // Exaggerated arcade knockback vector (Up and Away)
    const hitPower = isGamebreaker ? 80 : 40;
    direction.scale(hitPower, direction);
    direction.y = isGamebreaker ? 25 : 15; // Pop them up into the air

    // Apply massive impulse to the target to send them ragdolling
    target.applyTackleImpulse(direction);

    // Flash red test
    target.mesh.children[0].material.color.setHex(0xffffff);
    setTimeout(() => {
        // Revert color (assumes target is blue test dummy)
        target.mesh.children[0].material.color.setHex(tackler.isPlayer ? 0x0000ff : 0xff0000); // restore
    }, 300);
}
