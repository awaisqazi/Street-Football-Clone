import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export function setupTackling(world, players, ball, styleManager, audioManager) {
    // A simple collision listener to detect tackles
    world.addEventListener('beginContact', (event) => {
        const bodyA = event.bodyA;
        const bodyB = event.bodyB;

        // Fast check if these are player bodies (we assume players use the player material)
        if (bodyA.material?.name !== 'player' || bodyB.material?.name !== 'player') return;

        // Find our JS character objects matching the Cannon bodies
        const charA = players.find(p => p.body === bodyA);
        const charB = players.find(p => p.body === bodyB);

        if (!charA || !charB) return;

        // Ensure tackling only happens between opposing teams
        if (charA.team === charB.team) return;

        let carrier = null;
        let tackler = null;

        if (ball && ball.carrier === charA) {
            carrier = charA;
            tackler = charB;
        } else if (ball && ball.carrier === charB) {
            carrier = charB;
            tackler = charA;
        }

        if (carrier && tackler) {
            // Check for Gamebreaker auto-win
            if (carrier.isGamebreakerActive) {
                applyArcadeKnockback(carrier, tackler, true);
                if (styleManager && carrier.isPlayer) styleManager.spawnFloatingPopup("GB TRUCK!", 0, carrier.mesh.position);
                return;
            }

            // Check for Evasive Moves (Missed Tackle)
            if (carrier.isEvading) {
                if (carrier.lastEvasion !== 'hurdle' || tackler.body.velocity.y > 0) {
                    if (styleManager && carrier.isPlayer) styleManager.addStylePoints('player', 1500, carrier.lastEvasion.toUpperCase() + "!", carrier.mesh.position);
                    return; // Carrier dodged
                }
            }

            // Standard Tackle
            carrier.isDown = true;
            if (audioManager) audioManager.playTackle();

            // Hit Stick logic (Exaggerated knockback for style/fumble)
            const vlsSqTackler = tackler.body.velocity.lengthSquared();
            if (vlsSqTackler > 600) {
                applyArcadeKnockback(tackler, carrier);
                if (styleManager && tackler.isPlayer) styleManager.addStylePoints('player', 2500, "HIT STICK!", tackler.mesh.position);
            }
        } else {
            // Non-carrier collisions (blocking, etc.)
            const vlsSqA = charA.body.velocity.lengthSquared();
            const vlsSqB = charB.body.velocity.lengthSquared();
            const sprintThresholdSquared = 600;

            if (charA.isGamebreakerActive) {
                applyArcadeKnockback(charA, charB, true);
                return;
            } else if (charB.isGamebreakerActive) {
                applyArcadeKnockback(charB, charA, true);
                return;
            }

            if (vlsSqA > sprintThresholdSquared && vlsSqA > vlsSqB) {
                applyArcadeKnockback(charA, charB);
                if (audioManager) audioManager.playTackle();
            } else if (vlsSqB > sprintThresholdSquared && vlsSqB > vlsSqA) {
                applyArcadeKnockback(charB, charA);
                if (audioManager) audioManager.playTackle();
            }
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
