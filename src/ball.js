import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { world, physicsMaterials } from './physics.js';

export class Football {
    constructor(scene) {
        this.scene = scene;

        this.isHeld = true; // Starts snapped to a player
        this.carrier = null;

        this.createVisuals();
        this.createPhysics();
    }

    createVisuals() {
        // Classic brown pigskin (ellipsoid)
        const geom = new THREE.SphereGeometry(0.4, 16, 16);
        geom.scale(1, 1, 1.5); // Stretch along Z to make it look like a football
        // Use Lambert for a slightly matte leather look
        const mat = new THREE.MeshLambertMaterial({ color: 0x5c3a21 });
        this.mesh = new THREE.Mesh(geom, mat);
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);

        // Add white laces
        const laceGeom = new THREE.BoxGeometry(0.1, 0.15, 0.6);
        const laceMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const laceMesh = new THREE.Mesh(laceGeom, laceMat);
        laceMesh.position.set(0, 0.35, 0);
        this.mesh.add(laceMesh);
    }

    createPhysics() {
        // Cannon doesn't do perfect ellipsoids well, a sphere is the standard work-around for footballs
        // to prevent chaotic, unpredictable bouncing that ruins gameplay.
        const shape = new CANNON.Sphere(0.4);

        this.body = new CANNON.Body({
            mass: 0.4, // Light
            material: physicsMaterials.slippery, // Bounces/slides a bit
            shape: shape
        });

        // Start inactive (held by QB)
        this.body.type = CANNON.Body.KINEMATIC;
        this.body.collisionFilterMask = 0; // Don't collide while held

        world.addBody(this.body);
    }

    snapToCarrier(character) {
        this.isHeld = true;
        this.carrier = character;

        this.body.type = CANNON.Body.KINEMATIC;
        this.body.velocity.set(0, 0, 0);
        this.body.angularVelocity.set(0, 0, 0);
        // Disable collisions while held so it doesn't bump the player
        this.body.collisionFilterMask = 0;
    }

    pass(targetVector3, isLob = false) {
        if (!this.isHeld || !this.carrier) return;

        this.isHeld = false;
        this.carrier = null;

        // Enable Physics
        this.body.type = CANNON.Body.DYNAMIC;
        this.body.collisionFilterMask = 1; // Re-enable collisions

        // Convert CANNON.Vec3 → THREE.Vector3 so distanceTo/subVectors work
        const target = new THREE.Vector3(targetVector3.x, targetVector3.y, targetVector3.z);

        // Calculate pass trajectory
        const origin = new THREE.Vector3().copy(this.mesh.position);
        const distance = origin.distanceTo(target);

        // Projectile motion arc calculation
        const direction = new THREE.Vector3().subVectors(target, origin);
        direction.y = 0;
        direction.normalize();

        // Lob passes go high and slow. Bullet passes go fast and flat.
        const heightY = isLob ? Math.max(15, distance * 0.4) : Math.max(3, distance * 0.1);

        // Simple arcade physics math for velocity required to hit target
        const gravity = Math.abs(world.gravity.y);
        const timeToDip = Math.sqrt((heightY * 2) / gravity);

        // Calculate required forward velocity to cross distance in that time
        // Roughly simulating a clean arc
        const forwardSpeed = distance / (timeToDip * 2);
        const upSpeed = gravity * timeToDip;

        this.body.velocity.set(
            direction.x * forwardSpeed,
            upSpeed,
            direction.z * forwardSpeed
        );

        // Add classic spiral spin
        // Convert Three direction to CANNON Vec3 for cross product math if we wanted to be dynamic, 
        // but a hardcoded Z/X spiral is fine for street arcade
        this.body.angularVelocity.set(direction.z * 10, 0, -direction.x * 10);
    }

    update() {
        if (this.isHeld && this.carrier) {
            // Pin ball to carrier's right arm side roughly
            const offset = new THREE.Vector3(1, 0.5, 0.5);

            // Rotate offset by carrier's mesh rotation so ball stays on right side
            offset.applyEuler(this.carrier.mesh.rotation);

            const newPos = new THREE.Vector3().copy(this.carrier.mesh.position).add(offset);

            this.body.position.copy(newPos);
            this.mesh.rotation.copy(this.carrier.mesh.rotation);
            // Point ball forward
            this.mesh.rotateY(Math.PI / 2);
        }

        // Sync visuals
        this.mesh.position.copy(this.body.position);
        if (!this.isHeld) {
            this.mesh.quaternion.copy(this.body.quaternion);
        }
    }
}
