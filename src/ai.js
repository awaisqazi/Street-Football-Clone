import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { GameState } from './gameFlow.js';

// Basic AI states
export const AIState = {
    IDLE: 0,
    RUN_ROUTE: 1,
    MAN_COVERAGE: 2,
    BLITZ: 3,
    CPU_QB: 4
};

export class AIManager {
    constructor() {

    }

    assignPlay(players, play, opponentTeam, isOffense) {
        if (isOffense) {
            // Assign routes
            // Very simple dummy assignment for Phase 3
            players.forEach((p, index) => {
                if (index === 0) { // Quick hack: index 0 is QB
                    if (!p.isPlayer) {
                        p.aiState = AIState.CPU_QB;
                        p.passTimer = 1.5 + Math.random() * 1.5; // Wait 1.5 to 3 seconds
                    }
                    return;
                }

                p.aiState = AIState.RUN_ROUTE;
                // Simple switch: even numbers run fly (straight Z), odd numbers run slant (diagonal)
                const dirOffense = p.team === "offense" ? (opponentTeam && opponentTeam[0].isPlayer ? 1 : -1) : 1;

                if (index % 2 === 0) {
                    p.routeTarget = new THREE.Vector3(p.mesh.position.x, 0, p.mesh.position.z + (50 * dirOffense)); // Deep
                } else {
                    p.routeTarget = new THREE.Vector3(0, 0, p.mesh.position.z + (15 * dirOffense)); // Slant to center
                }
            });
        } else {
            // Defense assignments
            players.forEach((p, index) => {
                if (play.type === "man" || play.type === "zone") {
                    p.aiState = AIState.MAN_COVERAGE;
                    // Pick a random offensive player to cover
                    p.targetPlayer = opponentTeam[index % opponentTeam.length];
                } else if (play.type === "blitz") {
                    p.aiState = AIState.BLITZ;
                    // Find the opponent QB (the one with isPlayer usually, or carrying ball)
                    p.targetPlayer = opponentTeam.find(o => o.isPlayer) || opponentTeam[0];
                }
            });
        }
    }

    update(players, deltaTime, gameManager, ball) {
        if (gameManager.currentState !== GameState.LIVE_ACTION) {
            // Stop moving
            players.forEach(p => {
                if (!p.isPlayer) {
                    p.body.velocity.x *= 0.8;
                    p.body.velocity.z *= 0.8;
                }
            });
            return;
        }

        players.forEach(p => {
            if (p.isPlayer) return; // Handled by input

            const pPos = p.body.position;
            let targetVec = null;

            if (p.aiState === AIState.RUN_ROUTE && p.routeTarget) {
                targetVec = new CANNON.Vec3(p.routeTarget.x, pPos.y, p.routeTarget.z);
            }
            else if (p.aiState === AIState.MAN_COVERAGE || p.aiState === AIState.BLITZ) {
                if (p.targetPlayer) {
                    targetVec = new CANNON.Vec3(p.targetPlayer.body.position.x, pPos.y, p.targetPlayer.body.position.z);
                }
            }

            // Move towards target
            if (targetVec) {
                const dir = new CANNON.Vec3();
                targetVec.vsub(pPos, dir);

                if (dir.lengthSquared() > 1) { // Not there yet
                    dir.normalize();
                    // High friction acceleration towards target
                    p.body.velocity.x = dir.x * p.speed * deltaTime * 8;
                    p.body.velocity.z = dir.z * p.speed * deltaTime * 8;

                    // Look direction
                    p.mesh.rotation.y = Math.atan2(dir.x, dir.z);
                } else {
                    // Reached target
                    p.body.velocity.x *= 0.8;
                    p.body.velocity.z *= 0.8;
                }
            }
            // CPU QB Logic
            if (p.aiState === AIState.CPU_QB) {
                if (p.passTimer !== undefined) p.passTimer -= deltaTime;
                if (p.passTimer <= 0 && ball.isHeld && ball.carrier === p) {
                    // Find eligible receivers
                    const receivers = players.filter(r => r !== p && r.team === p.team);
                    if (receivers.length > 0) {
                        const targetReceiver = receivers[Math.floor(Math.random() * receivers.length)];

                        const targetPos = targetReceiver.body.position;
                        const leadPos = new CANNON.Vec3(
                            targetPos.x + targetReceiver.body.velocity.x * 0.5,
                            targetPos.y,
                            targetPos.z + targetReceiver.body.velocity.z * 0.5
                        );

                        ball.pass(leadPos, false); // bullet pass
                        p.aiState = AIState.IDLE;
                        console.log("CPU QB threw the ball!");
                    }
                }
            }
        });

        // Check for tackles to end the play
        if (ball.isHeld && ball.carrier) {
            const carrier = ball.carrier;
            if (carrier.isDown) {
                // Tackled! Whistle!
                gameManager.endPlay(carrier.body.position.z);
            }
        }
    }
}
