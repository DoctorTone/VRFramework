import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap";
import style from "./styles/main.css";
import * as THREE from "three";

import Stats from "./libs/stats.module.js";
import { GUI } from "lil-gui";
import { PointerLockControls } from "./controls/PointerLockControls";
import { DRACOLoader } from "./loaders/DRACOLoader.js";
import { GLTFLoader } from "./loaders/GLTFLoader.js";

// WebXR
import { VRButton } from "./webXR/VRButton.js";
import { XRControllerModelFactory } from "./webXR/XRControllerModelFactory.js";

const DEFAULT_SCALE = 4.0;
const DEFAULT_POSITION = {
  x: 0,
  y: 10,
  z: -10,
};
const DEFAULT_ROTATION = {
  x: -1,
  y: -0.5,
  z: 0,
};

const UP_VECTOR = new THREE.Vector3(0, 1, 0);
const FACING_DIRECTION = new THREE.Vector3(0, -0.25, -1);
const LUNAR_SCALE = (Math.PI * 2) / 29.5;

const MOON_SCALE = 1;
const BLOOM_SCENE = 1;
const SPRITE_OFFSET = 0.2;
const WATER_GEOM_WIDTH = 2000;
const WATER_GEOM_HEIGHT = 2000;
const WIDTH_SEGMENTS = 32;
const HEIGHT_SEGMENTS = 32;

class Moon {
  renderer;
  container;
  camera;
  scene;
  stats;
  ambientLight;
  dracoLoader;
  GLTFLoader;
  orbitControls;
  modelLights = [];
  renderScene;
  // Controllers
  controllers = [];
  controllerGrips = [];
  finalPass;
  textureLoader;
  // Movement
  moveForward = false;
  moveBackward = false;
  moveLeft = false;
  moveRight = false;
  velocity = new THREE.Vector3();
  direction = new THREE.Vector3();
  settingsName = "moonSettings";
  generalSettings = {
    "Save Settings": () => {
      const sceneSettings = JSON.stringify(this.getSceneSettings());
      // DEBUG
      console.log("Settings = ", sceneSettings);
      localStorage.setItem(this.settingsName, sceneSettings);
      alert(`Settings saved`);
    },
    "Clear Settings": () => {
      if (confirm("Do you want to clear the settings?")) {
        localStorage.removeItem(this.settingsName);
      }
    },
  };
  moonSettings = {
    Controls: false,
    Mode: "translate",
    PosX: 0,
    PosY: 0,
    PosZ: 0,
    RotX: radsToDegrees(DEFAULT_ROTATION.x),
    RotY: radsToDegrees(DEFAULT_ROTATION.y),
    RotZ: radsToDegrees(DEFAULT_ROTATION.z),
    ScaleX: 1,
    ScaleY: 1,
    ScaleZ: 1,
  };
  ambientLightSettings = {
    Enabled: false,
    Color: "0xffffff",
    Intensity: 1,
  };
  modelSettings = {
    LightsInModel: false,
  };
  waterSettings = {
    Color: "0x000000",
    Time: this.waterTime,
    PosY: 0,
    PosZ: 0,
    ScaleX: 1,
    ScaleZ: 1,
    ReflectanceScale: 1.0,
  };
  bloomSettings = {
    Enabled: false,
    exposure: 1,
    Strength: 1.76,
    Threshold: 0.05,
    Radius: 2.36,
  };
  billboardSettings = {
    Scale: MOON_SCALE,
    Opacity: 0.5,
  };
  sunRotation = 0;
  sunSettings = {
    Rotation: 0,
    Color: 0xffffff,
    Intensity: 0.5,
  };

  constructor() {}

  init = () => {
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath("./libs/draco/");
    this.GLTFLoader = new GLTFLoader();
    this.GLTFLoader.setDRACOLoader(this.dracoLoader);
    this.darkMaterial = new THREE.MeshBasicMaterial({ color: "black" });
    this.materials = {};
    this.textureLoader = new THREE.TextureLoader();
    this.clock = new THREE.Clock();

    this.createRenderer();
    this.createCamera();
    this.createLights();
    this.createControls();
    this.createScene();
    this.createGUI();
    this.loadModels();
    this.setupVR();

    this.stats = new Stats();
    this.container.appendChild(this.stats.dom);

    window.addEventListener("resize", this.onWindowResize);
  };

  createRenderer = () => {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setClearColor(new THREE.Color(0x777777));
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
    controller.addEventListener("connected", function (event) {
      this.add(buildController(event.data));
    });
    controller.addEventListener("selectstart", this.onSelectStart);
    controller.addEventListener("selectend", this.onSelectEnd);

    this.controllers.push(controller);
    this.scene.add(controller);

    const controller2 = this.renderer.xr.getController(1);
    controller2.addEventListener("connected", function (event) {
      this.add(buildController(event.data));
    });
    this.controllers.push(controller2);
    this.scene.add(controller2);

    const controllerModelFactory = new XRControllerModelFactory();

    const controllerGrip = this.renderer.xr.getControllerGrip(0);
    const model = controllerModelFactory.createControllerModel(controllerGrip);

    controllerGrip.add(model);
    this.controllerGrips.push(controllerGrip);
    this.scene.add(controllerGrip);

    const controllerGrip2 = this.renderer.xr.getControllerGrip(1);
    controllerGrip2.add(
      controllerModelFactory.createControllerModel(controllerGrip2)
    );
    this.controllerGrips.push(controllerGrip2);
    this.scene.add(controllerGrip2);
  };

  createCamera = () => {
    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.01,
      2000
    );
    this.camera.position.set(0, 3, 30);
  };

  createLights = () => {
    // Ambient
    const color = 0xffffff;
    const intensity = 1.0;
    this.ambientLight = new THREE.AmbientLight(color, intensity);
  };

  createControls = () => {
    // this.orbitControls = new OrbitControls(
    //   this.camera,
    //   this.renderer.domElement
    // );
    // this.orbitControls.target.set(0, 0, 0);
    this.pointerControls = new PointerLockControls(
      this.camera,
      this.renderer.domElement
    );
    this.renderer.domElement.addEventListener("click", () => {
      this.pointerControls.lock();
    });
    document.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("keyup", this.onKeyUp);
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

  createScene = () => {
    this.scene = new THREE.Scene();
    this.scene.add(this.ambientLight);
    const sphereGeom = new THREE.SphereGeometry(10);
    const sphereMat = new THREE.MeshStandardMaterial({ color: "hotpink" });
    const sphere = new THREE.Mesh(sphereGeom, sphereMat);
    this.scene.add(sphere);
    this.scene.add(this.pointerControls.getObject());
  };

  createGUI = () => {
    this.gui = new GUI();
    this.gui.add(this.modelSettings, "LightsInModel").onChange((enabled) => {
      this.modelLights.forEach((light) => {
        light.visible = enabled;
      });
    });

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

    this.gui.add(this.generalSettings, "Save Settings");
    this.gui.add(this.generalSettings, "Clear Settings");
  };

  getSceneSettings = () => {
    const sceneSettings = {
      water: {
        distortionScale:
          this.waterShader.material.uniforms.distortionScale.value,
        size: this.waterShader.material.uniforms.size.value,
        Color: this.waterColour.getValue(),
        Time: this.waterAnimationTime.getValue(),
        PosY: this.waterPosY.getValue(),
        PosZ: this.waterPosZ.getValue(),
        ScaleX: this.waterScaleX.getValue(),
        ScaleZ: this.waterScaleZ.getValue(),
      },
      moon: {
        PosX: this.moonPosX.getValue(),
        PosY: this.moonPosY.getValue(),
        PosZ: this.moonPosZ.getValue(),
        RotX: this.moonRotX.getValue(),
        RotY: this.moonRotY.getValue(),
        RotZ: this.moonRotZ.getValue(),
        ScaleX: this.moonScaleX.getValue(),
        ScaleY: this.moonScaleY.getValue(),
        ScaleZ: this.moonScaleZ.getValue(),
      },
      billboard: {
        Scale: this.billboardScale.getValue(),
        Opacity: this.billboardOpacity.getValue(),
      },
    };

    return sceneSettings;
  };

  loadSettings = () => {
    // See if any saved settings
    const savedSettings = localStorage.getItem("moonSettings");
    if (savedSettings === null) return;

    const settings = JSON.parse(localStorage.getItem("moonSettings"));
    // Update water
    const waterSettings = settings.water;
    this.waterShader.material.uniforms.distortionScale.value =
      waterSettings.distortionScale;
    this.distortScale.setValue(waterSettings.distortionScale);
    this.waterShader.material.uniforms.size.value = waterSettings.size;
    this.waterSize.setValue(waterSettings.size);
    this.waterColour.setValue(waterSettings.Color);
    this.waterAnimationTime.setValue(waterSettings.Time);
    this.waterPosY.setValue(waterSettings.PosY);
    this.waterShader.position.y = waterSettings.PosY;
    this.waterPosZ.setValue(waterSettings.PosZ);
    this.waterShader.position.z = waterSettings.PosZ;
    this.waterScaleX.setValue(waterSettings.ScaleX);
    this.waterShader.scale.x = waterSettings.ScaleX;
    this.waterScaleZ.setValue(waterSettings.ScaleZ);
    this.waterShader.scale.y = waterSettings.ScaleZ;

    // Update moon
    const moonSettings = settings.moon;
    this.moonPosX.setValue(moonSettings.PosX);
    this.moonPosY.setValue(moonSettings.PosY);
    this.moonPosZ.setValue(moonSettings.PosZ);
    this.moon.position.set(
      moonSettings.PosX,
      moonSettings.PosY,
      moonSettings.PosZ
    );
    this.moonRotX.setValue(moonSettings.RotX);
    this.moonRotY.setValue(moonSettings.RotY);
    this.moonRotZ.setValue(moonSettings.RotZ);
    this.moon.rotation.set(
      degreesToRads(moonSettings.RotX),
      degreesToRads(moonSettings.RotY),
      degreesToRads(moonSettings.RotZ)
    );
    this.moonScaleX.setValue(moonSettings.ScaleX);
    this.moonScaleY.setValue(moonSettings.ScaleY);
    this.moonScaleZ.setValue(moonSettings.ScaleZ);
    this.moon.scale.set(
      moonSettings.ScaleX,
      moonSettings.ScaleY,
      moonSettings.ScaleZ
    );

    // Update billboard
    const billboardSettings = settings.billboard;
    this.billboardScale.setValue(billboardSettings.Scale);
    this.moonSprite.scale.set(
      billboardSettings.Scale,
      billboardSettings.Scale,
      billboardSettings.Scale
    );
    this.billboardOpacity.setValue(billboardSettings.Opacity);
    this.bloomMaterial.opacity = billboardSettings.Opacity;
  };

  loadModels = () => {
    return;

    this.GLTFLoader.load("./models/gltf/moonScene.glb", (gltf) => {
      this.moon = gltf.scene;
      this.moon.traverse((node) => {
        if (node.isLight) {
          this.modelLights.push(node);
          node.visible = false;
        }
        if (node.isMesh) {
          node.layers.enable(BLOOM_SCENE);
        }
      });
      // Set defaults
      this.moon.scale.set(DEFAULT_SCALE, DEFAULT_SCALE, DEFAULT_SCALE);
      this.moon.position.set(
        DEFAULT_POSITION.x,
        DEFAULT_POSITION.y,
        DEFAULT_POSITION.z
      );
      this.moon.rotation.set(
        DEFAULT_ROTATION.x,
        DEFAULT_ROTATION.y,
        DEFAULT_ROTATION.z
      );

      this.moon.add(this.moonSprite);
      // Update GUI
      this.moonScaleX.setValue(this.moon.scale.x);
      this.moonScaleY.setValue(this.moon.scale.y);
      this.moonScaleZ.setValue(this.moon.scale.z);
      this.moonPosX.setValue(this.moon.position.x);
      this.moonPosY.setValue(this.moon.position.y);
      this.moonPosZ.setValue(this.moon.position.z);

      this.scene.add(this.moon);
      this.scene.add(this.transformControls);
      this.scene.add(this.bloomControls);

      this.transformControls.addEventListener("change", this.render);
      this.transformControls.addEventListener("dragging-changed", (event) => {
        this.orbitControls.enabled = !event.value;
        this.moonPosX.setValue(this.moon.position.x);
        this.moonPosY.setValue(this.moon.position.y);
        this.moonPosZ.setValue(this.moon.position.z);
        this.moonRotX.setValue(radsToDegrees(this.moon.rotation.x));
        this.moonRotY.setValue(radsToDegrees(this.moon.rotation.y));
        this.moonRotZ.setValue(radsToDegrees(this.moon.rotation.z));
        this.moonScaleX.setValue(this.moon.scale.x);
        this.moonScaleY.setValue(this.moon.scale.y);
        this.moonScaleZ.setValue(this.moon.scale.z);
        // DEBUG
        console.log("Rotation = ", this.moon.rotation);
      });
      this.loadSettings();
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
    if (this.pointerControls.isLocked) {
      this.velocity.x -= this.velocity.x * 10.0 * delta;
      this.velocity.z -= this.velocity.z * 10.0 * delta;

      // this.velocity.y -= 9.8 * 100.0 * delta; // 100.0 = mass

      this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
      this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
      this.direction.normalize(); // this ensures consistent movements in all directions

      if (this.moveForward || this.moveBackward)
        this.velocity.z -= this.direction.z * 400.0 * delta;
      if (this.moveLeft || this.moveRight)
        this.velocity.x -= this.direction.x * 400.0 * delta;

      this.pointerControls.moveRight(-this.velocity.x * delta);
      this.pointerControls.moveForward(-this.velocity.z * delta);

      // this.pointerControls.getObject().position.y += this.velocity.y * delta; // new behavior
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
  const moon = new Moon();
  moon.init();
  moon.run();
});

const RAD_DEG = 180 / Math.PI;
const DEG_RAD = Math.PI / 180;

const radsToDegrees = (rads) => {
  return rads * RAD_DEG;
};

const degreesToRads = (degrees) => {
  return degrees * DEG_RAD;
};
