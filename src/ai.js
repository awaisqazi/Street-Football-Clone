import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { GameState } from './gameFlow.js';

// AI states
export const AIState = {
    IDLE: 0,
    RUN_ROUTE: 1,
    MAN_COVERAGE: 2,
    BLITZ: 3,
    CPU_QB: 4,
    BLOCK: 5,
    ENGAGED_BLOCK: 6
};

// Map playbook position labels → team composition indices
// Team composition: [QB(0), RB(1), WR(2), WR(3), OL(4), LB(5), DB(6)]
const POSITION_INDEX = {
    'QB': 0,
    'RB': 1,
    'WR1': 2,
    'WR2': 3,
    'OL': 4,
    'LB': 5,
    'DB': 6
};

export class AIManager {
    constructor() { }

    /**
     * Calculate a 3D route target from a playbook action string.
     * dir = -1 when player is on offense (drives -Z), +1 when CPU is on offense (drives +Z)
     */
    _routeTarget(startPos, action, dir, opponentTeam) {
        const x = startPos.x;
        const z = startPos.z;

        switch (action) {
            case 'fly':
                // Straight deep
                return new THREE.Vector3(x, 0, z + (60 * dir));

            case 'slant':
                // Diagonal across middle
                return new THREE.Vector3(x + (x > 0 ? -20 : 20), 0, z + (20 * dir));

            case 'curl':
                // Run forward 15 then stop (handled by reaching target → IDLE)
                return new THREE.Vector3(x, 0, z + (15 * dir));

            case 'flat':
                // Horizontal to the sideline
                return new THREE.Vector3(x + (x > 0 ? 25 : -25), 0, z + (5 * dir));

            case 'post':
                // Deep and cut to middle
                return new THREE.Vector3(0, 0, z + (45 * dir));

            case 'run_forward':
                // RB run — straight ahead
                return new THREE.Vector3(x, 0, z + (40 * dir));

            case 'handoff':
                // QB hands off then stays put
                return null;

            case 'block':
                // Block nearest defender — handled separately
                return null;

            default:
                // Unknown action, just run a fly
                return new THREE.Vector3(x, 0, z + (40 * dir));
        }
    }

    assignPlay(players, play, opponentTeam, isOffense) {
        // Determine drive direction: player offense = -Z, cpu offense = +Z
        const playerOnOffense = opponentTeam && opponentTeam.length > 0 && !opponentTeam[0].isPlayer;
        // If the offense team contains the human player, they drive -Z
        const dir = playerOnOffense ? -1 : 1;

        if (isOffense) {
            // --- OFFENSE ---
            // Default all non-QB to IDLE
            players.forEach((p, i) => {
                if (i === 0) {
                    // QB
                    if (!p.isPlayer) {
                        p.aiState = AIState.CPU_QB;
                        p.passTimer = 1.5 + Math.random() * 1.5;
                    } else {
                        p.aiState = AIState.IDLE;
                    }
                    return;
                }
                p.aiState = AIState.IDLE;
                p.routeTarget = null;
            });

            // Parse play routes and assign to the correct players
            if (play && play.routes) {
                for (const route of play.routes) {
                    const idx = POSITION_INDEX[route.position];
                    if (idx === undefined || idx >= players.length) continue;

                    const p = players[idx];
                    const startPos = p.mesh.position;

                    if (route.action === 'block') {
                        // Block: find nearest defender and chase them
                        p.aiState = AIState.BLOCK;
                        p.targetPlayer = this._findNearest(p, opponentTeam);
                    } else if (route.action === 'handoff') {
                        // QB stays put during handoff
                        p.aiState = AIState.IDLE;
                    } else {
                        // Route running
                        p.aiState = AIState.RUN_ROUTE;
                        p.routeTarget = this._routeTarget(startPos, route.action, dir, opponentTeam);
                        // Curl routes: mark so we can switch to IDLE on arrival
                        p._isCurl = (route.action === 'curl');
                    }
                }
            }

            // Any offensive player without an assigned route runs a default fly
            players.forEach((p, i) => {
                if (i === 0) return; // Skip QB
                if (p.aiState === AIState.IDLE && !p.isPlayer) {
                    p.aiState = AIState.RUN_ROUTE;
                    p.routeTarget = new THREE.Vector3(
                        p.mesh.position.x,
                        0,
                        p.mesh.position.z + (40 * dir)
                    );
                }
            });

        } else {
            // --- DEFENSE (Ironman Role Mapping) ---
            // Team comp indices: [QB(0), RB(1), WR(2), WR(3), OL(4), LB(5), DB(6)]
            // Map by offensive position to defensive role
            players.forEach((p, index) => {
                const posName = p.archetype.name || '';

                if (play && play.type === 'blitz') {
                    // Full blitz override
                    p.aiState = AIState.BLITZ;
                    p.targetPlayer = opponentTeam.find(o => o.isPlayer) || opponentTeam[0];
                    p.defenseRole = 'blitz';
                } else if (posName === 'Offensive Lineman') {
                    // OL plays DL — rush the QB/carrier
                    p.aiState = AIState.BLITZ;
                    p.targetPlayer = opponentTeam[0]; // Target QB
                    p.defenseRole = 'dl_rush';
                } else if (posName === 'Wide Receiver') {
                    // WR plays DB — man coverage on matched opponent
                    p.aiState = AIState.MAN_COVERAGE;
                    p.targetPlayer = opponentTeam[index % opponentTeam.length];
                    p.defenseRole = 'db_man';
                } else if (posName === 'Running Back') {
                    // RB plays LB — zone coverage with looser cushion
                    p.aiState = AIState.MAN_COVERAGE;
                    p.targetPlayer = opponentTeam[index % opponentTeam.length];
                    p.defenseRole = 'lb_zone';
                } else if (posName === 'Quarterback') {
                    // QB plays safety — zone, cover nearest receiver
                    p.aiState = AIState.MAN_COVERAGE;
                    p.targetPlayer = opponentTeam[index % opponentTeam.length];
                    p.defenseRole = 'safety';
                } else {
                    // LB, DB — natural defenders, keep standard man coverage
                    p.aiState = AIState.MAN_COVERAGE;
                    p.targetPlayer = opponentTeam[index % opponentTeam.length];
                    p.defenseRole = posName.toLowerCase().includes('linebacker') ? 'lb' : 'db';
                }
            });
        }
    }

    /** Find the nearest player from a team to a given player */
    _findNearest(player, team) {
        let closest = null;
        let minDist = Infinity;
        for (const t of team) {
            const dx = t.body.position.x - player.body.position.x;
            const dz = t.body.position.z - player.body.position.z;
            const d = dx * dx + dz * dz;
            if (d < minDist) {
                minDist = d;
                closest = t;
            }
        }
        return closest;
    }

    update(players, deltaTime, gameManager, ball) {
        if (gameManager.currentState !== GameState.LIVE_ACTION) {
            players.forEach(p => {
                if (!p.isPlayer) {
                    p.body.velocity.x *= 0.8;
                    p.body.velocity.z *= 0.8;
                }
            });
            return;
        }

        // Drive direction for man coverage cushion
        const playerPossession = gameManager.possession === 'player';

        players.forEach(p => {
            if (p.isPlayer) return; // Handled by input

            const pPos = p.body.position;
            let targetVec = null;
            const aiSpeed = p.speed * 0.35; // AI movement speed (slightly slower than player sprint)

            // --- ROUTE RUNNING ---
            if (p.aiState === AIState.RUN_ROUTE && p.routeTarget) {
                targetVec = new CANNON.Vec3(p.routeTarget.x, pPos.y, p.routeTarget.z);

                // Check if arrived at route target
                const dx = p.routeTarget.x - pPos.x;
                const dz = p.routeTarget.z - pPos.z;
                if (dx * dx + dz * dz < 4) {
                    // Curl routes: stop and face QB
                    if (p._isCurl) {
                        p.aiState = AIState.IDLE;
                        p.body.velocity.x *= 0.2;
                        p.body.velocity.z *= 0.2;
                        targetVec = null;
                    }
                }
            }

            // --- MAN COVERAGE ---
            else if (p.aiState === AIState.MAN_COVERAGE && p.targetPlayer) {
                const oppPos = p.targetPlayer.body.position;
                // Stay between the receiver and the endzone — offset toward the endzone
                const cushionZ = playerPossession ? -3 : 3; // Shade toward the endzone
                targetVec = new CANNON.Vec3(oppPos.x, pPos.y, oppPos.z + cushionZ);
            }

            // --- BLITZ ---
            else if (p.aiState === AIState.BLITZ) {
                // Rush the ball carrier or QB
                const target = (ball.isHeld && ball.carrier) ? ball.carrier : p.targetPlayer;
                if (target) {
                    targetVec = new CANNON.Vec3(target.body.position.x, pPos.y, target.body.position.z);
                }
            }

            // --- BLOCK ---
            else if (p.aiState === AIState.BLOCK && p.targetPlayer) {
                // Update target to nearest defender each frame
                targetVec = new CANNON.Vec3(
                    p.targetPlayer.body.position.x,
                    pPos.y,
                    p.targetPlayer.body.position.z
                );
            }

            // --- MOVE TOWARD TARGET ---
            if (targetVec) {
                const dir = new CANNON.Vec3();
                targetVec.vsub(pPos, dir);

                if (dir.lengthSquared() > 1) {
                    dir.normalize();
                    p.body.velocity.x = dir.x * aiSpeed;
                    p.body.velocity.z = dir.z * aiSpeed;

                    // Face direction of movement
                    p.mesh.rotation.y = Math.atan2(dir.x, dir.z);
                } else {
                    // Arrived — slow down
                    p.body.velocity.x *= 0.3;
                    p.body.velocity.z *= 0.3;
                }
            } else if (p.aiState === AIState.IDLE) {
                // Idle players slow to a stop
                p.body.velocity.x *= 0.3;
                p.body.velocity.z *= 0.3;
            } else if (p.aiState === AIState.ENGAGED_BLOCK) {
                // Locked in block engagement — suppress AI movement
                p.body.velocity.x *= 0.1;
                p.body.velocity.z *= 0.1;
            }

            // --- CPU QB LOGIC ---
            if (p.aiState === AIState.CPU_QB) {
                if (p.passTimer !== undefined) p.passTimer -= deltaTime;
                if (p.passTimer <= 0 && ball.isHeld && ball.carrier === p) {
                    // Find eligible receivers on the same team
                    const receivers = players.filter(r => r !== p && r.team === p.team);
                    if (receivers.length > 0) {
                        const targetReceiver = receivers[Math.floor(Math.random() * receivers.length)];

                        const tPos = targetReceiver.body.position;
                        const leadPos = new CANNON.Vec3(
                            tPos.x + targetReceiver.body.velocity.x * 0.5,
                            tPos.y,
                            tPos.z + targetReceiver.body.velocity.z * 0.5
                        );

                        ball.pass(leadPos, false);
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
                gameManager.endPlay(carrier.body.position.z);
            }
        }
    }
}
