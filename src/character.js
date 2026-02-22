import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { world, physicsMaterials } from './physics.js';
import { Input } from './input.js';

export class PlayerCharacter {
    constructor(scene, startPosition, archetype, isPlayer = false) {
        this.scene = scene;
        this.isPlayer = isPlayer;

        // Store the archetype
        this.archetype = archetype || { name: 'Default', speed: 85, acceleration: 150, jumpPower: 15, mass: 80, radius: 1, height: 2, color: 0xff0000 };

        // Stats from archetype
        this.speed = this.archetype.speed;
        this.acceleration = this.archetype.acceleration;
        this.jumpPower = this.archetype.jumpPower;

        // State
        this.canJump = false;
        this.isDown = false; // Flag for when tackled
        this.velocity = new THREE.Vector3();

        // Street Mechanics State
        this.isGamebreakerActive = false;
        this.isEvading = false;
        this.evasionTimer = 0;
        this.lastEvasion = ''; // To track which evasion move was performed

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

        // Smooth rotation towards velocity direction (unless spinning)
        if (this.velocity.lengthSq() > 0.1 && !this.isEvading) {
            const targetAngle = Math.atan2(this.velocity.x, this.velocity.z);
            // Simple snappy rotation
            this.mesh.rotation.y = targetAngle;
        } else if (this.isEvading && this.lastEvasion === 'spin') {
            // Arcade spin visual
            this.mesh.rotation.y += 20 * deltaTime;
        }
    }

    handleInput(deltaTime, camera) {
        // Prevent new input while currently executing a juke/spin
        if (this.isEvading) return;

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

        // Evasive Moves (Juke)
        if (this.canJump && (Input.keys.q || Input.keys.e)) {
            this.isEvading = true;
            this.evasionTimer = 0.3; // 0.3 seconds of invulnerability
            this.lastEvasion = 'juke';

            const jukeDir = Input.keys.q ? -1 : 1;
            const jukeVector = new THREE.Vector3().copy(right).multiplyScalar(jukeDir * 20);

            this.body.velocity.x = jukeVector.x;
            this.body.velocity.z = jukeVector.z;
            Input.keys.q = false; // Consume input
            Input.keys.e = false;
            return;
        }

        // Spin Move
        if (this.canJump && Input.keys.f) {
            this.isEvading = true;
            this.evasionTimer = 0.4;
            this.lastEvasion = 'spin';
            // Slight forward burst
            this.body.velocity.x += forward.x * 15;
            this.body.velocity.z += forward.z * 15;
            Input.keys.f = false;
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
            const activeSpeed = (Input.keys.shift ? this.speed * 1.5 : this.speed) * speedMultiplier;

            // We alter the Cannon body velocity directly for snappy arcade response instead of using applyForce
            this.body.velocity.x = moveDirection.x * activeSpeed * deltaTime * 10;
            this.body.velocity.z = moveDirection.z * activeSpeed * deltaTime * 10;

            // Store velocity vector for visual rotation
            this.velocity.copy(moveDirection);
        } else {
            // High friction stop
            this.body.velocity.x *= 0.5;
            this.body.velocity.z *= 0.5;
        }

        // Jumping & Hurdling
        // We ensure snapping is clean by checking a global flag or tracking
        // But since we removed the handleInput call from update, the issue the user saw
        // might have just been my manual test. Let's ensure this is clean.
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
                // Simplistic bounding box check against known wall limits (X = +/- 30)
                const px = this.body.position.x;
                if ((px > 27 || px < -27) && this.body.velocity.y < 5) { // Near wall, falling down
                    const kickDir = px > 0 ? -1 : 1;
                    this.body.velocity.y = this.jumpPower * 1.2;
                    this.body.velocity.x = kickDir * 20; // Kick off wall inward
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
