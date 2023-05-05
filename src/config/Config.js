import * as THREE from "three";

const SCENE = {
  FOV: 45,
  nearPlane: 0.01,
  farPlane: 300,
  cameraPosition: new THREE.Vector3(0, 10, 40),
  pointLightPosition: new THREE.Vector3(30, 30, 30),
  ambientIntensity: 0.25,
  FLOOR_WIDTH: 500,
  FLOOR_DEPTH: 500,
  floorColour: 0x484d60,
  skyColour: 0x6165db,
};

export { SCENE };
