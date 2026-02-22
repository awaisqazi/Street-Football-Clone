import * as CANNON from 'cannon-es';

// Physics world instance
export let world;
export let physicsMaterials = {};

export function initPhysics() {
  world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -25, 0), // Exaggerated gravity for snappy, street arcade style (standard is -9.81)
  });
  
  // Sweep and prune for better performance
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.solver.iterations = 10;
  
  // Setup physics materials for defining friction and bounciness (restitution)
  physicsMaterials.slippery = new CANNON.Material('slippery'); // Wall-surfing?
  physicsMaterials.ground = new CANNON.Material('ground'); // High friction for sharp cuts
  physicsMaterials.player = new CANNON.Material('player');
  
  // Contact material for player vs ground (high friction for sharp jukes)
  const playerGroundContact = new CANNON.ContactMaterial(
    physicsMaterials.ground,
    physicsMaterials.player,
    {
      friction: 1.0, 
      restitution: 0.0, // No bounce
      contactEquationStiffness: 1e8,
      contactEquationRelaxation: 3
    }
  );
  world.addContactMaterial(playerGroundContact);
}

export function updatePhysics(timeStep) {
  if (world) {
    world.step(timeStep);
  }
}
