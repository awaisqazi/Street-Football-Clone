import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { world, physicsMaterials, currentSurface } from './physics.js';
import { Input } from './input.js';

export class PlayerCharacter {
    constructor(scene, startPosition, archetype, isPlayer = false) {
        this.scene = scene;
        this.isPlayer = isPlayer;

        // Store the archetype / position
        this.archetype = archetype || { name: 'Default', radius: 1, height: 2, mass: 80, color: 0xff0000, speed: 85, acceleration: 150, jumpPower: 15 };

        // Use tuned legacy physics values (speed, acceleration, jumpPower) from Positions
        // RPG attributes (speed_attr, agility, catching, etc.) are available on this.archetype for game logic
        this.speed = this.archetype.speed || 85;
        this.acceleration = this.archetype.acceleration || 150;
        this.jumpPower = this.archetype.jumpPower || 15;

        // State
        this.canJump = false;
        this.isDown = false; // Flag for when tackled
        this.velocity = new THREE.Vector3();

        // Street Mechanics State
        this.isGamebreakerActive = false;
        this.isEvading = false;
        this.evasionTimer = 0;
        this.lastEvasion = ''; // To track which evasion move was performed
        this.isStyling = false;
        this.rotationLocked = false;

        this.createVisuals();
        this.createPhysics(startPosition);
    }

    createVisuals() {
        const radius = this.archetype.radius;
        const height = this.archetype.height;
        const playerColor = this.archetype.color;
        const skinTone = 0x8d5524; // Simple generic skin tone for arms/legs

        this.mesh = new THREE.Group();

        // 1. Torso/Jersey (Box/Tapered Cylinder)
        // We use a BoxGeometry to look like bulky shoulder pads
        const torsoGeom = new THREE.BoxGeometry(radius * 2, height * 0.6, radius * 1.5);
        const torsoMat = new THREE.MeshStandardMaterial({ color: playerColor, roughness: 0.9 });
        const torsoMesh = new THREE.Mesh(torsoGeom, torsoMat);
        torsoMesh.position.y = height * 0.3; // Lift up from center
        torsoMesh.castShadow = true;
        torsoMesh.receiveShadow = true;
        this.mesh.add(torsoMesh);

        // 2. Helmet (Sphere placed on top of torso)
        const helmetRadius = radius * 0.8;
        const helmetGeom = new THREE.SphereGeometry(helmetRadius, 16, 16);
        // Dark grey for standard helmet
        const helmetMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.2 });
        const helmetMesh = new THREE.Mesh(helmetGeom, helmetMat);
        helmetMesh.position.y = (height * 0.6) + helmetRadius * 0.5; // Sit on torso
        helmetMesh.castShadow = true;
        this.mesh.add(helmetMesh);

        // 3. Face Mask / Visor (To show front direction)
        const visorGeom = new THREE.CylinderGeometry(helmetRadius * 0.9, helmetRadius * 0.9, helmetRadius * 0.6, 16, 1, false, 0, Math.PI);
        const visorMat = new THREE.MeshStandardMaterial({ color: 0x111111, transparent: true, opacity: 0.8 });
        const visorMesh = new THREE.Mesh(visorGeom, visorMat);
        visorMesh.rotation.x = -Math.PI / 2;
        visorMesh.position.set(0, helmetMesh.position.y - 0.1, helmetRadius * 0.2);
        this.mesh.add(visorMesh);

        // Face Mask Bars (Simple white cylinders)
        const barGeom = new THREE.CylinderGeometry(0.05, 0.05, helmetRadius * 1.5);
        const barMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const topBar = new THREE.Mesh(barGeom, barMat);
        topBar.rotation.z = Math.PI / 2;
        topBar.position.set(0, helmetMesh.position.y - 0.1, helmetRadius);
        this.mesh.add(topBar);

        // 4. Arms (Dropping from shoulder pads)
        const armGeom = new THREE.CylinderGeometry(radius * 0.3, radius * 0.2, height * 0.7);
        const armMat = new THREE.MeshStandardMaterial({ color: skinTone });

        const leftArm = new THREE.Mesh(armGeom, armMat);
        leftArm.position.set(-radius - 0.2, height * 0.1, 0);
        leftArm.castShadow = true;
        this.mesh.add(leftArm);

        const rightArm = new THREE.Mesh(armGeom, armMat);
        rightArm.position.set(radius + 0.2, height * 0.1, 0);
        rightArm.castShadow = true;
        this.mesh.add(rightArm);

        // 5. Legs
        const legGeom = new THREE.CylinderGeometry(radius * 0.4, radius * 0.3, height * 0.8);
        // Pants match jersey
        const pantMat = new THREE.MeshStandardMaterial({ color: playerColor });

        const leftLeg = new THREE.Mesh(legGeom, pantMat);
        leftLeg.position.set(-radius * 0.5, -height * 0.4, 0);
        leftLeg.castShadow = true;
        this.mesh.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeom, pantMat);
        rightLeg.position.set(radius * 0.5, -height * 0.4, 0);
        rightLeg.castShadow = true;
        this.mesh.add(rightLeg);

        this.scene.add(this.mesh);
    }

    createPhysics(startPosition) {
        const radius = this.archetype.radius;
        const height = this.archetype.height;

        // Cannon doesn't have a perfect native capsule that works perfectly upright without tweaking, 
        // Sphere/Cylinder combos or just a Sphere with fixed rotation is often best for arcade controllers.
        // We'll use a slightly hovering Sphere and rely on raycasting for ground detection, or a simple Cylinder.
        // For Street Football, a Cylinder with fixed rotation works decently for body blocking.

        const shape = new CANNON.Cylinder(radius, radius, radius * 2 + height, 16);
        this.body = new CANNON.Body({
            mass: this.archetype.mass, // kg from archetype
            material: physicsMaterials.player,
            shape: shape,
            fixedRotation: true // Keep them standing upright
        });

        // Cylinder in cannon faces along Z by default, we want it vertical (Y)
        const quat = new CANNON.Quaternion();
        quat.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        this.body.addShape(shape, new CANNON.Vec3(0, 0, 0), quat);
        // Remove the default generated shape from the constructor
        this.body.shapes.splice(0, 1);
        this.body.shapeOffsets.splice(0, 1);
        this.body.shapeOrientations.splice(0, 1);

        this.body.position.copy(startPosition);
        world.addBody(this.body);

        // Ground Contact Listener for Jumping
        this.body.addEventListener("collide", (e) => {
            const contact = e.contact;
            // Normal vector of the contact. 
            // If the contact normal is pointing up (Y > 0.5), we hit the floor
            if (contact.ni.y > 0.5 || contact.ni.y < -0.5) { // Depends on order of bodies in contact
                this.canJump = true;
            }
        });
    }

    setGamebreaker(active) {
        this.isGamebreakerActive = active;
        if (active) {
            // Visual Buff (Neon Outline effect simulated by color blast on the torso)
            this.mesh.children[0].material.emissive.setHex(0xff3300);
            this.mesh.children[0].material.emissiveIntensity = 0.8;
            // Also color the helmet
            this.mesh.children[1].material.emissive.setHex(0xff3300);
            this.mesh.children[1].material.emissiveIntensity = 0.5;
        } else {
            this.mesh.children[0].material.emissive.setHex(0x000000);
            this.mesh.children[1].material.emissive.setHex(0x000000);
        }
    }

    update(deltaTime, camera) {
        if (this.isEvading) {
            this.evasionTimer -= deltaTime;
            if (this.evasionTimer <= 0) {
                this.isEvading = false;
                this.lastEvasion = '';
            }
        }

        // Sync visuals to physics
        this.mesh.position.copy(this.body.position);
        this.mesh.position.y -= 1; // Offset center so bottom of cylinder touches ground

        // Smooth rotation towards velocity direction (unless spinning or rotation-locked)
        if (this.velocity.lengthSq() > 0.1 && !this.isEvading && !this.rotationLocked) {
            const targetAngle = Math.atan2(this.velocity.x, this.velocity.z);
            // Simple snappy rotation
            this.mesh.rotation.y = targetAngle;
        } else if (this.isEvading && this.lastEvasion === 'spin') {
            // Arcade spin visual
            this.mesh.rotation.y += 20 * deltaTime;
        }
    }

    handleInput(deltaTime, camera, allPlayers) {
        // Reset styling flag each frame
        this.isStyling = false;

        // Prevent new input while currently executing a juke/spin
        if (this.isEvading) return;

        // Reset rotation lock when not evading
        this.rotationLocked = false;

        // 1. Calculate movement relative to camera angle
        this.velocity.set(0, 0, 0);

        // WASD Movement
        if (Input.keys.w) this.velocity.z -= 1;
        if (Input.keys.s) this.velocity.z += 1;
        if (Input.keys.a) this.velocity.x -= 1;
        if (Input.keys.d) this.velocity.x += 1;

        // Get camera vectors
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        // --- Helper: find nearest opponent distance ---
        const _findNearestOpponentDist = () => {
            let minDist = Infinity;
            if (!allPlayers) return minDist;
            const myPos = this.body.position;
            for (const p of allPlayers) {
                if (p === this || p.team === this.team) continue;
                const dx = p.body.position.x - myPos.x;
                const dz = p.body.position.z - myPos.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                if (dist < minDist) minDist = dist;
            }
            return minDist;
        };

        // Context-Sensitive Evasion (E key)
        if (this.canJump && Input.keys.evade) {
            const nearestDist = _findNearestOpponentDist();
            this.isEvading = true;

            if (nearestDist < 4) {
                // Spin Move — opponent is close
                this.evasionTimer = 0.4;
                this.lastEvasion = 'spin';

                // Beach poor footing check
                if (currentSurface === 'beach') {
                    const agility = this.archetype.agility || 10;
                    if (Math.random() * 20 > agility) {
                        // Poor footing — cancel evade, drop velocity
                        this.body.velocity.x = 0;
                        this.body.velocity.z = 0;
                        this.evasionTimer = 0.5; // Stumble recovery
                        this.lastEvasion = 'stumble';
                        Input.keys.evade = false;
                        return;
                    }
                }

                this.body.velocity.x += forward.x * 30;
                this.body.velocity.z += forward.z * 30;
            } else {
                // Juke — opponent is far, lateral cut
                this.evasionTimer = 0.3;
                this.lastEvasion = 'juke';

                // Beach poor footing check
                if (currentSurface === 'beach') {
                    const agility = this.archetype.agility || 10;
                    if (Math.random() * 20 > agility) {
                        this.body.velocity.x = 0;
                        this.body.velocity.z = 0;
                        this.evasionTimer = 0.5;
                        this.lastEvasion = 'stumble';
                        Input.keys.evade = false;
                        return;
                    }
                }

                // Default juke to the right; camera-relative
                const jukeVector = new THREE.Vector3().copy(right).multiplyScalar(35);
                this.body.velocity.x = jukeVector.x;
                this.body.velocity.z = jukeVector.z;
            }

            if (Input.keys.style) this.isStyling = true;
            Input.keys.evade = false; // Consume input
            return;
        }

        // Dive Tackle (Defense only — Left Click)
        if (this.team === 'defense' && Input.mouse.leftDown && this.canJump) {
            this.isEvading = true;
            this.evasionTimer = 0.6;
            this.lastEvasion = 'dive';

            if (Input.keys.style) {
                // Defensive Power Tackle — faster but locked rotation
                this.isStyling = true;
                this.rotationLocked = true;
                this.body.velocity.x = forward.x * 35 * 1.5;
                this.body.velocity.z = forward.z * 35 * 1.5;
                this.body.velocity.y = 2;
            } else {
                // Normal dive tackle
                this.body.velocity.x = forward.x * 35;
                this.body.velocity.z = forward.z * 35;
                this.body.velocity.y = 2;
            }
            Input.mouse.leftDown = false; // Consume
            return;
        }

        // Power Move (Right Click)
        if (Input.mouse.rightDown && this.canJump) {
            this.isEvading = true;
            if (this.team === 'offense') {
                // Stiff Arm — keeps momentum, blocks tackle via evasion
                this.evasionTimer = 0.5;
                this.lastEvasion = 'stiff_arm';
                if (Input.keys.style) this.isStyling = true;
            } else {
                // Rip Move — shed blocks with a burst forward
                this.evasionTimer = 0.5;
                this.lastEvasion = 'rip_move';
                this.body.velocity.x += forward.x * 20;
                this.body.velocity.z += forward.z * 20;
            }
            Input.mouse.rightDown = false; // Consume
            return;
        }

        // Wall Raycasting logic for Wall Jumps
        let wallForward = false;
        if (!this.canJump) {
            // Raycast sideways to see if we can boundary kick
            // Check intersections manually since Cannon raycast is simpler
        }

        if (this.velocity.lengthSq() > 0) {
            this.velocity.normalize();

            // Combine input with camera vectors
            const moveDirection = new THREE.Vector3()
                .addScaledVector(right, this.velocity.x)
                .addScaledVector(forward, -this.velocity.z);

            // Apply street arcade acceleration
            const speedMultiplier = this.isGamebreakerActive ? 2.0 : 1.0;
            const surfaceDrag = currentSurface === 'beach' ? 0.85 : 1.0;
            // Sprint only works if team has turbo remaining
            const canSprint = Input.keys.shift && this._turboRef && this._turboRef() > 0;
            const activeSpeed = (canSprint ? this.speed * 2.2 : this.speed) * speedMultiplier * surfaceDrag;

            // Direct velocity set — fixed multiplier for frame-independent arcade speed
            this.body.velocity.x = moveDirection.x * activeSpeed * 0.4;
            this.body.velocity.z = moveDirection.z * activeSpeed * 0.4;

            // Store velocity vector for visual rotation
            this.velocity.copy(moveDirection);

            // Style modifier while moving
            if (Input.keys.style) this.isStyling = true;
        } else {
            // High friction stop — cut on a dime
            this.body.velocity.x *= 0.3;
            this.body.velocity.z *= 0.3;
        }

        // Jumping & Hurdling
        if (Input.keys.space && !window.blockJumpThisFrame) {
            if (this.canJump) {
                // Hurdle if sprinting
                const isHurdle = Input.keys.shift;
                this.body.velocity.y = isHurdle ? this.jumpPower * 1.3 : this.jumpPower;

                if (isHurdle) {
                    this.isEvading = true;
                    this.evasionTimer = 0.5;
                    this.lastEvasion = 'hurdle';
                }
                this.canJump = false;
            } else {
                // Mid-air: check for WALL KICK
                const px = this.body.position.x;
                if ((px > 27 || px < -27) && this.body.velocity.y < 5) {
                    const kickDir = px > 0 ? -1 : 1;
                    this.body.velocity.y = this.jumpPower * 1.2;
                    this.body.velocity.x = kickDir * 20;
                    console.log("WALL JUMP!");
                }
            }
            Input.keys.space = false;
        }
    }

    // Knockback effect handles massive arcade tackles
    applyTackleImpulse(forceVector) {
        if (this.isGamebreakerActive) return; // Invulnerable to physics knockback while GB is active

        this.body.velocity.vadd(forceVector, this.body.velocity);
        this.canJump = false; // Send them flying
        this.isDown = true;
    }
}
