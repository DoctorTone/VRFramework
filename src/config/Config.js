import * as THREE from "three";

const SCENE = {
  CAM_FOV: 45,
  CAM_NEAR_PLANE: 0.01,
  CAM_FAR_PLANE: 300,
  cameraPosition: new THREE.Vector3(0, 10, 40),
  pointLightPosition: new THREE.Vector3(30, 30, 30),
  FORWARD_VECTOR: new THREE.Vector3(0, 0, -1),
  UP_VECTOR: new THREE.Vector3(0, 1, 0),
  ambientIntensity: 0.25,
  FLOOR_WIDTH: 500,
  FLOOR_DEPTH: 500,
  floorColour: 0x484d60,
  skyColour: 0x6165db,
  PROXIMITY: 0.75,
  NEAR_RAYCAST: 0,
  FAR_RAYCAST: 2,
  COLLIDED_NONE: 0,
  COLLIDED_MESH: 1,
};

export { SCENE };
