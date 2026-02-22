import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { initPhysics, updatePhysics, world } from './physics.js';
import { createEnvironment } from './environment.js';
import { Input } from './input.js';
import { PlayerCharacter } from './character.js';
import { Football } from './ball.js';
import { setupTackling } from './tackle.js';
import { GameManager, GameState } from './gameFlow.js';
import { UIManager } from './ui.js';
import { Playbook } from './playbook.js';
import { AIManager } from './ai.js';
import { StyleManager } from './stylePoints.js';
import { Positions } from './roster.js';
import { AudioManager } from './audio.js';

let scene, camera, renderer, clock;

// Pass keys
const passKeys = ['z', 'x', 'c', 'v', 'b', 'n'];

// Phase 3 & 4 Systems
let gameManager, uiManager, aiManager, styleManager, audioManager;
let ball;

// Ironman Teams — persistent 7-man rosters that play both sides
let playerTeam = [];
let cpuTeam = [];
let allPlayers = [];

// Derived per-play (set in startPlayCycle)
let offenseTeam = [];
let defenseTeam = [];

// Field markers
let losMarker, firstDownMarker;

// Community Turbo — shared sprint meter per team (0–100)
export let turbo = { player: 100, cpu: 100 };
const TURBO_DRAIN_RATE = 30;   // units per second while sprinting
const TURBO_RECHARGE_RATE = 15; // units per second while not sprinting

// Standard 7-man street composition
const TEAM_COMPOSITION = [
  Positions.QB,
  Positions.RB,
  Positions.WR,
  Positions.WR,
  Positions.OL,
  Positions.LB,
  Positions.DB
];

function init() {
  const container = document.getElementById('game-container');
  Input.init();

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a1128);
  scene.fog = new THREE.FogExp2(0x0a1128, 0.015);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffddaa, 1.2);
  dirLight.position.set(-20, 50, 20);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.left = -50;
  dirLight.shadow.camera.right = 50;
  dirLight.shadow.camera.top = 50;
  dirLight.shadow.camera.bottom = -50;
  dirLight.shadow.camera.near = 10;
  dirLight.shadow.camera.far = 100;
  scene.add(dirLight);

  initPhysics();
  createEnvironment(scene);

  // Field Markers
  const markerGeom = new THREE.PlaneGeometry(60, 1);
  const losMat = new THREE.MeshBasicMaterial({ color: 0x0055ff, transparent: true, opacity: 0.5 });
  losMarker = new THREE.Mesh(markerGeom, losMat);
  losMarker.rotation.x = -Math.PI / 2;
  losMarker.position.y = 0.1;
  scene.add(losMarker);

  const fdMat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.5 });
  firstDownMarker = new THREE.Mesh(markerGeom, fdMat);
  firstDownMarker.rotation.x = -Math.PI / 2;
  firstDownMarker.position.y = 0.1;
  scene.add(firstDownMarker);

  // Core Game Systems
  gameManager = new GameManager();
  uiManager = new UIManager();
  aiManager = new AIManager();
  styleManager = new StyleManager(scene, camera);
  audioManager = new AudioManager();

  // Create Football
  ball = new Football(scene);

  window.addEventListener('resize', onWindowResize);
  clock = new THREE.Clock();

  // Player Switching & Gamebreaker
  window.addEventListener('keydown', (e) => {
    // Defense player switching (Pillar 2)
    if ((e.code === 'Space' || e.code === 'Tab') && gameManager.possession === 'cpu' && gameManager.currentState === GameState.LIVE_ACTION) {
      e.preventDefault();

      // Find closest defender to the ball (player's team is on defense when CPU has possession)
      let closest = null;
      let minDistance = Infinity;
      const myDefenders = allPlayers.filter(p => p.team === 'defense');
      myDefenders.forEach(d => {
        const dist = d.mesh.position.distanceToSquared(ball.mesh.position);
        if (dist < minDistance) {
          minDistance = dist;
          closest = d;
        }
      });
      if (closest) {
        allPlayers.forEach(p => p.isPlayer = false);
        closest.isPlayer = true;
      }
    }

    // Gamebreaker Trigger
    if (e.code === 'KeyG' && gameManager.currentState === GameState.LIVE_ACTION) {
      if (styleManager.activateGamebreaker('player')) {
        allPlayers.forEach(p => {
          if (p.isPlayer || playerTeam.includes(p)) {
            p.setGamebreaker(true);
          }
        });
      }
    }
  });

  // Start the game loop with Main Menu
  uiManager.showMainMenu(() => {
    uiManager.showRosterMenu(() => {
      setupTeams();
      audioManager.playBGM();
      document.getElementById('style-meters').style.display = 'flex';
      startPlayCycle();
    });
  });

  // Mute Button Logic
  const muteBtn = document.getElementById('mute-btn');
  muteBtn.addEventListener('click', () => {
    audioManager.resume(); // Ensure AudioContext is running (browser autoplay policy)
    const isMuted = audioManager.toggleMute();
    muteBtn.innerText = isMuted ? "🔇 UNMUTE" : "🔊 MUTE";
  });

  animate();
}

function setupTeams() {
  // Clear old players if any
  allPlayers.forEach(p => { world.removeBody(p.body); scene.remove(p.mesh); });
  allPlayers = []; playerTeam = []; cpuTeam = [];

  // Spawn 7 persistent Player Team (using position colors)
  for (let i = 0; i < 7; i++) {
    const pos = TEAM_COMPOSITION[i];
    const p = new PlayerCharacter(scene, new CANNON.Vec3(0, 5, 0), pos, false);
    p._turboRef = () => turbo.player; // Callback to read team turbo
    playerTeam.push(p);
    allPlayers.push(p);
  }

  // Spawn 7 persistent CPU Team (blue tint over position colors)
  for (let i = 0; i < 7; i++) {
    const pos = TEAM_COMPOSITION[i];
    const cpuArch = { ...pos, color: 0x0000ff }; // Override to blue for CPU
    const p = new PlayerCharacter(scene, new CANNON.Vec3(0, 5, 0), cpuArch, false);
    p._turboRef = () => turbo.cpu; // Callback to read team turbo
    cpuTeam.push(p);
    allPlayers.push(p);
  }

  setupTackling(world, allPlayers, ball, styleManager, audioManager);
}

function startPlayCycle() {
  // Determine which team is offense/defense based on possession
  const playerOnOffense = gameManager.possession === 'player';

  offenseTeam = playerOnOffense ? playerTeam : cpuTeam;
  defenseTeam = playerOnOffense ? cpuTeam : playerTeam;

  // Assign team roles dynamically
  offenseTeam.forEach(p => { p.team = 'offense'; p.isDown = false; });
  defenseTeam.forEach(p => { p.team = 'defense'; p.isDown = false; });

  // Assign pass keys to non-QB offensive players
  offenseTeam.forEach((p, i) => {
    p.passKey = i > 0 ? passKeys[i - 1] : null;
  });
  defenseTeam.forEach(p => { p.passKey = null; });

  // Set user control
  allPlayers.forEach(p => p.isPlayer = false);
  if (playerOnOffense) {
    offenseTeam[0].isPlayer = true; // Player controls QB on offense
  } else {
    // Player controls a defender (LB at index 5)
    defenseTeam[5].isPlayer = true;
  }

  // Move markers
  losMarker.position.z = gameManager.lineOfScrimmageZ;
  firstDownMarker.position.z = gameManager.firstDownZ;

  // Place players at LOS
  const los = gameManager.lineOfScrimmageZ;
  const dirOffense = playerOnOffense ? -1 : 1; // Negative Z is forward for player offensive drive

  // Offense (QB back 5 yards, others spread on LOS)
  offenseTeam[0].body.position.set(0, 2, los - (5 * dirOffense));
  offenseTeam[0].body.velocity.set(0, 0, 0);

  for (let i = 1; i < 7; i++) {
    const xOffset = (i - 3) * 6; // Spread them out across X
    offenseTeam[i].body.position.set(xOffset, 2, los - (1 * dirOffense));
    offenseTeam[i].body.velocity.set(0, 0, 0);
  }

  // Defense (Spread on LOS on other side)
  for (let i = 0; i < 7; i++) {
    const xOffset = (i - 3) * 6;
    defenseTeam[i].body.position.set(xOffset, 2, los + (2 * dirOffense));
    defenseTeam[i].body.velocity.set(0, 0, 0);
  }

  // Disable any active gamebreakers starting a new play
  allPlayers.forEach(p => p.setGamebreaker(false));
  styleManager.gbActive.player = false;
  styleManager.gbActive.cpu = false;

  // Snap ball to offense QB
  ball.snapToCarrier(offenseTeam[0]);

  // Turn on menu
  gameManager.setPlaySelectionMenu(uiManager, Playbook);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateCamera() {
  // Find the active user player
  const activePlayer = allPlayers.find(p => p.isPlayer);
  if (!activePlayer) return;

  const charPos = activePlayer.mesh.position;

  // High action camera
  const yOffset = 25;
  // Should we film from Behind Offense or Behind Defense? Always behind Offense for now.
  const zChase = gameManager.possession === 'player' ? 35 : -35;

  const targetPos = new THREE.Vector3(charPos.x, charPos.y + yOffset, charPos.z + zChase);

  // Smooth lerp for position (Pillar 2)
  camera.position.lerp(targetPos, 0.1);

  const lookTarget = new THREE.Vector3(charPos.x, charPos.y, charPos.z - (zChase * 0.5));
  if (!camera.lookAtTarget) camera.lookAtTarget = new THREE.Vector3().copy(lookTarget);

  // Smooth lerp for lookAt as well
  camera.lookAtTarget.lerp(lookTarget, 0.1);
  camera.lookAt(camera.lookAtTarget);
}

function attemptPassToKey(key) {
  const receiver = offenseTeam.find(p => p.passKey === key);
  if (!receiver) return;

  // Calculate lead trajectory (shoot where they WILL be)
  const targetPos = receiver.body.position;
  const leadPos = new CANNON.Vec3(
    targetPos.x + receiver.body.velocity.x * 0.5,
    targetPos.y,
    targetPos.z + receiver.body.velocity.z * 0.5
  );

  const isLob = Input.keys.shift;
  ball.pass(leadPos, isLob); // Let ball.js handle the math

  // Do NOT switch control here — let the receiver's AI continue running
  // the route. Control transfers on catch (see catching logic below).

  // Consume the input key
  Input.keys[key] = false;
}

function updatePassIcons() {
  const passIconsContainer = document.getElementById('pass-icons');
  if (!passIconsContainer) return;

  // Only show icons if playing offense and holding ball
  if (gameManager.possession !== 'player' || !ball.isHeld || !ball.carrier.isPlayer) {
    passIconsContainer.innerHTML = '';
    return;
  }

  // We are the QB holding the ball, show icons over eligible receivers
  let iconsHTML = '';

  for (let i = 1; i < offenseTeam.length; i++) {
    const receiver = offenseTeam[i];
    if (receiver.isDown || !receiver.passKey) continue;

    // Project 3D position to 2D screen coordinates
    const pos = receiver.mesh.position.clone();
    pos.y += receiver.archetype.height + 1.5; // Float above head
    pos.project(camera);

    // Filter out if behind camera
    if (pos.z > 1) continue;

    const x = (pos.x * .5 + .5) * window.innerWidth;
    const y = (pos.y * -.5 + .5) * window.innerHeight;

    iconsHTML += `<div class="pass-icon" style="left: ${x}px; top: ${y}px;">${receiver.passKey.toUpperCase()}</div>`;
  }

  passIconsContainer.innerHTML = iconsHTML;
}

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.1);
  updatePhysics(dt);

  // Quick hack state bridge
  if (gameManager.currentState === GameState.POST_PLAY_DEAD) {
    // It handles its own reset timeout now wait
  }

  // Are we resetting from PLAY_SELECTION? 
  // We use uiManager display check to see if the user clicked a play
  if (gameManager.currentState === GameState.PLAY_SELECTION && uiManager.menu.style.display === 'none') {
    // Only trigger startPlayCycle once to reset positions and show menu
    startPlayCycle();
  }

  window.blockJumpThisFrame = false;

  // Update Game Rules and AI if live
  if (gameManager.currentState === GameState.LIVE_ACTION || gameManager.currentState === GameState.PRE_SNAP) {
    // Handle game flow inputs first
    if (Input.keys.space && gameManager.currentState === GameState.PRE_SNAP) {
      gameManager.snapBall(aiManager, offenseTeam, defenseTeam);
      Input.keys.space = false; // Consume it so player doesn't jump immediately
      window.blockJumpThisFrame = true; // Hard lock for this frame
    }

    // Players moving
    for (let p of allPlayers) {
      if (gameManager.currentState === GameState.LIVE_ACTION) {
        if (p.isPlayer) p.handleInput(dt, camera);
        p.update(dt, camera);
      } else if (p.isPlayer) {
        // Pre-snap logic
        p.body.velocity.set(0, 0, 0);
        p.update(dt, camera);
      }
    }

    // Community Turbo — deplete while sprinting, recharge when idle
    if (gameManager.currentState === GameState.LIVE_ACTION) {
      const activePlayer = allPlayers.find(p => p.isPlayer);
      const teamKey = playerTeam.includes(activePlayer) ? 'player' : 'cpu';
      const isMoving = activePlayer && (Math.abs(activePlayer.body.velocity.x) > 0.5 || Math.abs(activePlayer.body.velocity.z) > 0.5);

      if (Input.keys.shift && isMoving && turbo[teamKey] > 0) {
        turbo[teamKey] = Math.max(0, turbo[teamKey] - TURBO_DRAIN_RATE * dt);
      } else {
        turbo[teamKey] = Math.min(100, turbo[teamKey] + TURBO_RECHARGE_RATE * dt);
      }

      // Update turbo meter UI
      const turboFill = document.getElementById('turbo-fill');
      if (turboFill) {
        turboFill.style.width = turbo.player + '%';
        turboFill.classList.toggle('depleted', turbo.player <= 0);
      }
    }

    // AI
    if (gameManager.currentState === GameState.LIVE_ACTION) {
      aiManager.update(allPlayers, dt, gameManager, ball);
    }

    // Check for passing in the main loop if we are LIVE
    if (gameManager.currentState === GameState.LIVE_ACTION) {
      for (let k of passKeys) {
        if (Input.keys[k] && ball.isHeld && ball.carrier && ball.carrier.isPlayer) {
          attemptPassToKey(k);
          break; // Only one throw per frame
        }
      }
    }

    // Ball
    ball.update();

    // Catching & Incomplete Logic (Pillar 5)
    if (gameManager.currentState === GameState.LIVE_ACTION && !ball.isHeld) {
      // Check for catches
      for (let p of allPlayers) {
        // Cylinder hitbox: 2.5 units on XZ plane, ball Y between 0 and player head + 4
        const dx = p.mesh.position.x - ball.mesh.position.x;
        const dz = p.mesh.position.z - ball.mesh.position.z;
        const dist2D = Math.sqrt(dx * dx + dz * dz);
        const ballY = ball.mesh.position.y;
        const playerY = p.mesh.position.y;
        if (dist2D < 2.5 && ballY >= 0 && ballY <= playerY + 4) {
          ball.snapToCarrier(p);
          console.log("PASS CAUGHT by", p.team);

          if (p.team !== "offense") {
            // Turnover on Interception!
            gameManager.flipPossession();
            console.log("INTERCEPTION!");
          }

          // Switch user control to the catcher if their team now has possession
          if ((p.team === 'offense' && gameManager.possession === 'player') ||
            (p.team === 'defense' && gameManager.possession === 'cpu')) {
            allPlayers.forEach(ap => ap.isPlayer = false);
            p.isPlayer = true;
          }
          break;
        }
      }

      // Check for incomplete pass (hits ground before caught)
      if (!ball.isHeld && ball.body.position.y < 0.5) {
        console.log("INCOMPLETE PASS!");
        gameManager.endPlay(gameManager.lineOfScrimmageZ); // Ends play at original LOS
      }
    }

    // 2D UI Map pass icons (Phase 6)
    if (gameManager.currentState === GameState.LIVE_ACTION || gameManager.currentState === GameState.PRE_SNAP) {
      updatePassIcons();
    } else {
      document.getElementById('pass-icons').innerHTML = ''; // Clear when dead
    }

    // Scoring logic (Phase 5)
    if (ball.carrier && gameManager.currentState === GameState.LIVE_ACTION) {
      if (gameManager.checkTouchdown(ball.carrier.body.position, audioManager, uiManager)) {
        // Let the checkTouchdown function handle the UI and state flip
      }
    }
  } else {
    // Keep models synced to bodies even during menu so they don't jump around
    for (let p of allPlayers) {
      p.mesh.position.copy(p.body.position);
      p.mesh.position.y -= 1;
    }
  }

  // Always update 2D UI Manager popups
  styleManager.update(dt);

  updateCamera();
  renderer.render(scene, camera);
}

init();
