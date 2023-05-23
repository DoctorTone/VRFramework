import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap";
import style from "./styles/main.css";
import * as THREE from "three";

import Stats from "./libs/stats.module.js";
import { GUI } from "lil-gui";
import { PointerLockControls } from "./controls/PointerLockControls";
import { DRACOLoader } from "./loaders/DRACOLoader.js";
import { GLTFLoader } from "./loaders/GLTFLoader.js";
import { SCENE } from "./config/Config.js";
import { getModelCentre, getModelSize } from "./utils/Utils.js";

// WebXR
import { VRButton } from "./webXR/VRButton.js";
import { XRControllerModelFactory } from "./webXR/XRControllerModelFactory.js";
import { VRNavigation } from "./webXR/VRNavigation.js";

class VRFramework {
  renderer;
  container;
  camera;
  scene;
  stats;
  ambientLight;
  isMobile;
  isImmersive = false;
  vrNavigation;
  dracoLoader;
  GLTFLoader;
  orbitControls;
  modelLights = [];
  renderScene;
  // Controllers
  controllers = [];
  controllerGrips = [];
  textureLoader;
  // Movement
  moveForward = false;
  moveBackward = false;
  moveLeft = false;
  moveRight = false;
  velocity = new THREE.Vector3();
  movementSpeed = 400;
  direction = new THREE.Vector3();
  worldDir = new THREE.Vector3();
  tempVec = new THREE.Vector3();
  proximity = SCENE.PROXIMITY;
  collided = false;
  collisionPoint = new THREE.Vector3();
  settingsName = "VRSettings";
  generalSettings = {
    "Save Settings": () => {
      const sceneSettings = JSON.stringify(this.gui.save());
      // DEBUG
      // console.log("Settings = ", sceneSettings);s
      localStorage.setItem(this.settingsName, sceneSettings);
      alert(`Settings saved`);
    },
    "Clear Settings": () => {
      if (confirm("Do you want to clear the settings?")) {
        localStorage.removeItem(this.settingsName);
      }
    },
  };
  ambientLightSettings = {
    Enabled: true,
    Color: "0xffffff",
    Intensity: SCENE.ambientIntensity,
  };
  skySettings = {
    "Sky Color": SCENE.skyColour,
  };
  floorSettings = {
    "Floor Color": SCENE.floorColour,
  };

  constructor() {}

  init = () => {
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath("./libs/draco/");
    this.GLTFLoader = new GLTFLoader();
    this.GLTFLoader.setDRACOLoader(this.dracoLoader);
    this.materials = {};
    this.textureLoader = new THREE.TextureLoader();
    this.clock = new THREE.Clock();

    this.isMobile = this.getDeviceStatus();
    this.createRenderer();
    this.createCamera();
    this.createLights();
    this.createControls();
    this.createScene();
    this.createCollisionSystem();
    this.createGUI();
    this.loadSettings();
    this.loadModels();
    this.setupVRContainer();
    this.setupVR();

    this.stats = new Stats();
    SCENE.STATS_ON && this.container.appendChild(this.stats.dom);

    window.addEventListener("resize", this.onWindowResize);
  };

  createRenderer = () => {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setClearColor(new THREE.Color(SCENE.skyColour));
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.xr.enabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.container = document.getElementById("container");
    this.container.appendChild(this.renderer.domElement);
  };

  setupVR = () => {
    document.body.appendChild(VRButton.createButton(this.renderer));

    const controller = this.renderer.xr.getController(0);
    controller.addEventListener("connected", (event) => {
      // DEBUG
      // console.log("Connected...");
      controller.add(buildController(event.data));
      this.setupVRAttributes();
      this.isImmersive = true;
    });
    controller.addEventListener("selectstart", this.onSelectStart);
    controller.addEventListener("selectend", this.onSelectEnd);

    this.controllers.push(controller);
    this.vrContainer.add(controller);

    const controller2 = this.renderer.xr.getController(1);
    controller2.addEventListener("connected", (event) => {
      // DEBUG
      // console.log("Connected...");
      controller2.add(buildController(event.data));
      this.setupVRAttributes();
      this.isImmersive = true;
    });
    this.controllers.push(controller2);
    this.vrContainer.add(controller2);

    const controllerModelFactory = new XRControllerModelFactory();

    const controllerGrip = this.renderer.xr.getControllerGrip(0);
    const model = controllerModelFactory.createControllerModel(controllerGrip);

    controllerGrip.add(model);
    this.controllerGrips.push(controllerGrip);
    this.vrContainer.add(controllerGrip);

    const controllerGrip2 = this.renderer.xr.getControllerGrip(1);
    controllerGrip2.add(
      controllerModelFactory.createControllerModel(controllerGrip2)
    );
    this.controllerGrips.push(controllerGrip2);
    this.vrContainer.add(controllerGrip2);
  };

  setupVRContainer = () => {
    // Set up container to move vr camera around
    const vrGroup = new THREE.Group();
    vrGroup.name = "VRContainer";
    this.scene.add(vrGroup);
    vrGroup.position.copy(SCENE.VR_POSITION);
    this.vrContainer = vrGroup;
  };

  setupVRAttributes = () => {
    if (this.isImmersive) return;

    this.vrContainer.add(this.camera);
    this.sceneContainer.remove(this.grid);
    this.sceneContainer.add(this.plinth);
    this.proximity = SCENE.VR_PROXIMITY;

    this.vrNavigation = new VRNavigation(this.renderer);
  };

  createCamera = () => {
    this.camera = new THREE.PerspectiveCamera(
      SCENE.CAM_FOV,
      window.innerWidth / window.innerHeight,
      SCENE.CAM_NEAR_PLANE,
      SCENE.CAM_FAR_PLANE
    );
    this.camera.position.copy(SCENE.cameraPosition);
  };

  createLights = () => {
    // Ambient
    const color = 0xffffff;
    const intensity = SCENE.ambientIntensity;
    this.ambientLight = new THREE.AmbientLight(color, intensity);
    this.pointLight = new THREE.PointLight(color, 1);
    this.pointLight.position.copy(SCENE.pointLightPosition);
    // this.dirLight = new THREE.DirectionalLight(color, 1);
    // this.dirLight.position.set(1, 1, 0);
  };

  createControls = () => {
    if (!this.isMobile) {
      this.pointerControls = new PointerLockControls(
        this.camera,
        this.renderer.domElement
      );
      this.renderer.domElement.addEventListener("click", () => {
        this.pointerControls.lock();
      });
      this.pointerControls.addEventListener("lock", () => {
        const elem = document.getElementById("instructions");
        elem.classList.add("d-none");
      });

      this.pointerControls.addEventListener("unlock", () => {
        const elem = document.getElementById("instructions");
        elem.classList.remove("d-none");
      });
    }

    document.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("keyup", this.onKeyUp);

    // Mobile
    document.addEventListener("touchstart", this.onTouchStart);
    document.addEventListener("touchend", this.onTouchEnd);

    document.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });
  };

  onKeyDown = (event) => {
    switch (event.code) {
      case "ArrowUp":
      case "KeyW":
        this.moveForward = true;
        break;

      case "ArrowLeft":
      case "KeyA":
        this.moveLeft = true;
        break;

      case "ArrowDown":
      case "KeyS":
        this.moveBackward = true;
        break;

      case "ArrowRight":
      case "KeyD":
        this.moveRight = true;
        break;
    }
  };

  onKeyUp = (event) => {
    switch (event.code) {
      case "ArrowUp":
      case "KeyW":
        this.moveForward = false;
        break;

      case "ArrowLeft":
      case "KeyA":
        this.moveLeft = false;
        break;

      case "ArrowDown":
      case "KeyS":
        this.moveBackward = false;
        break;

      case "ArrowRight":
      case "KeyD":
        this.moveRight = false;
        break;
    }
  };

  onTouchStart = (event) => {
    switch (event.target.id) {
      case "forward":
      case "imgforward":
        this.moveForward = true;
        break;

      case "back":
      case "imgback":
        this.moveBackward = true;
        break;

      case "right":
      case "imgright":
        this.moveRight = true;
        break;

      case "left":
      case "imgleft":
        this.moveLeft = true;
        break;
    }
  };

  onTouchEnd = (event) => {
    switch (event.target.id) {
      case "forward":
      case "imgforward":
        this.moveForward = false;
        break;

      case "back":
      case "imgback":
        this.moveBackward = false;
        break;

      case "right":
      case "imgright":
        this.moveRight = false;
        break;

      case "left":
      case "imgleft":
        this.moveLeft = false;
        break;
    }
  };

  createScene = () => {
    this.scene = new THREE.Scene();
    this.scene.add(this.ambientLight);
    this.scene.add(this.pointLight);

    // Group for scene objects and group for VR controllers
    const sceneContainer = new THREE.Group();
    this.scene.add(sceneContainer);

    this.pointerControls &&
      sceneContainer.add(this.pointerControls.getObject());

    // Main floor in scene
    const floorGeom = new THREE.PlaneGeometry(
      SCENE.FLOOR_WIDTH,
      SCENE.FLOOR_DEPTH
    );
    const floorMat = new THREE.MeshLambertMaterial({
      color: SCENE.floorColour,
    });
    this.floorMat = floorMat;
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.25;
    sceneContainer.add(floor);

    // Plinth in VR
    const plinthGeom = new THREE.BoxGeometry(
      SCENE.FLOOR_WIDTH / 20,
      2,
      SCENE.FLOOR_DEPTH / 20
    );
    const plinthMat = new THREE.MeshLambertMaterial({
      color: SCENE.vrFloorColour,
    });
    const plinth = new THREE.Mesh(plinthGeom, plinthMat);
    this.plinth = plinth;

    // Grid
    const grid = new THREE.GridHelper(
      SCENE.FLOOR_WIDTH,
      SCENE.FLOOR_WIDTH / 20,
      0x000000,
      0x000000
    );
    grid.material.opacity = 0.5;
    grid.material.transparent = true;
    sceneContainer.add(grid);
    this.grid = grid;
    this.sceneContainer = sceneContainer;
  };

  createCollisionSystem = () => {
    this.currentDirection = new THREE.Vector3().copy(SCENE.FORWARD_VECTOR);
    this.raycastOrigin = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster(
      this.raycastOrigin,
      this.currentDirection,
      SCENE.NEAR_RAYCAST,
      SCENE.FAR_RAYCAST
    );
    this.raycaster.camera = this.camera;
  };

  checkForCollisions = () => {
    // Take user rotation into account
    if (this.pointerControls || this.isMobile) {
      if (this.direction.length() < 0.1) return SCENE.COLLIDED_NONE;
      this.userRotation = this.camera.rotation.y;
      this.camera.getWorldDirection(this.worldDir);
      if (this.worldDir.z > 0) {
        this.userRotation = Math.PI - this.userRotation;
      }
      this.direction.applyAxisAngle(SCENE.UP_VECTOR, this.userRotation);
    }

    if (this.isImmersive) {
      this.direction = this.vrNavigation.getCurrentDirection();
      if (this.direction.length() < 0.1) return SCENE.COLLIDED_NONE;
    }

    this.raycastOrigin.copy(
      this.isImmersive ? this.vrContainer.position : this.camera.position
    );
    this.raycaster.set(this.raycastOrigin, this.direction);
    this.intersections = this.raycaster.intersectObjects(
      this.sceneContainer.children,
      true
    );

    // DEBUG
    // console.log("Dir = ", this.direction);
    // console.log("VR cam = ", this.vrContainer.position);

    if (this.intersections.length) {
      // DEBUG
      // console.log("Hit something...");

      let hit = this.intersections[0];
      let collisionState = SCENE.COLLIDED_NONE;
      if (hit.object.type === "Mesh") {
        collisionState = SCENE.COLLIDED_MESH;
        if (hit.distance < this.proximity) {
          // DEBUG
          // console.log("Hit point = ", hit);

          this.currentHit = hit;
          return collisionState;
        }
      }
    }

    return SCENE.COLLIDED_NONE;
  };

  createGUI = () => {
    this.gui = new GUI();

    const ambientLightFolder = this.gui.addFolder("Ambient Light");
    ambientLightFolder.open(false);
    this.ambientLightEnabled = ambientLightFolder
      .add(this.ambientLightSettings, "Enabled")
      .onFinishChange((enabled) => {
        this.ambientLight.visible = enabled;
      });
    this.ambientLightColor = ambientLightFolder
      .addColor(this.ambientLightSettings, "Color")
      .onFinishChange((value) => {
        this.ambientLight.color = new THREE.Color(value);
      });
    this.ambientLightIntensity = ambientLightFolder
      .add(this.ambientLightSettings, "Intensity", 0, 3)
      .onChange((value) => {
        this.ambientLight.intensity = value;
      });

    this.skyColour = this.gui
      .addColor(this.skySettings, "Sky Color")
      .onFinishChange((value) => {
        this.renderer.setClearColor(value);
      });

    this.floorColour = this.gui
      .addColor(this.floorSettings, "Floor Color")
      .onFinishChange((value) => {
        this.floorMat.color = new THREE.Color(value);
      });

    this.gui.add(this.generalSettings, "Save Settings");
    this.gui.add(this.generalSettings, "Clear Settings");

    // Create GUI for mobile
    if (this.isMobile) {
      this.gui.close();
      const instructions = document.getElementById("instructions");
      instructions.classList.add("d-none");
      const elem = document.getElementById("moveControls");
      if (elem) {
        elem.classList.remove("d-none");
      }
    }
  };

  getDeviceStatus = () => {
    // See if mobile
    try {
      document.createEvent("TouchEvent");
      return true;
    } catch (error) {
      // Must be desktop
      return false;
    }
  };

  loadSettings = () => {
    // See if any saved settings
    const savedSettings = localStorage.getItem("VRSettings");
    if (savedSettings === null) return;

    const settings = JSON.parse(localStorage.getItem("VRSettings"));
    this.gui.load(settings);
  };

  loadModels = () => {
    this.GLTFLoader.load("models/gltf/lucy.gltf", (gltf) => {
      const scale = 15;
      const model = gltf.scene;
      model.scale.set(scale, scale, scale);
      model.position.y = 7.5;
      this.sceneContainer.add(model);
      // Create bounding box for this model
      const centre = getModelCentre(model);
      const size = getModelSize(model);
      // Height should be 2x distance from centre to floor
      size.y = centre.y * 2;
      const boxMat = new THREE.MeshBasicMaterial({ color: "red" });
      const boxGeom = new THREE.BoxBufferGeometry(size.x, size.y, size.z);
      const box = new THREE.Mesh(boxGeom, boxMat);
      box.name = "BoundingBox";
      box.position.copy(centre);
      this.sceneContainer.add(box);
      box.visible = false;
    });
  };

  onWindowResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  run = () => {
    this.renderer.setAnimationLoop(this.render);
  };

  render = () => {
    // Movement
    const delta = this.clock.getDelta();

    if (this.vrNavigation) {
      const userPos = this.vrNavigation.updateUserPosition(delta);
      this.vrContainer.position.add(userPos);
    }

    if (
      (this.pointerControls && this.pointerControls.isLocked) ||
      this.isMobile
    ) {
      this.velocity.x -= this.velocity.x * 10.0 * delta;
      this.velocity.z -= this.velocity.z * 10.0 * delta;

      this.movementSpeed = SCENE.MOVE_SPEED;
      if (this.collided) {
        this.movementSpeed = 0;
        this.velocity.set(0, 0, 0);
      }

      this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
      this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
      this.direction.normalize(); // this ensures consistent movements in all directions

      if (this.moveForward || this.moveBackward)
        this.velocity.z -= this.direction.z * this.movementSpeed * delta;
      if (this.moveLeft || this.moveRight)
        this.velocity.x -=
          ((this.direction.x * this.movementSpeed) / 2) * delta;

      if (this.pointerControls) {
        this.pointerControls.moveRight(-this.velocity.x * delta);
        this.pointerControls.moveForward(-this.velocity.z * delta);
      }

      if (this.isMobile) {
        this.camera.position.x += -this.velocity.x * delta;
        this.camera.position.z -= -this.velocity.z * delta;
      }

      this.direction.z *= -1;
      // DEBUG
      // console.log("Direction = ", this.direction);
    }

    // Collision detection
    const collisionState = this.checkForCollisions();
    switch (collisionState) {
      case SCENE.COLLIDED_MESH:
        if (this.collided) {
          this.isImmersive
            ? this.vrContainer.position.copy(this.collisionPoint)
            : this.camera.position.copy(this.collisionPoint);
          break;
        }

        this.collided = true;
        // Move back to fixed distance from object
        // DEBUG
        // console.log("Direction = ", this.direction);

        this.direction.multiplyScalar(this.proximity);
        // DEBUG
        // console.log("Adjusted = ", this.direction);

        this.currentHit.point.sub(this.direction);
        this.collisionPoint.copy(this.currentHit.point);
        // DEBUG
        // console.log("Collision point = ", this.collisionPoint);
        break;

      case SCENE.COLLIDED_NONE:
        this.collided = false;
        this.proximity = this.isImmersive
          ? SCENE.VR_PROXIMITY
          : SCENE.PROXIMITY;
        break;

      default:
        break;
    }

    this.renderer.render(this.scene, this.camera);

    this.stats.update();
  };
}

function buildController(data) {
  let geometry, material;

  switch (data.targetRayMode) {
    case "tracked-pointer":
      geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, -1], 3)
      );
      geometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute([0.5, 0.5, 0.5, 0, 0, 0], 3)
      );

      material = new THREE.LineBasicMaterial({
        vertexColors: true,
        blending: THREE.AdditiveBlending,
      });

      return new THREE.Line(geometry, material);

    case "gaze":
      geometry = new THREE.RingGeometry(0.02, 0.04, 32).translate(0, 0, -1);
      material = new THREE.MeshBasicMaterial({
        opacity: 0.5,
        transparent: true,
      });
      return new THREE.Mesh(geometry, material);
  }
}

window.addEventListener("load", () => {
  const vrApp = new VRFramework();
  vrApp.init();
  vrApp.run();
});

const RAD_DEG = 180 / Math.PI;
const DEG_RAD = Math.PI / 180;

const radsToDegrees = (rads) => {
  return rads * RAD_DEG;
};

const degreesToRads = (degrees) => {
  return degrees * DEG_RAD;
};
