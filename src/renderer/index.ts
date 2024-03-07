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
import * as TWEEN from "@tweenjs/tween.js";
import { ILineInfo } from "../types/render";
import { vehicleStore } from "../store";

const textureLoader = new THREE.TextureLoader();

const engineForce = 2000;
const maxSteerVal = 0.04;
const brakeForce = 30;
const velocityThreshold = 0.15;

// const fbxLoader = new FBXLoader();

interface IInitPayload {
  // 挂载的节点id
  container: string;
}

class Renderer {
  // 3d场景对象
  scene: THREE.Scene | null = null;
  camera: THREE.Camera | null = null;
  renderer: THREE.Renderer | null = null;
  plane: THREE.Mesh | null = null;
  particles: any = null;
  egoCar: any = null;
  balls: any[] = [];
  // 物理世界对象
  world: CANNON.World | null = null;
  vehicle: any = null;
  // 初始参数，比如挂载节点id
  initPayload: IInitPayload | null = null;

  constructor() {
    // console.log("===Renderer");
  }

  initConnonWorld() {
    /**
     * Physics
     **/
    const world = new CANNON.World();
    world.broadphase = new CANNON.SAPBroadphase(world);
    // 设定重力
    world.gravity.set(0, -9.8, 0);
    world.defaultContactMaterial.friction = 0;
    this.world = world;
  }

  init(initPayload: IInitPayload) {
    this.initPayload = initPayload;
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
    this.camera = camera;
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

    // 创建天空盒子
    const skyGeometry = new THREE.BoxGeometry(1000, 1000, 1000);
    const materialArray = [];
    for (let i = 0; i < 6; i++)
      materialArray.push(
        new THREE.MeshBasicMaterial({
          map: textureLoader.load("/gta/sky.jpg"),
          side: THREE.BackSide,
        })
      );
    const skyBox = new THREE.Mesh(skyGeometry, materialArray);
    scene.add(skyBox);

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
    this.egoCar = egoCar;
    this.physicObjects.push(egoCar);

    this.initConnonWorld();
    if (!this.world) {
      return;
    }

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
    this.world.addContactMaterial(wheelGroundContactMaterial);
    // car physics body
    const chassisShape = new CANNON.Box(new CANNON.Vec3(1, 0.3, 2));
    const chassisBody = new CANNON.Body({
      mass: 500,
      material: new CANNON.Material({ friction: 0.5, restitution: 0 }),
    });
    // @ts-ignore
    egoCar.physicBody = chassisBody;
    chassisBody.addEventListener("stop", () => {
      console.log("刚体停止运动");
    });
    chassisBody.addShape(chassisShape);
    chassisBody.position.set(0, 2, 0);
    // 初始角速度
    chassisBody.angularVelocity.set(0, 0, 0);
    const vehicle = new CANNON.RaycastVehicle({
      chassisBody,
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2,
    });
    this.vehicle = vehicle;
    // 车轮配置
    const options = {
      radius: 0.4,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: 8,
      suspensionRestLength: 0.4,
      frictionSlip: 8,
      dampingRelaxation: 3,
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
    vehicle.addToWorld(this.world);
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
    this.world.addEventListener("postStep", function () {
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
    this.drawRoad({
      pos: [0, 0, 0],
      rotation: [Math.PI / 2, 0, 0],
      size: [10, 50, 0.5],
    });
    // 第二段0 300
    const road2 = this.drawRoad({
      pos: [0, 0, -25],
      rotation: [Math.PI / 2 + 0.2, 0, 0],
      size: [10, 60, 0.5],
      hasLines: false,
    });
    // 第二段1
    const road21 = this.drawRoad({
      pos: [2, 8, -65],
      rotation: [Math.PI / 2 + 0.2, 0, 0],
      size: [6, 30, 0.1],
      hasLines: false,
    });
    // 第二段1动画
    const tweenRoad1Start = new TWEEN.Tween(road21.position)
      .to({ x: -2 }, 500)
      .delay(500)
      .repeat(Infinity)
      .yoyo(true)
      .onUpdate((data) => {
        // 更新刚体数据
        road21.position.x = data.x;
      })
      .start();
    // 第二段2
    const road22 = this.drawRoad({
      pos: [0, 15, -100],
      rotation: [Math.PI / 2 + 0.2, 0, 0],
      size: [10, 40, 0.1],
      hasLines: false,
    });
    // 第二段3
    const road23 = this.drawRoad({
      pos: [2, 21, -130],
      rotation: [Math.PI / 2 + 0.2, 0, 0],
      size: [6, 30, 0.1],
      hasLines: false,
    });
    // 第二段3动画
    const tweenRoad3Start = new TWEEN.Tween(road23.position)
      .to({ x: -2 }, 1000)
      .delay(500)
      .repeat(Infinity)
      .yoyo(true)
      .onUpdate((data) => {
        // 更新刚体数据
        road23.position.x = data.x;
      })
      .start();
    // 绘制第三段道路
    this.drawRoad({
      pos: [0, 16, -240],
      rotation: [Math.PI / 2 + 0.3, 0, 0],
      size: [20, 80, 0.5],
      hasLines: false,
    });
    // 绘制第四段道路
    this.drawRoad({
      pos: [0, 24, -400],
      rotation: [Math.PI / 2, 0, 0],
      size: [10, 200, 0.5],
    });
    this.drawFogWalls({
      pos: [0, 10, -65],
    });
    this.drawFogWalls({
      pos: [0, 0, -380],
    });
    this.drawObstacles({
      pos: [-3, -0.1, -16],
    });
    this.drawBalls({
      pos: [0, 35, -260],
    });
    this.drawFogWalls({
      pos: [0, 20, -370],
    });
    this.drawHammer({
      pos: [0, 38, -380],
      duration: 1000,
    });
    this.drawHammer({
      pos: [0, 38, -420],
      duration: 300,
    });
    this.drawObstacles({
      pos: [-3, 23.9, -360],
    });
    this.drawFogWalls({
      pos: [0, 20, -430],
    });
    //  终点线
    this.drawPolyLine({
      pos: [0, 24, -460],
      rotation: [Math.PI / 2, 0, Math.PI / 2],
      width: 2,
      length: 10,
    });

    const cameraOffsetY = 4;
    const cameraOffsetZ = 16;
    // 初始化事件
    this.initEvents();
    // const controls = new OrbitControls(camera, renderer.domElement);
    const stats = new Stats();
    // 0: fps, 1: ms, 2: mb, 3+: custom
    stats.showPanel(0);
    document.body.appendChild(stats.dom);
    const animate = () => {
      if (!this.world || !this.scene) {
        return;
      }
      stats.begin();
      // controls.update();
      // 相机跟随自车
      camera.position.y = egoCar.position.y + cameraOffsetY;
      camera.position.z = egoCar.position.z + cameraOffsetZ;
      camera.lookAt(egoCar.position);
      this.updateFog();
      renderer.render(scene, camera);
      // vehicle.applyEngineForce(engineForce, 2);
      // vehicle.applyEngineForce(engineForce, 3);
      if (egoCar.position.z <= -180) {
        this.balls.forEach((ball) => {
          this.world!.addBody(ball.physicBody);
          this.physicObjects.push(ball);
        });
      }
      // 到达终点判断
      if (egoCar.position.z <= -470 && egoCar.position.y >= -3) {
        vehicleStore.isSuccess = true;
        this.stop = true;
        setTimeout(() => {
          location.reload();
        }, 5000);
      }
      // 游戏结束判断
      if (egoCar.position.y <= -5) {
        vehicleStore.isGameOver = true;
        this.stop = true;
        setTimeout(() => {
          location.reload();
        }, 5000);
      }
      this.updatePhysics();
      TWEEN.update();
      stats.end();
    };
    animate();
    setInterval(() => {
      if (this.stop) {
        return;
      }
      animate();
    }, 16);
    return renderer;
  }
  stop = false;

  physicObjects: any[] = [];
  updatePhysics() {
    if (!this.world) {
      return;
    }
    this.world!.step(1 / 60);
    this.physicObjects.forEach((obj) => {
      // @ts-ignore
      obj.position.copy(obj.physicBody.position);
      // @ts-ignore
      obj.quaternion.copy(obj.physicBody.quaternion);
    });
  }

  // 绘制水管道路
  drawPipeRoad() {
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-10, 10, -60),
      new THREE.Vector3(-14, 20, -140),
    ]);
    // 可以添加更多的点来创建曲线
    // 创建管道几何体
    // path:路径   40：沿着轨迹细分数  4：管道半径   25：管道截面圆细分数, 是否闭合
    const tubeGeometry = new THREE.TubeGeometry(path, 40, 4, 25, true);
    // 创建材质
    const material = new THREE.MeshLambertMaterial({
      color: "blue",
      side: THREE.BackSide,
    });
    // 创建网格
    const tube = new THREE.Mesh(tubeGeometry, material);
    // 添加到场景
    this.scene!.add(tube);
  }

  drawRoad(payload: IRoadObjPayload) {
    const { pos, rotation, size, hasLines = true } = payload;
    const roadMaterial = new THREE.MeshLambertMaterial({
      color: "#8c8585",
      side: THREE.BackSide,
    });
    const roadGeometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
    const roadMesh = new THREE.Mesh(roadGeometry, roadMaterial);
    roadMesh.receiveShadow = true;
    roadMesh.rotation.x = rotation[0];
    roadMesh.position.set(pos[0], pos[1], pos[2]);
    this.scene!.add(roadMesh);
    // 刚体
    const q4 = roadMesh.quaternion;
    const roadShape = new CANNON.Box(
      new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2])
    );
    const roadBody = new CANNON.Body({ mass: 0 });
    roadBody.addShape(roadShape);
    roadBody.position.set(pos[0], pos[1], pos[2]);
    // @ts-ignore
    roadBody.quaternion = new CANNON.Quaternion(q4._x, q4._y, q4._z, q4._w);
    this.world!.addBody(roadBody);
    // @ts-ignore
    roadMesh.physicBody = roadBody;
    if (hasLines) {
      // 虚线
      this.drawLine(
        {
          width: 0.2,
          pos: [pos[0], pos[1] + 0.1, pos[2]],
          dash: true,
        },
        roadMesh
      );
      this.drawLine(
        {
          width: 0.2,
          pos: [-size[0] / 2 + 0.2, pos[1] + 0.1, pos[2]],
        },
        roadMesh
      );
      this.drawLine(
        {
          width: 0.2,
          pos: [size[0] / 2 - 0.2, pos[1] + 0.1, pos[2]],
        },
        roadMesh
      );
    }
    return roadMesh;
  }

  /** draw **/
  // 绘制车道线
  drawLine(lineInfo: ILineInfo, road: THREE.Mesh) {
    const { pos, width, dash, dashNum = 10, dashOffset = 2 } = lineInfo;
    // 获取道路宽高信息
    const roadSize = new THREE.Vector3();
    const roadBox = new THREE.Box3().setFromObject(road);
    roadBox.getSize(roadSize);
    const lineMaterial = new THREE.MeshBasicMaterial({
      color: lineInfo.color ?? 0xffffff,
      side: THREE.DoubleSide,
    });
    if (dash) {
      // const group = new THREE.Group();
      const length = roadSize.z / dashNum - dashOffset;
      // 根据间距和分段数 计算虚线下一段的起始位置
      let nextZ = pos[2] + roadSize.z / 2 - dashOffset;
      for (let i = 0; i < dashNum; i++) {
        const lineGeometry = new THREE.PlaneGeometry(width, length);
        const line = new THREE.Mesh(lineGeometry, lineMaterial);
        line.position.set(pos[0], pos[1], nextZ);
        if (road?.quaternion) {
          line.rotation.setFromQuaternion(road.quaternion);
        } else {
          line.rotation.x = Math.PI / 2;
        }
        this.scene!.add(line);
        nextZ = nextZ - (length + dashOffset);
      }
      // group.position.set(pos[0], pos[1], pos[2] + roadSize.z / 2);
      // this.scene!.add(group);
    } else {
      const lineGeometry = new THREE.PlaneGeometry(width, roadSize.z);
      const line = new THREE.Mesh(lineGeometry, lineMaterial);
      line.position.set(pos[0], pos[1], pos[2]);
      if (road?.quaternion) {
        line.rotation.setFromQuaternion(road.quaternion);
      } else {
        line.rotation.x = Math.PI / 2;
      }
      this.scene!.add(line);
    }
  }

  drawPolyLine(lineInfo: IPolyLineInfo) {
    const { pos, width, length, rotation } = lineInfo;
    // console.log("===roadSize", roadSize);
    const lineMaterial = new THREE.MeshBasicMaterial({
      color: lineInfo.color ?? 0xffffff,
      side: THREE.DoubleSide,
    });
    const lineGeometry = new THREE.PlaneGeometry(width, length);
    const line = new THREE.Mesh(lineGeometry, lineMaterial);
    line.position.set(pos[0], pos[1], pos[2]);
    line.rotation.set(rotation[0], rotation[1], rotation[2]);
    this.scene!.add(line);
  }

  // 绘制大摆锤
  drawHammer(payload: IHammerPayload) {
    const { pos, startAngle = -Math.PI / 2, duration = 1000 } = payload;
    const geometry = new THREE.CylinderGeometry(0.2, 0.2, 13, 10);
    const material = new THREE.MeshLambertMaterial({
      color: "gray",
    });
    const mesh1 = new THREE.Mesh(geometry, material);
    mesh1.position.set(-2, -6, -5);
    const geometry2 = new THREE.CylinderGeometry(1, 1, 4, 10);
    const material2 = new THREE.MeshLambertMaterial({
      color: "gray",
    });
    const mesh2 = new THREE.Mesh(geometry2, material2);
    mesh2.position.set(-2, -13.5, -5);
    mesh2.rotation.z = Math.PI / 2;
    const group = new THREE.Group();
    group.add(mesh1, mesh2);
    group.position.set(pos[0], pos[1], pos[2]);
    group.rotation.z = startAngle;
    this.scene!.add(group);
    // 创建刚体
    const q3 = mesh2.quaternion;
    const roadShape = new CANNON.Cylinder(1, 1, 4, 10);
    // 注意：设置mass为0，摆锤才可以悬浮在空中，不受重力影响
    const roadBody = new CANNON.Body({ mass: 0 });
    roadBody.addShape(roadShape);
    roadBody.position.set(mesh2.position.x, mesh2.position.y, mesh2.position.z);
    // @ts-ignore
    roadBody.quaternion = new CANNON.Quaternion(q3._x, q3._y, q3._z, q3._w);
    this.world!.addBody(roadBody);
    // @ts-ignore
    mesh2.physicBody = roadBody;
    // 摆锤动画
    const tweenStart = new TWEEN.Tween(group.rotation)
      .to({ z: Math.PI / 2 }, duration)
      .delay(500)
      .repeat(Infinity)
      .yoyo(true)
      .onUpdate((data) => {
        // NOTE 注意这里要重新计算mesh2的位置信息，因为mesh2的position是相对group的，并不会变化
        group.updateMatrixWorld(true);
        // TODO 获得此时椎体的位置和旋转度？
        const child = group.children[1];
        // 更新刚体数据
        // const pos = group.children[1].position;
        const globalPosition = new THREE.Vector3();
        const globalQuaternion = new THREE.Quaternion();
        const pos = child.getWorldPosition(globalPosition);
        const q = child.getWorldQuaternion(globalQuaternion);
        // @ts-ignore
        roadBody.quaternion = new CANNON.Quaternion(q._x, q._y, q._z, q._w);
        roadBody.position.set(pos.x, pos.y, pos.z);
      })
      .start();
  }

  // 绘制雾墙
  fogWalls: THREE.Mesh[] = [];
  drawFogWalls(payload: IObjPayload) {
    const { pos } = payload;
    const texture = textureLoader.load("/gta/cloud2.png");
    const material = new THREE.MeshLambertMaterial({
      map: texture,
      transparent: true,
      opacity: 0.8,
    });
    for (let i = 0; i < 10; i++) {
      const smokeGeo = new THREE.PlaneGeometry(20, 20);
      const mesh = new THREE.Mesh(smokeGeo, material);
      mesh.position.set(pos[0], pos[1], pos[2] - i * 0.05);
      mesh.rotation.z = Math.random() * Math.PI * 2;
      this.scene!.add(mesh);
      this.fogWalls.push(mesh);
    }
  }

  drawFog2() {
    // 创建雾墙的材质
    const fogMaterial = new THREE.ShaderMaterial({
      vertexShader: `
      varying vec3 vPosition;

      void main() {
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
      `,
      fragmentShader: `
      uniform vec3 fogColor; // 雾墙的颜色
      uniform float fogDensity; // 雾墙的密度
      uniform float fogDistance; // 雾墙的半径
      uniform vec3 fogCenter; // 雾墙的中心点
      varying vec3 vPosition;

      void main() {
          // 计算顶点到雾墙中心的距离
          float distance = length(vPosition - fogCenter);
          // 如果顶点在雾墙范围内，应用雾墙效果
          if (distance < fogDistance) {
              // 计算雾墙的强度，可以根据距离进行调整
              float fogStrength = 1.0 - clamp(distance / fogDistance, 0.0, 1.0);
              gl_FragColor = vec4(fogColor, 1.0) * fogStrength;
          } else {
              // 如果顶点在雾墙范围外，保持原始颜色
              gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
          }
      }`,
      uniforms: {
        fogColor: { value: new THREE.Color(0xffffff) }, // 雾墙颜色
        fogDensity: { value: 0.1 }, // 雾墙密度
        fogDistance: { value: 30.0 }, // 雾墙半径
        fogCenter: { value: new THREE.Vector3(0, 0, 0) }, // 雾墙中心点
      },
      transparent: true,
      // blending: THREE.AdditiveBlending, // 混合模式
      //  depthWrite: false // 不写入深度缓冲区
    });
    // 创建一个物体并应用自定义材质
    const geometry = new THREE.BoxGeometry(20, 50, 5);
    const mesh = new THREE.Mesh(geometry, fogMaterial);
    mesh.position.set(0, 0, -10);
    this.scene!.add(mesh);
    this.particles = mesh;
  }

  // 更新雾墙
  updateFog() {
    this.fogWalls.forEach((mesh) => {
      mesh.scale.set(
        mesh.scale.x + 0.0005,
        mesh.scale.y + 0.0005,
        mesh.scale.z
      );
    });
  }

  // 绘制路障
  drawObstacles(payload: IObjPayload) {
    const { pos } = payload;
    const boxSize = 1.6;
    const geometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
    const material = new THREE.MeshLambertMaterial({
      color: "yellow",
    });
    const mesh = new THREE.Mesh(geometry, material);
    // 加边框
    const box = geometry.clone();
    const edges = new THREE.EdgesGeometry(box);
    const edgesMaterial = new THREE.LineBasicMaterial({
      color: 0x333333,
    });
    const line = new THREE.LineSegments(edges, edgesMaterial);
    // 组合起来
    const group = new THREE.Group();
    group.add(line, mesh);
    const startPos = [pos[0], pos[1], pos[2]];
    let newPos = [...startPos];
    for (let i = 0; i < 10; i++) {
      if (i < 4) {
        newPos = [startPos[0] + i * 2, startPos[1] + boxSize, startPos[2]];
      } else if (i < 7) {
        newPos = [
          startPos[0] + (i - 3.5) * 2,
          startPos[1] + boxSize * 2,
          startPos[2],
        ];
      } else if (i < 9) {
        newPos = [
          startPos[0] + (i - 6) * 2,
          startPos[1] + boxSize * 3,
          startPos[2],
        ];
      } else {
        newPos = [startPos[0] + 3, startPos[1] + boxSize * 4, startPos[2]];
      }
      const obstacle = group.clone();
      obstacle.position.set(newPos[0], newPos[1], newPos[2]);
      this.scene!.add(obstacle);
      const q3 = obstacle.quaternion;
      const roadShape3 = new CANNON.Box(
        new CANNON.Vec3(boxSize / 2, boxSize / 2, boxSize / 2)
      );
      const roadBody3 = new CANNON.Body({ mass: 3 });
      roadBody3.addShape(roadShape3);
      roadBody3.position.set(newPos[0], newPos[1], newPos[2]);
      // @ts-ignore
      roadBody3.quaternion = new CANNON.Quaternion(q3._x, q3._y, q3._z, q3._w);
      this.world!.addBody(roadBody3);
      // @ts-ignore
      obstacle.physicBody = roadBody3;
      this.physicObjects.push(obstacle);
    }
  }

  // 绘制巨球
  drawBalls(payload: IObjPayload) {
    const { pos } = payload;
    const geometry = new THREE.SphereGeometry(2);
    const material = new THREE.MeshLambertMaterial({
      color: "brown",
    });
    const obstacle = new THREE.Mesh(geometry, material);
    obstacle.position.set(pos[0], pos[1], pos[2]);
    this.scene!.add(obstacle);
    const q3 = obstacle.quaternion;
    const roadShape3 = new CANNON.Sphere(2);
    const roadBody3 = new CANNON.Body({ mass: 200 });
    roadBody3.addShape(roadShape3);
    roadBody3.position.set(pos[0], pos[1], pos[2]);
    // @ts-ignore
    roadBody3.quaternion = new CANNON.Quaternion(q3._x, q3._y, q3._z, q3._w);
    // @ts-ignore
    obstacle.physicBody = roadBody3;
    this.balls = [obstacle];
  }

  brakeVehicle() {
    this.vehicle.setBrake(brakeForce, 0);
    this.vehicle.setBrake(brakeForce, 1);
    this.vehicle.setBrake(brakeForce, 2);
    this.vehicle.setBrake(brakeForce, 3);
  }
  handleNavigate(e: any) {
    if (e.type != "keydown" && e.type != "keyup") {
      return;
    }
    const isKeyup = e.type === "keyup";
    switch (e.key) {
      case "ArrowUp":
        this.vehicle.applyEngineForce(isKeyup ? 0 : engineForce, 2);
        this.vehicle.applyEngineForce(isKeyup ? 0 : engineForce, 3);
        break;
      case "ArrowDown":
        this.vehicle.applyEngineForce(isKeyup ? 0 : -engineForce, 2);
        this.vehicle.applyEngineForce(isKeyup ? 0 : -engineForce, 3);
        break;
      case "ArrowLeft":
        this.vehicle.setSteeringValue(isKeyup ? 0 : -maxSteerVal, 2);
        this.vehicle.setSteeringValue(isKeyup ? 0 : -maxSteerVal, 3);
        // this.brakeVehicle();
        break;
      case "ArrowRight":
        this.vehicle.setSteeringValue(isKeyup ? 0 : maxSteerVal, 2);
        this.vehicle.setSteeringValue(isKeyup ? 0 : maxSteerVal, 3);
        // this.brakeVehicle();
        break;
    }
  }
  initEvents() {
    window.addEventListener("keydown", (e) => {
      this.handleNavigate(e);
    });
    window.addEventListener("keyup", (e) => {
      this.handleNavigate(e);
    });
    // 移动端触发滑动事件
    let startx = 0;
    let starty = 0;
    window.addEventListener("touchstart", (e) => {
      startx = e.touches[0].pageX;
      starty = e.touches[0].pageY;
    });
    window.addEventListener("touchend", (e) => {
      const endx = e.changedTouches[0].pageX;
      const endy = e.changedTouches[0].pageY;
      const direction = getDirection(startx, starty, endx, endy);
      switch (direction) {
        case ESlideDirection.Top:
          break;
        case ESlideDirection.Bottom:
          break;
        case ESlideDirection.Left:
          this.vehicle.setSteeringValue(-maxSteerVal, 2);
          this.vehicle.setSteeringValue(-maxSteerVal, 3);
          this.vehicle.applyEngineForce(0, 2);
          this.vehicle.applyEngineForce(0, 3);
          // this.brakeVehicle();
          break;
        case ESlideDirection.Right:
          this.vehicle.setSteeringValue(maxSteerVal, 2);
          this.vehicle.setSteeringValue(maxSteerVal, 3);
          this.vehicle.applyEngineForce(0, 2);
          this.vehicle.applyEngineForce(0, 3);
          // this.brakeVehicle();
          break;
        default:
      }
    });
    // 双击开启/关闭全屏模式
    window.addEventListener("dblclick", () => {
      const fullscreenElement = document.fullscreenElement;
      if (fullscreenElement) {
        document.exitFullscreen();
        return;
      }
      this.renderer!.domElement.requestFullscreen();
    });
    // 自适应
    window.addEventListener(
      "resize",
      () => {
        if (!this.camera || !this.renderer || !this.initPayload) {
          return;
        }
        const container = document.getElementById(this.initPayload.container);
        const style = container!.getBoundingClientRect();
        if (style.width) {
          const width = style.width;
          const height = style.height;
          // @ts-ignore
          this.camera.aspect = width / height;
          // @ts-ignore
          this.camera.updateProjectionMatrix();
          this.renderer.setSize(width, height);
        }
        // 如果是移动端，则需要调近相机距离，这里以750px为例
        // if (style.width < 750) {
        //   cameraOffsetY = 5;
        //   cameraOffsetZ = 10;
        // }
      },
      false
    );
  }
}

export const gtaRenderer = new Renderer();

export interface IObjPayload {
  pos: number[];
}

export interface IRoadObjPayload extends IObjPayload {
  rotation: number[];
  size: number[];
  hasLines?: boolean;
}

export interface IHammerPayload extends IObjPayload {
  // 起始角度
  startAngle?: number;
  // 完成一次摆动的时间
  duration?: number;
}

export interface IPolyLineInfo {
  // 宽度
  width: number;
  // 长度
  length: number;
  rotation: number[];
  // 起始位置
  pos: number[];
  // 默认白色
  color?: string;
}
