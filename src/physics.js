import * as CANNON from 'cannon-es';

// Physics world instance
export let world;
export let physicsMaterials = {};
export let currentSurface = 'asphalt'; // 'asphalt' or 'beach'

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
  const asphaltContact = new CANNON.ContactMaterial(
    physicsMaterials.ground,
    physicsMaterials.player,
    {
      friction: 1.0,
      restitution: 0.0, // No bounce
      contactEquationStiffness: 1e8,
      contactEquationRelaxation: 3
    }
  );
  world.addContactMaterial(asphaltContact);

  // Beach surface — lower friction for slippery sand
  const beachContact = new CANNON.ContactMaterial(
    physicsMaterials.ground,
    physicsMaterials.player,
    {
      friction: 0.3,
      restitution: 0.0,
      contactEquationStiffness: 1e8,
      contactEquationRelaxation: 3
    }
  );

  // Store for surface switching
  physicsMaterials._asphaltContact = asphaltContact;
  physicsMaterials._beachContact = beachContact;
}

export function setSurface(surfaceType) {
  currentSurface = surfaceType;
  if (surfaceType === 'beach') {
    // Swap to beach friction
    physicsMaterials._asphaltContact.friction = 0.3;
  } else {
    // Swap back to asphalt
    physicsMaterials._asphaltContact.friction = 1.0;
  }
}

export function updatePhysics(timeStep) {
  if (world) {
    world.step(timeStep);
  }
}
