import * as THREE from "three";
import { SCENE, CONTROLLER } from "../config/Config.js";

export class VRNavigation {
  updatePos = new THREE.Vector3();
  currentDirection = new THREE.Vector3().copy(SCENE.FORWARD_VECTOR);
  movementSpeed = SCENE.VR_MOVEMENT_SPEED;

  constructor(renderer) {
    this.renderer = renderer;
  }

  updateUserPosition = (deltaTime) => {
    this.updatePos.set(0, 0, 0);
    if (!this.renderer.xr.isPresenting) return this.updatePos;

    const session = this.renderer.xr.getSession();

    if (session) {
      const sources = session.inputSources;
      const numControllers = sources.length;
      let hand = 0;
      let otherHand = 0;
      if (numControllers) {
        for (let i = 0; i < numControllers; ++i) {
          if (sources[i].handedness === "right") {
            hand = i;
            break;
          }
        }
        // Get other hand
        otherHand = 1 - hand;
        const gamePad = sources[hand].gamepad;
        if (gamePad && gamePad.axes.length) {
          // Local movement vector
          // DEBUG
          //console.log("Z dir = ", gamePad.axes[Z_AXIS]);
          // Check for speed up button
          this.updatePos.set(
            gamePad.axes[CONTROLLER.X_AXIS],
            0,
            gamePad.axes[CONTROLLER.Z_AXIS]
          );
          // DEBUG
          // console.log("VR rot = ", camRotation + userRotation.y);
          // this.headOrientation.set(
          //   camera.rotation.x,
          //   camRotation + userRotation.y,
          //   camera.rotation.z
          // );
          this.currentDirection.copy(this.updatePos).normalize();
          this.updatePos.multiplyScalar(this.movementSpeed * deltaTime);
        }
      }
    }

    return this.updatePos;
  };

  getCurrentDirection = () => {
    return this.currentDirection;
  };
}
