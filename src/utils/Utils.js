import * as THREE from "three";

const getModelCentre = (model) => {
  const box = new THREE.Box3().setFromObject(model);
  const centre = new THREE.Vector3();
  centre.x = (box.max.x + box.min.x) / 2;
  centre.y = (box.max.y + box.min.y) / 2;
  centre.z = (box.max.z + box.min.z) / 2;

  return centre;
};

const getModelSize = (model) => {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  size.set(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);

  return size;
};

export { getModelCentre, getModelSize };
