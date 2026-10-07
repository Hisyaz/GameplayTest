import { Ball, TurfParticle, BallTrailPoint, GoalNetState } from '../types';
import { PITCH_CONFIG, PHYSICS } from './constants';
import { audio } from './audio';

export interface GoalEvent {
  teamScored: 'home' | 'away';
  x: number;
  y: number;
}

/**
 * Aerodynamic soccer ball constants grounded in sports physics
 * (FIFA regulation size 5 football, 430g, 22cm diameter)
 */
const BALL_AERO = {
  MAGNUS_COEFF: 0.0125, // Lateral acceleration per unit of spin * velocity
  LIFT_COEFF: 0.008,    // Vertical lift from backspin
  SPIN_DECAY: 0.986,    // Rate at which ball spin attenuates in flight
  TURF_SPIN_GRIP: 0.35, // Spin to linear velocity transfer on bounce
  MAX_DEFORMATION: 0.85,// Maximum elongation factor (oval stretch)
  MIN_SPEED_DEFORM: 3.2,// Speed threshold before elongation kicks in
};

/**
 * Updates 3D ball physics with realistic aerodynamics:
 * - Magnus effect curl (swerve/banana arc)
 * - Velocity-aligned oval deformation / bending
 * - True grass turf restitution, skid, and spin transfer
 * - Goal post rebounds and net cushioning
 */
export function updateBallPhysics(
  ball: Ball,
  onGoalScored: (event: GoalEvent) => void,
  topGoalNet?: GoalNetState,
  bottomGoalNet?: GoalNetState,
  timeScale: number = 1
): TurfParticle[] {
  const particles: TurfParticle[] = [];

  // Initialize optional physics properties if not present
  if (ball.spin === undefined) ball.spin = 0;
  if (ball.spinY === undefined) ball.spinY = 0;
  if (!ball.trail) ball.trail = [];
  if (ball.squashTimer === undefined) ball.squashTimer = 0;

  // If player owns ball, ball follows player closely at their feet
  if (ball.ownerId) {
    ball.z = 0;
    ball.vz = 0;
    ball.spin = 0;
    ball.spinY = 0;
    ball.isAirborne = false;
    ball.deformation = 0;
    ball.squashTimer = 0;
    ball.trail = [];
    return particles;
  }

  // 1. Aerodynamic forces in flight (Magnus effect curl & backspin lift)
  const horizSpeed = Math.hypot(ball.vx, ball.vy);
  const totalSpeed = Math.hypot(horizSpeed, ball.vz);

  if (ball.z > 0 || ball.vz > 0) {
    ball.isAirborne = true;

    // MAGNUS EFFECT CURL & KNUCKLEBALL AERODYNAMICS:
    if (ball.isKnuckle) {
      // Knuckleball has STRICTLY NO CURVE
      ball.spin = 0;
      ball.spinY = 0;

      if (ball.isOverpowered) {
        // "when overpower the hit never comes back down it just keeps going up and to the stands"
        ball.vz = Math.max(ball.vz, 3.4);
      } else {
        // "ball goes up then falls down, no curve, more powerful"
        // Once it reaches apex / descending phase, it dips violently!
        if (ball.z > 6 && ball.vz <= 1.4) {
          ball.vz -= 0.38 * timeScale; // Sudden violent aerodynamic knuckle dip
          ball.knuckleDipped = true;
        }
      }
    } else if (Math.abs(ball.spin) > 0.05 && horizSpeed > 0.5) {
      // Magnus aerodynamic lateral curve:
      let coeff = 0.0016;
      if (ball.isSpecialCurve) {
        coeff = ball.isOverpowered ? 0.0034 : 0.0026;
      }
      const lateralAccel = Math.min(0.55, Math.abs(ball.spin) * coeff * horizSpeed);
      const spinSign = Math.sign(ball.spin);

      const oldVx = ball.vx;
      const oldVy = ball.vy;

      // Unit perpendicular vector: (-oldVy / horizSpeed, oldVx / horizSpeed)
      const defX = (-oldVy / horizSpeed) * lateralAccel * spinSign * timeScale;
      const defY = (oldVx / horizSpeed) * lateralAccel * spinSign * timeScale;

      ball.vx += defX;

      // Safeguard: Preserve the forward attacking direction of the ball
      if (oldVy < -1.5) {
        ball.vy = Math.min(-1.0, oldVy + defY * 0.4);
      } else if (oldVy > 1.5) {
        ball.vy = Math.max(1.0, oldVy + defY * 0.4);
      } else {
        ball.vy += defY;
      }

      // Spin decays in air due to boundary layer friction
      const decay = ball.isSpecialCurve ? 0.992 : BALL_AERO.SPIN_DECAY;
      ball.spin = ball.spin * Math.pow(decay, timeScale);
    }

    // Backspin / Topspin vertical influence (lift or dip)
    if (!ball.isKnuckle && ball.spinY && Math.abs(ball.spinY) > 0.05 && horizSpeed > 1.0) {
      ball.vz += ball.spinY * BALL_AERO.LIFT_COEFF * horizSpeed * timeScale;
      ball.spinY = ball.spinY * Math.pow(BALL_AERO.SPIN_DECAY, timeScale);
    }

    // Gravity & Quadratic Air Drag (unless overpowered knuckle soaring to stands)
    if (!(ball.isKnuckle && ball.isOverpowered)) {
      ball.vz -= PHYSICS.GRAVITY * timeScale;
    }
    const airDrag = Math.max(0.978, PHYSICS.BALL_AIR_DRAG - totalSpeed * 0.0008);
    const dragFactor = Math.pow(airDrag, timeScale);
    ball.vx *= dragFactor;
    ball.vy *= dragFactor;
    ball.vz *= dragFactor;
  }

  // 2. Position Integration (scaled by game speed timeScale)
  ball.x += ball.vx * timeScale;
  ball.y += ball.vy * timeScale;
  ball.z += ball.vz * timeScale;

  // 3. Ground Collision & Realistic Turf Bounce
  if (ball.z <= 0) {
    ball.z = 0;

    if (Math.abs(ball.vz) > 0.9) {
      // Impact with turf!
      // Restitution decreases with higher impact speeds due to rubber hysteresis
      const restitution = Math.max(0.52, PHYSICS.BOUNCE_COEFFICIENT - Math.abs(ball.vz) * 0.018);
      ball.vz = -ball.vz * restitution;

      // Turf grip: transfer spin into bounce deflection
      if (Math.abs(ball.spin) > 0.2) {
        // Spin kicks the ball sideways upon hitting grass
        ball.vx += ball.spin * BALL_AERO.TURF_SPIN_GRIP;
        ball.spin *= 0.45; // grass scrubs off majority of spin
      }

      // Backspin check: backspin bites into turf, decelerating horizontal travel
      if (ball.spinY && ball.spinY > 0.5) {
        ball.vx *= 0.72;
        ball.vy *= 0.72;
        ball.spinY *= 0.3;
      }

      // Ground impact triggers momentary squash compression
      ball.squashTimer = 4;

      // Knuckleball skip: "at lower potency it bounds off the ground and keeps going still more powerful than normal shoots"
      if (ball.isKnuckle) {
        ball.vx *= 0.98;
        ball.vy *= 0.98;
      }

      // Grass divots & turf clippings kick up on impact
      const particleCount = Math.min(6, Math.floor(Math.abs(ball.vz) * 1.2) + 1);
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: ball.x + (Math.random() - 0.5) * 6,
          y: ball.y + (Math.random() - 0.5) * 6,
          z: 0,
          vx: (Math.random() - 0.5) * 2.2 + ball.vx * 0.15,
          vy: (Math.random() - 0.5) * 2.2 + ball.vy * 0.15,
          vz: Math.random() * 2.6 + Math.abs(ball.vz) * 0.25,
          color: Math.random() < 0.6 ? '#28581c' : '#3d782b',
          life: 0,
          maxLife: 14 + Math.floor(Math.random() * 8),
          size: 1.8 + Math.random() * 1.2,
        });
      }
    } else {
      // Ball is rolling on grass
      ball.vz = 0;
      ball.isAirborne = false;
      ball.squashTimer = 0;

      // Rolling friction (scaled by timeScale)
      const groundFriction = Math.pow(PHYSICS.BALL_FRICTION_GROUND, timeScale);
      ball.vx *= groundFriction;
      ball.vy *= groundFriction;

      // Angular roll decay
      if (ball.spin) ball.spin = ball.spin * Math.pow(0.85, timeScale);
      if (ball.spinY) ball.spinY = ball.spinY * Math.pow(0.85, timeScale);

      if (horizSpeed < 0.06) {
        ball.vx = 0;
        ball.vy = 0;
      }
    }
  }

  // 4. Ball Visual Deformation (Oval Squash & Stretch)
  // When flying or shot at high velocity, ball bends/elongates along velocity vector
  const currentSpeed = Math.hypot(ball.vx, ball.vy, ball.vz);
  if (currentSpeed > BALL_AERO.MIN_SPEED_DEFORM) {
    const targetDeform = Math.min(
      BALL_AERO.MAX_DEFORMATION,
      (currentSpeed - BALL_AERO.MIN_SPEED_DEFORM) / 7.5
    );
    ball.deformation = (ball.deformation || 0) * 0.7 + targetDeform * 0.3;
    // Angle in screen space (x vs y - z)
    ball.deformationAngle = Math.atan2(ball.vy - ball.vz * 0.6, ball.vx);
  } else if (ball.squashTimer && ball.squashTimer > 0) {
    ball.squashTimer = Math.max(0, ball.squashTimer - timeScale);
    ball.deformation = -0.45; // Negative deformation = squash flattened on ground
    ball.deformationAngle = 0;
  } else {
    // Return smoothly to spherical geometry
    ball.deformation = (ball.deformation || 0) * 0.75;
    if (Math.abs(ball.deformation) < 0.02) ball.deformation = 0;
  }

  // 5. Visual Ball Rotation Angle
  const rollRate = (currentSpeed * 0.12 + (ball.spin || 0) * 0.08) * timeScale;
  ball.rotationAngle = ((ball.rotationAngle || 0) + rollRate) % (Math.PI * 2);

  // 6. Motion / Curl Trail for Bending Shots & Crosses & Knuckleballs
  if (currentSpeed > 4.2 || Math.abs(ball.spin || 0) > 1.6 || ball.isSpecialCurve || ball.isKnuckle) {
    let trailColor = '#ffffff';
    if (ball.isKnuckle) {
      trailColor = ball.isOverpowered ? '#7f1d1d' : (Math.random() > 0.4 ? '#f472b6' : '#db2777');
    } else if (ball.isSpecialCurve) {
      trailColor = Math.random() > 0.4 ? '#c084fc' : '#a855f7';
    }

    ball.trail.unshift({
      x: ball.x,
      y: ball.y - ball.z,
      z: ball.z,
      alpha: (ball.isSpecialCurve || ball.isKnuckle) ? 0.82 : 0.65,
      size: Math.max(2.5, (ball.isSpecialCurve || ball.isKnuckle ? 6.2 : 5.0) - (ball.z / 200)),
      color: trailColor,
    });
  }

  // Fade and prune trail points
  const maxTrailPoints = (ball.isSpecialCurve || ball.isKnuckle) ? 16 : 10;
  for (let i = ball.trail.length - 1; i >= 0; i--) {
    ball.trail[i].alpha -= (ball.isSpecialCurve || ball.isKnuckle) ? 0.06 : 0.09;
    if (ball.trail[i].alpha <= 0 || ball.trail.length > maxTrailPoints) {
      ball.trail.splice(i, 1);
    }
  }

  // 7. Goal Checking & Realistic 3D Net Catch Physics
  const goalLeft = PITCH_CONFIG.CENTER_X - PITCH_CONFIG.GOAL_WIDTH / 2;
  const goalRight = PITCH_CONFIG.CENTER_X + PITCH_CONFIG.GOAL_WIDTH / 2;
  const topGoalY = PITCH_CONFIG.PITCH_TOP;
  const bottomGoalY = PITCH_CONFIG.PITCH_BOTTOM;

  // Crossbar rebounds (metallic hit with loud ping/clang)
  checkCrossbarBounce(ball, topGoalY, goalLeft, goalRight, true);
  checkCrossbarBounce(ball, bottomGoalY, goalLeft, goalRight, false);

  // Goal post collisions
  checkPostBounce(ball, goalLeft, topGoalY);
  checkPostBounce(ball, goalRight, topGoalY);
  checkPostBounce(ball, goalLeft, bottomGoalY);
  checkPostBounce(ball, goalRight, bottomGoalY);

  // Check top goal (Rival goal, attacked by Home)
  const inTopGoalMouth =
    ball.y <= topGoalY &&
    ball.y >= topGoalY - PITCH_CONFIG.GOAL_DEPTH - 15 &&
    ball.x >= goalLeft + 2 &&
    ball.x <= goalRight - 2 &&
    ball.z <= PITCH_CONFIG.GOAL_CROSSBAR_HEIGHT + 3;

  if (inTopGoalMouth) {
    // If just crossed goal line or inside net:
    const speed = Math.hypot(ball.vx, ball.vy, ball.vz);

    if (topGoalNet && !topGoalNet.ballCaught) {
      topGoalNet.impactX = ball.x;
      topGoalNet.impactY = ball.y;
      topGoalNet.impactZ = ball.z;
      topGoalNet.bulgeAmount = Math.min(26, speed * 2.2 + 8);
      topGoalNet.shake = 32;
      topGoalNet.ballCaught = true;
      audio.playNetSwish();
    }

    // Trigger goal scored event
    onGoalScored({ teamScored: 'home', x: ball.x, y: ball.y });

    // The net catches the ball! Elastic mesh friction absorbs kinetic energy
    ball.vx *= 0.82;
    ball.vy *= 0.78;
    ball.vz *= 0.80;
    if (ball.spin) ball.spin *= 0.65;
    if (ball.spinY) ball.spinY *= 0.65;

    // Back netting containment: ball hits the rear wall of the net
    const backNetY = topGoalY - PITCH_CONFIG.GOAL_DEPTH;
    if (ball.y <= backNetY + 7) {
      ball.y = Math.max(backNetY + 3, ball.y);
      ball.vy = Math.abs(ball.vy) * 0.12; // Gentle elastic rebound off netting
      ball.vx *= 0.55;
      if (topGoalNet) {
        topGoalNet.bulgeAmount = Math.max(topGoalNet.bulgeAmount, 18);
        topGoalNet.shake = Math.max(topGoalNet.shake, 22);
      }
    }

    // Side netting containment
    if (ball.x <= goalLeft + 5) {
      ball.x = goalLeft + 5;
      ball.vx = Math.abs(ball.vx) * 0.2;
      if (topGoalNet) topGoalNet.shake = Math.max(topGoalNet.shake, 14);
    } else if (ball.x >= goalRight - 5) {
      ball.x = goalRight - 5;
      ball.vx = -Math.abs(ball.vx) * 0.2;
      if (topGoalNet) topGoalNet.shake = Math.max(topGoalNet.shake, 14);
    }

    // Roof netting containment
    if (ball.z >= PITCH_CONFIG.GOAL_CROSSBAR_HEIGHT - 4) {
      ball.z = PITCH_CONFIG.GOAL_CROSSBAR_HEIGHT - 4;
      ball.vz = -Math.abs(ball.vz) * 0.2;
    }

    // Gravity pulls caught ball down to turf inside net
    if (ball.z > 0) {
      ball.vz -= 0.24;
    } else {
      ball.z = 0;
      ball.vz = 0;
      ball.vx *= 0.78;
      ball.vy *= 0.78;
    }

    return particles;
  }

  // Check bottom goal (Home goal, defended by Home, attacked by Away)
  const inBottomGoalMouth =
    ball.y >= bottomGoalY &&
    ball.y <= bottomGoalY + PITCH_CONFIG.GOAL_DEPTH + 15 &&
    ball.x >= goalLeft + 2 &&
    ball.x <= goalRight - 2 &&
    ball.z <= PITCH_CONFIG.GOAL_CROSSBAR_HEIGHT + 3;

  if (inBottomGoalMouth) {
    const speed = Math.hypot(ball.vx, ball.vy, ball.vz);

    if (bottomGoalNet && !bottomGoalNet.ballCaught) {
      bottomGoalNet.impactX = ball.x;
      bottomGoalNet.impactY = ball.y;
      bottomGoalNet.impactZ = ball.z;
      bottomGoalNet.bulgeAmount = Math.min(26, speed * 2.2 + 8);
      bottomGoalNet.shake = 32;
      bottomGoalNet.ballCaught = true;
      audio.playNetSwish();
    }

    onGoalScored({ teamScored: 'away', x: ball.x, y: ball.y });

    // Net cushions and decelerates ball
    ball.vx *= 0.82;
    ball.vy *= 0.78;
    ball.vz *= 0.80;
    if (ball.spin) ball.spin *= 0.65;
    if (ball.spinY) ball.spinY *= 0.65;

    // Back netting containment
    const backNetY = bottomGoalY + PITCH_CONFIG.GOAL_DEPTH;
    if (ball.y >= backNetY - 7) {
      ball.y = Math.min(backNetY - 3, ball.y);
      ball.vy = -Math.abs(ball.vy) * 0.12;
      ball.vx *= 0.55;
      if (bottomGoalNet) {
        bottomGoalNet.bulgeAmount = Math.max(bottomGoalNet.bulgeAmount, 18);
        bottomGoalNet.shake = Math.max(bottomGoalNet.shake, 22);
      }
    }

    // Side netting containment
    if (ball.x <= goalLeft + 5) {
      ball.x = goalLeft + 5;
      ball.vx = Math.abs(ball.vx) * 0.2;
      if (bottomGoalNet) bottomGoalNet.shake = Math.max(bottomGoalNet.shake, 14);
    } else if (ball.x >= goalRight - 5) {
      ball.x = goalRight - 5;
      ball.vx = -Math.abs(ball.vx) * 0.2;
      if (bottomGoalNet) bottomGoalNet.shake = Math.max(bottomGoalNet.shake, 14);
    }

    // Roof netting containment
    if (ball.z >= PITCH_CONFIG.GOAL_CROSSBAR_HEIGHT - 4) {
      ball.z = PITCH_CONFIG.GOAL_CROSSBAR_HEIGHT - 4;
      ball.vz = -Math.abs(ball.vz) * 0.2;
    }

    if (ball.z > 0) {
      ball.vz -= 0.24;
    } else {
      ball.z = 0;
      ball.vz = 0;
      ball.vx *= 0.78;
      ball.vy *= 0.78;
    }

    return particles;
  }

  // Outer stadium perimeter containment (stadium grandstands)
  // Allows ball to freely cross lines so out-of-bounds referee logic triggers cleanly
  const maxPitchLeft = PITCH_CONFIG.PITCH_LEFT - 320;
  const maxPitchRight = PITCH_CONFIG.PITCH_RIGHT + 320;
  const maxPitchTop = PITCH_CONFIG.PITCH_TOP - 360;
  const maxPitchBottom = PITCH_CONFIG.PITCH_BOTTOM + 360;

  if (ball.x < maxPitchLeft) {
    ball.x = maxPitchLeft;
    ball.vx = -ball.vx * 0.2;
  } else if (ball.x > maxPitchRight) {
    ball.x = maxPitchRight;
    ball.vx = -ball.vx * 0.2;
  }

  if (ball.y < maxPitchTop) {
    ball.y = maxPitchTop;
    ball.vy = -ball.vy * 0.2;
  } else if (ball.y > maxPitchBottom) {
    ball.y = maxPitchBottom;
    ball.vy = -ball.vy * 0.2;
  }

  return particles;
}

/**
 * Checks bounce against horizontal crossbar (metallic clang and rebound)
 */
function checkCrossbarBounce(
  ball: Ball,
  goalY: number,
  goalLeft: number,
  goalRight: number,
  isTopGoal: boolean
): boolean {
  if (ball.x >= goalLeft - 4 && ball.x <= goalRight + 4) {
    const distY = Math.abs(ball.y - goalY);
    const distZ = Math.abs(ball.z - PITCH_CONFIG.GOAL_CROSSBAR_HEIGHT);
    if (distY <= 7 && distZ <= 6) {
      audio.playPostHit();
      if (isTopGoal && ball.vy < 0) {
        ball.vy = Math.abs(ball.vy) * 0.55;
      } else if (!isTopGoal && ball.vy > 0) {
        ball.vy = -Math.abs(ball.vy) * 0.55;
      }
      ball.vz = -Math.abs(ball.vz) * 0.65 - 1.2;
      ball.spin = -ball.spin * 0.7;
      return true;
    }
  }
  return false;
}

/**
 * Checks bounce against cylindrical vertical goal posts
 */
function checkPostBounce(ball: Ball, postX: number, postY: number): boolean {
  const dist = Math.hypot(ball.x - postX, ball.y - postY);
  if (dist < 10 && ball.z <= PITCH_CONFIG.GOAL_CROSSBAR_HEIGHT + 2) {
    audio.playPostHit();
    const angle = Math.atan2(ball.y - postY, ball.x - postX);
    const speed = Math.hypot(ball.vx, ball.vy);
    ball.vx = Math.cos(angle) * Math.max(speed * 0.85, 4.2);
    ball.vy = Math.sin(angle) * Math.max(speed * 0.85, 4.2);
    ball.spin = -ball.spin * 0.6;
    return true;
  }
  return false;
}
