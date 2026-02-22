import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { world, physicsMaterials } from './physics.js';

export function createEnvironment(scene) {
    // 1. Concrete Ground
    const groundGeom = new THREE.PlaneGeometry(150, 150);
    // Dark gritty grey
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9, metalness: 0.1 });
    const groundMesh = new THREE.Mesh(groundGeom, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Ground Physics
    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({
        mass: 0, // static mass makes it unmovable
        material: physicsMaterials.ground,
        shape: groundShape
    });
    // Cannon planes face +Z, rotate to match Three.js (facing +Y)
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.addBody(groundBody);

    // 2. Surrounding Walls (Brick style bounds)
    // X = +/- 30 (width), Z = +/- 50 (length) - roughly a street field size
    const fieldWidth = 60;
    const fieldLength = 100;
    const wallHeight = 8;
    const wallThickness = 2;

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x5a2d22 }); // Dark red/brown brick color

    createWall(scene, new CANNON.Vec3(0, wallHeight / 2, -fieldLength / 2), new CANNON.Vec3(fieldWidth, wallHeight, wallThickness), wallMat); // North
    createWall(scene, new CANNON.Vec3(0, wallHeight / 2, fieldLength / 2), new CANNON.Vec3(fieldWidth, wallHeight, wallThickness), wallMat); // South
    createWall(scene, new CANNON.Vec3(-fieldWidth / 2, wallHeight / 2, 0), new CANNON.Vec3(wallThickness, wallHeight, fieldLength), wallMat); // West
    createWall(scene, new CANNON.Vec3(fieldWidth / 2, wallHeight / 2, 0), new CANNON.Vec3(wallThickness, wallHeight, fieldLength), wallMat); // East

    // 3. Parkour Obstacles (Barrels)
    createObstacle(scene, new CANNON.Vec3(-fieldWidth / 2 + 2, 1, 10));
    createObstacle(scene, new CANNON.Vec3(fieldWidth / 2 - 2, 1, -20));
    createObstacle(scene, new CANNON.Vec3(-fieldWidth / 2 + 5, 1, 25));
}

function createWall(scene, position, size, material) {
    const geom = new THREE.BoxGeometry(size.x, size.y, size.z);
    const mesh = new THREE.Mesh(geom, material);
    mesh.position.copy(position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const shape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
    const body = new CANNON.Body({ mass: 0, shape: shape }); // static
    body.position.copy(position);
    body.material = physicsMaterials.slippery;
    world.addBody(body);
}

function createObstacle(scene, position) {
    const radius = 1;
    const height = 2;
    const geom = new THREE.CylinderGeometry(radius, radius, height, 16);
    // Yellow street barrel
    const mat = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.7 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // For physics, we will use a Box shape representing the bounding box for simplicity and perfection in bouncing/jumping off it.
    const shape = new CANNON.Box(new CANNON.Vec3(radius, height / 2, radius));
    const body = new CANNON.Body({ mass: 0, shape: shape }); // static obstacle
    body.position.copy(position);
    world.addBody(body);
}
