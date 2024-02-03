import { vehicleStore } from "./../store/index";
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
// import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import Stats from "stats.js";
import * as CANNON from "cannon-es";
import _ from "lodash";
import { getDirection, getScore } from "../helper/utils";
import { ESlideDirection } from "../types/enum";

const textureLoader = new THREE.TextureLoader();

const engineForce = 3000;
const maxSteerVal = 0.7;
const brakeForce = 20;
const velocityThreshold = 0.1;

// const fbxLoader = new FBXLoader();

interface IInitPayload {
  // 挂载的节点id
  container: string;
}

class Renderer {
  scene: THREE.Scene | null = null;
  world: CANNON.World | null = null;
  // 选中的车位
  selectedParkSpace: THREE.Object3D | null = null;
  plane: THREE.Mesh | null = null;

  constructor() {
    // console.log("===Renderer");
  }

  createParkingHouse() {
    if (!this.scene || !this.world) return;
    const offset = 30;
    // 创建背景墙
    const background = new THREE.Mesh(
      new THREE.BoxGeometry(3, 4, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xcccccc })
    );
    background.position.set(0, 0, -(53 + offset));
    this.scene.add(background);
    // 创建侧边墙1
    const sider1 = new THREE.Mesh(
      new THREE.BoxGeometry(6, 4, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xcccccc })
    );
    sider1.rotation.y = Math.PI / 2;
    sider1.position.set(-1.5, 0.1, -(50 + offset));
    this.scene.add(sider1);
    // 创建侧边墙2
    const sider2 = new THREE.Mesh(
      new THREE.BoxGeometry(6, 4, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xcccccc })
    );
    sider2.rotation.y = Math.PI / 2;
    sider2.position.set(1.5, 0.1, -(50 + offset));
    this.scene.add(sider2);
    // 创建屋顶
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(3, 6, 0.1),
      new THREE.MeshBasicMaterial({
        color: 0xcccccc,
        transparent: true,
        opacity: 0.9,
      })
    );
    roof.rotation.x = Math.PI / 2;
    roof.position.set(0, 2, -(50 + offset));
    this.scene.add(roof);
    // 创建地板
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(3, 6, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x666666 })
    );
    floor.rotation.x = Math.PI / 2;
    floor.position.set(0, 0.1, -(50 + offset));
    this.scene.add(floor);
    // physic
    // 背景墙
    const backgroundShape = new CANNON.Box(new CANNON.Vec3(1.5, 4, 0.1));
    const backgroundBody = new CANNON.Body({ mass: 0 });
    backgroundBody.addShape(backgroundShape);
    backgroundBody.position.set(0, 0, -(53 + offset));
    this.world.addBody(backgroundBody);
    // 侧边墙1
    const sider1Shape = new CANNON.Box(new CANNON.Vec3(0.1, 2, 3));
    const sider1SBody = new CANNON.Body({ mass: 0 });
    sider1SBody.addShape(sider1Shape);
    sider1SBody.position.set(-1.5, 0.1, -(50 + offset));
    this.world.addBody(sider1SBody);
    // 侧边墙2
    const sider2Shape = new CANNON.Box(new CANNON.Vec3(0.1, 2, 3));
    const sider2SBody = new CANNON.Body({ mass: 0 });
    sider2SBody.addShape(sider2Shape);
    sider2SBody.position.set(1.5, 0.1, -(50 + offset));
    this.world.addBody(sider2SBody);
    // 调整角度
    // sider1SBody.quaternion.setFromAxisAngle(
    //   new CANNON.Vec3(0, 1, 0),
    //   Math.PI / 2
    // );
    this.world.addBody(sider2SBody);
    return floor;
  }

  async init(initPayload: IInitPayload) {
    const container = document.getElementById(initPayload.container);
    const style = container!.getBoundingClientRect();
    const width = style.width;
    const height = style.height;
    /***** 创建一个场景 *****/
    const scene = new THREE.Scene();
    this.scene = scene;
    // const gridHelper = new THREE.GridHelper(1000, 1000, 0x4c4c4c, 0x5c5c5c);
    // gridHelper.position.y = 0.1;
    // scene.add(gridHelper);
    /***** 创建环境光和其他光源 *****/
    const ambientLight = new THREE.AmbientLight(0xffffff);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff);
    directionalLight.castShadow = true;
    // 设置方向光源位置
    directionalLight.position.set(15, 30, 25);
    scene.add(directionalLight);
    /***** 创建一个具有透视效果的摄像机 *****/
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 800);
    // 设置摄像机位置，并将其朝向场景中心
    camera.position.x = 0;
    /***** 创建一个 WebGL 渲染器 *****/
    const renderer = new THREE.WebGLRenderer({
      // 开启抗锯齿
      antialias: true,
    });
    // 将渲染器的输出（此处是 canvas 元素）插入到 body 中
    document.body.appendChild(renderer.domElement);
    // 设置渲染器的清除颜色（即背景色）和尺寸
    // 若想用 body 作为背景，则可以不设置 clearColor，然后在创建渲染器时设置 alpha: true，即 new THREE.WebGLRenderer({ alpha: true })
    // renderer.setClearColor(0xffffff);
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    // 地面
    const planeGeometry = new THREE.PlaneGeometry(1000, 1000);

    // 小车
    const geometry = new THREE.BoxGeometry(2, 0.6, 3);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      side: THREE.DoubleSide,
    });
    const vehicleMesh = new THREE.Mesh(geometry, material);
    vehicleMesh.position.set(0, 0.4, 0);
    scene.add(vehicleMesh);
    // 增加边框
    const box = geometry.clone();
    const edges = new THREE.EdgesGeometry(box);
    const edgesMaterial = new THREE.LineBasicMaterial({
      color: 0x333333,
    });
    const line = new THREE.LineSegments(edges, edgesMaterial);
    line.position.set(0, 0.4, 0);
    scene.add(line);
    // 组成一个Group
    const egoCar = new THREE.Group();
    egoCar.name = "自车";
    egoCar.add(vehicleMesh, line);
    scene.add(egoCar);

    /**
     * Physics
     **/
    const world = new CANNON.World();
    world.broadphase = new CANNON.SAPBroadphase(world);
    // 设定重力
    world.gravity.set(0, -10, 0);
    world.defaultContactMaterial.friction = 0;
    this.world = world;

    const groundMaterial = new CANNON.Material("groundMaterial");
    const wheelMaterial = new CANNON.Material("wheelMaterial");
    const wheelGroundContactMaterial = new CANNON.ContactMaterial(
      wheelMaterial,
      groundMaterial,
      {
        // 摩擦系数
        friction: 0.5,
        // 反弹系数
        restitution: 0,
      }
    );
    world.addContactMaterial(wheelGroundContactMaterial);
    // car physics body
    const chassisShape = new CANNON.Box(new CANNON.Vec3(1, 0.3, 2));
    const chassisBody = new CANNON.Body({
      mass: 500,
      material: new CANNON.Material({ friction: 0.5, restitution: 0 }),
    });
    chassisBody.addEventListener("stop", () => {
      console.log("刚体停止运动");
    });
    chassisBody.addShape(chassisShape);
    chassisBody.position.set(0, 4, 0);
    // 初始角速度
    chassisBody.angularVelocity.set(0, 0, 0);
    const vehicle = new CANNON.RaycastVehicle({
      chassisBody,
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2,
    });
    // 车轮配置
    const options = {
      radius: 0.4,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: 30,
      suspensionRestLength: 0.3,
      frictionSlip: 5,
      dampingRelaxation: 2,
      dampingCompression: 4,
      maxSuspensionForce: 100000,
      rollInfluence: 0.01,
      axleLocal: new CANNON.Vec3(-1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(1, 1, 0),
      maxSuspensionTravel: 0.25,
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true,
    };
    const axlewidth = 0.7;
    options.chassisConnectionPointLocal.set(axlewidth, 0, -1);
    vehicle.addWheel(options);
    options.chassisConnectionPointLocal.set(-axlewidth, 0, -1);
    vehicle.addWheel(options);
    options.chassisConnectionPointLocal.set(axlewidth, 0, 1);
    vehicle.addWheel(options);
    options.chassisConnectionPointLocal.set(-axlewidth, 0, 1);
    vehicle.addWheel(options);
    vehicle.addToWorld(world);
    // 四个车轮
    const wheelBodies: CANNON.Body[] = [];
    const wheelVisuals: THREE.Mesh[] = [];
    vehicle.wheelInfos.forEach(function (wheel) {
      const shape = new CANNON.Cylinder(
        wheel.radius,
        wheel.radius,
        wheel.radius / 2,
        20
      );
      const body = new CANNON.Body({ mass: 1, material: wheelMaterial });
      body.type = CANNON.Body.KINEMATIC;
      body.collisionFilterGroup = 0;
      const quaternion = new CANNON.Quaternion().setFromEuler(
        -Math.PI / 2,
        0,
        0
      );
      body.addShape(shape, new CANNON.Vec3(), quaternion);
      wheelBodies.push(body);
      const geometry = new THREE.CylinderGeometry(
        wheel.radius,
        wheel.radius,
        0.4,
        32
      );
      const material = new THREE.MeshPhongMaterial({
        color: 0xd0901d,
        emissive: 0xaa0000,
        side: THREE.DoubleSide,
        flatShading: true,
      });
      const cylinder = new THREE.Mesh(geometry, material);
      cylinder.geometry.rotateZ(Math.PI / 2);
      wheelVisuals.push(cylinder);
      scene.add(cylinder);
    });
    world.addEventListener("postStep", function () {
      for (let i = 0; i < vehicle.wheelInfos.length; i++) {
        vehicle.updateWheelTransform(i);
        const t = vehicle.wheelInfos[i].worldTransform;
        wheelBodies[i].position.copy(t.position);
        wheelBodies[i].quaternion.copy(t.quaternion);
        // @ts-ignore
        wheelVisuals[i].position.copy(t.position);
        // @ts-ignore
        wheelVisuals[i].quaternion.copy(t.quaternion);
      }
    });
    // 加载纹理贴图
    function texturePromise() {
      return new Promise((resolve, reject) => {
        textureLoader.load("/gta/floor.jpg", (texture) => {
          resolve(texture);
        });
      });
    }
    const texture: any = await texturePromise();
    const planeMaterial = new THREE.MeshLambertMaterial({
      map: texture,
      side: THREE.DoubleSide,
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    // 地面接受阴影
    plane.receiveShadow = true;
    plane.rotation.x = Math.PI / 2;
    scene.add(plane);
    // 地面刚体
    const q = plane.quaternion;
    const planeBody = new CANNON.Body({
      mass: 0,
      material: groundMaterial,
      shape: new CANNON.Plane(),
      // @ts-ignore
      quaternion: new CANNON.Quaternion(-q._x, q._y, q._z, q._w),
    });
    world.addBody(planeBody);

    // 创建车库
    const parkingFloor = this.createParkingHouse();

    function updatePhysics() {
      world.step(1 / 60);
      // @ts-ignore
      egoCar.position.copy(chassisBody.position);
      // @ts-ignore
      egoCar.quaternion.copy(chassisBody.quaternion);
      // 检查刚体的速度
      if (
        chassisBody.velocity.length() < velocityThreshold &&
        !vehicleStore.isStop
      ) {
        vehicleStore.stop();
        // 计算分数
        const vehiclePos = [
          vehicle.chassisBody.position.x,
          vehicle.chassisBody.position.y,
          vehicle.chassisBody.position.z,
        ];
        const vehicleQuaternion = [
          vehicle.chassisBody.quaternion.x,
          vehicle.chassisBody.quaternion.y,
          vehicle.chassisBody.quaternion.z,
        ];
        const housePos = [
          parkingFloor?.position.x ?? 0,
          parkingFloor?.position.y ?? 0,
          parkingFloor?.position.z ?? 0,
        ];
        const score = getScore(housePos, vehiclePos, vehicleQuaternion);
        vehicleStore.setScore(score);
      }
    }

    function brakeVehicle() {
      vehicle.setBrake(brakeForce, 0);
      vehicle.setBrake(brakeForce, 1);
      vehicle.setBrake(brakeForce, 2);
      vehicle.setBrake(brakeForce, 3);
    }

    /***** 事件监听 *****/
    function handleParkSpaceClick(event: any, self: Renderer) {
      let vector = new THREE.Vector3(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1,
        0.5
      );
      vector = vector.unproject(camera);
      const raycaster = new THREE.Raycaster(
        camera.position,
        vector.sub(camera.position).normalize()
      );
      const intersects = raycaster.intersectObjects(scene.children);
      for (let i = 0; i < intersects.length; i++) {
        const obj = intersects[i];
        // @ts-ignore
        if (obj.object.userData.type === "parkingSpace") {
          // @ts-ignore
          obj.object.material.color.set(0x00ff00);
          self.selectedParkSpace = obj.object;
        }
      }
    }
    const cameraOffsetY = 15;
    const cameraOffsetZ = 25;
    // 自适应
    window.addEventListener("resize", onResize, false);
    function onResize() {
      const container = document.getElementById(initPayload.container);
      const style = container!.getBoundingClientRect();
      if (style.width) {
        const width = style.width;
        const height = style.height;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      }
      // 如果是移动端，则需要调近相机距离，这里以750px为例
      // if (style.width < 750) {
      //   cameraOffsetY = 5;
      //   cameraOffsetZ = 10;
      // }
    }
    // 全屏模式
    document.addEventListener("dblclick", () => {
      const fullscreenElement = document.fullscreenElement;
      if (fullscreenElement) {
        document.exitFullscreen();
        return;
      }
      renderer.domElement.requestFullscreen();
    });
    document.addEventListener("click", (e) => handleParkSpaceClick(e, this));

    function handleNavigate(e: any) {
      if (e.type != "keydown" && e.type != "keyup") {
        return;
      }
      const isKeyup = e.type === "keyup";
      switch (e.key) {
        case "ArrowUp":
          vehicle.applyEngineForce(isKeyup ? 0 : engineForce, 2);
          vehicle.applyEngineForce(isKeyup ? 0 : engineForce, 3);
          break;
        case "ArrowDown":
          vehicle.applyEngineForce(isKeyup ? 0 : -engineForce, 2);
          vehicle.applyEngineForce(isKeyup ? 0 : -engineForce, 3);
          break;
        case "ArrowLeft":
          vehicle.setSteeringValue(isKeyup ? 0 : -maxSteerVal, 2);
          vehicle.setSteeringValue(isKeyup ? 0 : -maxSteerVal, 3);
          // 漂移停车游戏需要，如果要正常行驶，需要去掉下面俩行
          vehicle.applyEngineForce(0, 2);
          vehicle.applyEngineForce(0, 3);
          break;
        case "ArrowRight":
          vehicle.setSteeringValue(isKeyup ? 0 : maxSteerVal, 2);
          vehicle.setSteeringValue(isKeyup ? 0 : maxSteerVal, 3);
          // 漂移停车游戏需要，如果要正常行驶，需要去掉下面俩行
          vehicle.applyEngineForce(0, 2);
          vehicle.applyEngineForce(0, 3);
          break;
      }
      brakeVehicle();
    }
    window.addEventListener("keydown", handleNavigate);
    window.addEventListener("keyup", handleNavigate);

    let startx = 0;
    let starty = 0;
    document.addEventListener("touchstart", (e) => {
      startx = e.touches[0].pageX;
      starty = e.touches[0].pageY;
    });
    document.addEventListener("touchend", function (e) {
      const endx = e.changedTouches[0].pageX;
      const endy = e.changedTouches[0].pageY;
      const direction = getDirection(startx, starty, endx, endy);
      switch (direction) {
        case ESlideDirection.Top:
          break;
        case ESlideDirection.Bottom:
          break;
        case ESlideDirection.Left:
          vehicle.setSteeringValue(-maxSteerVal, 2);
          vehicle.setSteeringValue(-maxSteerVal, 3);
          vehicle.applyEngineForce(0, 2);
          vehicle.applyEngineForce(0, 3);
          brakeVehicle();
          break;
        case ESlideDirection.Right:
          vehicle.setSteeringValue(maxSteerVal, 2);
          vehicle.setSteeringValue(maxSteerVal, 3);
          vehicle.applyEngineForce(0, 2);
          vehicle.applyEngineForce(0, 3);
          brakeVehicle();
          break;
        default:
      }
    });

    // const controls = new OrbitControls(camera, renderer.domElement);
    const stats = new Stats();
    // 0: fps, 1: ms, 2: mb, 3+: custom
    stats.showPanel(0);
    document.body.appendChild(stats.dom);
    const animate = () => {
      stats.begin();
      // controls.update();
      // 相机跟随自车
      camera.position.y = egoCar.position.y + cameraOffsetY;
      camera.position.z = egoCar.position.z + cameraOffsetZ;
      camera.lookAt(egoCar.position);
      renderer.render(scene, camera);
      updatePhysics();
      stats.end();
      requestAnimationFrame(animate);
    };
    setTimeout(() => {
      vehicle.applyEngineForce(2000, 2);
      vehicle.applyEngineForce(2000, 3);
    }, 100);
    animate();
    return renderer;
  }
}

export const gtaRenderer = new Renderer();
