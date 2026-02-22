import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { AIState } from './ai.js';
import { Input } from './input.js';

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
                // Stiff Arm — attribute contest: carrier.runPower vs tackler.tackling
                if (carrier.lastEvasion === 'stiff_arm') {
                    const runPower = carrier.archetype.runPower || 10;
                    const tackling = tackler.archetype.tackling || 10;
                    if (runPower > tackling) {
                        // Stiff arm wins — knock tackler back
                        applyArcadeKnockback(carrier, tackler);
                        if (styleManager && carrier.isPlayer) styleManager.addStylePoints('player', 2000, "STIFF ARM!", carrier.mesh.position, carrier, players);
                        return;
                    }
                    // Stiff arm fails — fall through to standard tackle
                } else if (carrier.lastEvasion !== 'hurdle' || tackler.body.velocity.y > 0) {
                    if (styleManager && carrier.isPlayer) styleManager.addStylePoints('player', 1500, carrier.lastEvasion.toUpperCase() + "!", carrier.mesh.position, carrier, players);
                    return; // Carrier dodged
                }
            }

            // --- Pitch Fumble Penalty ---
            // If the carrier is attempting a pitch (Alt) at the moment of tackle collision → 90% fumble
            if (Input.keys.alt) {
                if (audioManager) audioManager.playTackle();

                if (Math.random() < 0.90) {
                    ball.isFumbled = true;
                    ball.isHeld = false;
                    ball.carrier = null;
                    ball.body.type = 2; // CANNON.Body.DYNAMIC
                    ball.body.collisionFilterMask = 1;

                    ball.body.velocity.set(
                        (Math.random() - 0.5) * 20,
                        8 + Math.random() * 5,
                        (Math.random() - 0.5) * 20
                    );
                    ball.body.angularVelocity.set(
                        Math.random() * 15,
                        Math.random() * 10,
                        Math.random() * 15
                    );

                    console.log("PITCH FUMBLE! Tackled while pitching!");
                    Input.keys.alt = false; // Consume
                    return; // Ball is live
                }
                // 10% — survived, normal tackle
                Input.keys.alt = false;
                carrier.isDown = true;
                return;
            }

            // --- Styling Fumble Penalty ---
            // If the carrier is showboating (isStyling), bypass normal checks: 80% fumble
            if (carrier.isStyling) {
                if (audioManager) audioManager.playTackle();

                if (Math.random() < 0.80) {
                    // FUMBLE!
                    ball.isFumbled = true;
                    ball.isHeld = false;
                    ball.carrier = null;
                    ball.body.type = 2; // CANNON.Body.DYNAMIC
                    ball.body.collisionFilterMask = 1;

                    ball.body.velocity.set(
                        (Math.random() - 0.5) * 20,
                        8 + Math.random() * 5,
                        (Math.random() - 0.5) * 20
                    );
                    ball.body.angularVelocity.set(
                        Math.random() * 15,
                        Math.random() * 10,
                        Math.random() * 15
                    );

                    if (styleManager && tackler.isPlayer) styleManager.addStylePoints('player', 3000, "STYLE FUMBLE!", tackler.mesh.position, tackler, players);
                    console.log("STYLE FUMBLE! Showboating cost the carrier!");
                    return; // Ball is live
                }
                // 20% — survived the style penalty, normal tackle
                carrier.isDown = true;
                return;
            }

            // Standard Tackle
            if (audioManager) audioManager.playTackle();

            // Hit Stick logic (Exaggerated knockback + fumble chance)
            const vlsSqTackler = tackler.body.velocity.lengthSquared();
            if (vlsSqTackler > 600) {
                applyArcadeKnockback(tackler, carrier);
                if (styleManager && tackler.isPlayer) styleManager.addStylePoints('player', 2500, "HIT STICK!", tackler.mesh.position, tackler, players);

                // Fumble roll: tackler.tackling vs carrier.carrying
                const tacklingAttr = tackler.archetype.tackling || 10;
                const carryingAttr = carrier.archetype.carrying || 10;
                if (Math.random() * 20 + tacklingAttr > carryingAttr + 10) {
                    // FUMBLE!
                    ball.isFumbled = true;
                    ball.isHeld = false;
                    ball.carrier = null;
                    ball.body.type = 2; // CANNON.Body.DYNAMIC
                    ball.body.collisionFilterMask = 1;

                    // Chaotic bounce impulse
                    ball.body.velocity.set(
                        (Math.random() - 0.5) * 20,
                        8 + Math.random() * 5,
                        (Math.random() - 0.5) * 20
                    );
                    ball.body.angularVelocity.set(
                        Math.random() * 15,
                        Math.random() * 10,
                        Math.random() * 15
                    );

                    if (styleManager && tackler.isPlayer) styleManager.addStylePoints('player', 3000, "FUMBLE!", tackler.mesh.position, tackler, players);
                    console.log("FUMBLE! Ball is loose!");
                    return; // Don't end the play — ball is live
                }
            }

            // No fumble — normal tackle, blow the play dead
            carrier.isDown = true;
        } else {
            // Non-carrier collisions (blocking, rip moves, etc.)
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

            // Engaged Block — DL rusher vs OL blocker
            const engageBlock = (rusher, blocker) => {
                if ((rusher.aiState === AIState.BLITZ || rusher.defenseRole === 'dl_rush') &&
                    blocker.aiState === AIState.BLOCK &&
                    !rusher.blockEngaged && !blocker.blockEngaged) {
                    // Lock both players
                    rusher.body.velocity.x = 0;
                    rusher.body.velocity.z = 0;
                    blocker.body.velocity.x = 0;
                    blocker.body.velocity.z = 0;

                    rusher.blockEngaged = true;
                    rusher.engagedWith = blocker;
                    rusher.blockShedTaps = 0;
                    rusher.blockShedTimer = 0;
                    rusher._prevAiState = rusher.aiState;
                    rusher.aiState = AIState.ENGAGED_BLOCK;

                    blocker.blockEngaged = true;
                    blocker.engagedWith = rusher;
                    blocker._prevAiState = blocker.aiState;
                    blocker.aiState = AIState.ENGAGED_BLOCK;

                    console.log("BLOCK ENGAGED!");
                    return true;
                }
                return false;
            };

            if (engageBlock(charA, charB) || engageBlock(charB, charA)) return;

            // Rip Move vs Blocker — attribute contest: dMoves vs blocking
            const ripVsBlock = (attacker, blocker) => {
                if (attacker.isEvading && attacker.lastEvasion === 'rip_move' &&
                    blocker.aiState === AIState.BLOCK) {
                    const dMoves = attacker.archetype.dMoves || 10;
                    const blocking = blocker.archetype.blocking || 10;
                    if (dMoves > blocking) {
                        applyArcadeKnockback(attacker, blocker);
                        if (styleManager && attacker.isPlayer) styleManager.addStylePoints('player', 1500, "RIP MOVE!", attacker.mesh.position, attacker, players);
                    } else {
                        applyArcadeKnockback(blocker, attacker);
                    }
                    return true;
                }
                return false;
            };

            if (ripVsBlock(charA, charB) || ripVsBlock(charB, charA)) return;

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

/**
 * Per-frame update for block engagements and rapid-tap shedding.
 * Called from the main animate loop during LIVE_ACTION.
 */
export function updateBlockEngagements(allPlayers, deltaTime, ball, styleManager) {
    for (const p of allPlayers) {
        if (!p.blockEngaged || !p.engagedWith) continue;

        const blocker = p.engagedWith;

        // Keep both players locked in place
        p.body.velocity.x *= 0.1;
        p.body.velocity.z *= 0.1;
        blocker.body.velocity.x *= 0.1;
        blocker.body.velocity.z *= 0.1;

        // Only the user-controlled rusher can tap to shed
        if (!p.isPlayer) continue;

        // Tick shed timer
        if (p.blockShedTimer > 0) {
            p.blockShedTimer -= deltaTime;
            if (p.blockShedTimer <= 0) {
                // Timer expired — reset taps
                p.blockShedTaps = 0;
                p.blockShedTimer = 0;
            }
        }

        // Right Click tap detection for shedding
        if (Input.mouse.rightDown) {
            p.blockShedTaps = (p.blockShedTaps || 0) + 1;
            if (p.blockShedTimer <= 0) p.blockShedTimer = 1.5; // Start 1.5s window
            Input.mouse.rightDown = false; // Consume tap

            // Check shed threshold: ceil(blocker.blocking / 4)
            const blockerBlocking = blocker.archetype.blocking || 10;
            const threshold = Math.ceil(blockerBlocking / 4);

            if (p.blockShedTaps >= threshold) {
                // SHED THE BLOCK!
                const dMoves = p.archetype.dMoves || 10;
                const burstSpeed = dMoves * 3;

                // Find the QB / ball carrier to burst toward
                let burstTarget = null;
                if (ball && ball.isHeld && ball.carrier) {
                    burstTarget = ball.carrier;
                }

                if (burstTarget) {
                    const dir = new THREE.Vector3(
                        burstTarget.body.position.x - p.body.position.x,
                        0,
                        burstTarget.body.position.z - p.body.position.z
                    ).normalize();
                    p.body.velocity.x = dir.x * burstSpeed;
                    p.body.velocity.z = dir.z * burstSpeed;
                } else {
                    // No target — burst forward
                    p.body.velocity.z = -burstSpeed;
                }

                // Award style points
                if (styleManager && p.isPlayer) {
                    styleManager.addStylePoints('player', 2000, "BLOCK SHED!", p.mesh.position, p, allPlayers);
                }

                // Clear engagement on both
                p.blockEngaged = false;
                p.aiState = p._prevAiState || AIState.BLITZ;
                p.blockShedTaps = 0;
                p.blockShedTimer = 0;

                blocker.blockEngaged = false;
                blocker.engagedWith = null;
                blocker.aiState = blocker._prevAiState || AIState.BLOCK;

                p.engagedWith = null;
                console.log("BLOCK SHED! Rusher is free!");
            }
        }
    }
}
