import * as CANNON from 'cannon-es';
import * as THREE from 'three';

// Basic AI states
export const AIState = {
    IDLE: 0,
    RUN_ROUTE: 1,
    MAN_COVERAGE: 2,
    BLITZ: 3
};

export class AIManager {
    constructor() {

    }

    assignPlay(players, play, opponentTeam, isOffense) {
        if (isOffense) {
            // Assign routes
            // Very simple dummy assignment for Phase 3
            players.forEach((p, index) => {
                if (p.isPlayer) return; // QB is controlled
                p.aiState = AIState.RUN_ROUTE;

                // Simple switch: even numbers run fly (straight Z), odd numbers run slant (diagonal)
                if (index % 2 === 0) {
                    p.routeTarget = new THREE.Vector3(p.mesh.position.x, 0, p.mesh.position.z + 50); // Deep
                } else {
                    p.routeTarget = new THREE.Vector3(0, 0, p.mesh.position.z + 15); // Slant to center
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
        // GameState 4 is LIVE_ACTION
        if (gameManager.currentState !== 4) {
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
        });

        // Check for tackles to end the play
        if (ball.isHeld && ball.carrier) {
            const carrier = ball.carrier;
            if (carrier.isDown) {
                // Tackled! Whistle!
                gameManager.endPlay(carrier.body.position.z);
            }
        } else {
            // Incomplete pass? (Ball on ground)
            if (ball.body.position.y < 0.6 && ball.body.velocity.lengthSquared() < 2) {
                console.log("Incomplete pass...");
                // Retain LOS, increment down
                gameManager.endPlay(gameManager.lineOfScrimmageZ);
                ball.body.position.set(0, -10, 0); // Hide it
            }
        }
    }
}
