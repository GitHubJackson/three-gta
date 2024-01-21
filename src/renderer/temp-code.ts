/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import Stats from "stats.js";
import * as CANNON from "cannon-es";

const fbxLoader = new FBXLoader();

interface IInitPayload {
  // 挂载的节点id
  container: string;
}

class Renderer {
  constructor() {
    // console.log("===Renderer");
  }

  init(initPayload: IInitPayload) {
    const container = document.getElementById(initPayload.container);
    const style = container!.getBoundingClientRect();
    const width = style.width;
    const height = style.height;
    // 创建一个场景
    const scene = new THREE.Scene();
    const gridHelper = new THREE.GridHelper(100, 30, 0x4c4c4c, 0x5c5c5c);
    gridHelper.position.y = 0.1;
    scene.add(gridHelper);

    // 创建环境光和其他光源
    const ambientLight = new THREE.AmbientLight(0xffffff);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff);
    directionalLight.castShadow = true;
    // 设置方向光源位置
    directionalLight.position.set(15, 30, 25);
    scene.add(directionalLight);

    // 创建一个具有透视效果的摄像机
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 800);
    // 设置摄像机位置，并将其朝向场景中心
    camera.position.x = 0;
    camera.position.y = 10;
    camera.position.z = 20;
    camera.lookAt(scene.position);

    // 创建一个 WebGL 渲染器，Three.js 还提供 <canvas>, <svg>, CSS3D 渲染器
    const renderer = new THREE.WebGLRenderer({
      antialias: true, // 开启抗锯齿
    });
    // 将渲染器的输出（此处是 canvas 元素）插入到 body 中
    document.body.appendChild(renderer.domElement);
    // 设置渲染器的清除颜色（即背景色）和尺寸
    // 若想用 body 作为背景，则可以不设置 clearColor，然后在创建渲染器时设置 alpha: true，即 new THREE.WebGLRenderer({ alpha: true })
    // renderer.setClearColor(0xffffff);
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;

    // 地面
    const planeGeometry = new THREE.PlaneGeometry(200, 200);
    // 可产生阴影的材质
    const planeMaterial = new THREE.MeshLambertMaterial({ color: 0xc6c6c6 });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = (-90 * Math.PI) / 180; // 地面 x轴 旋转-90度
    // 地面接受阴影
    plane.receiveShadow = true;
    scene.add(plane);

    // 创建一个长宽高均为 4 个单位长度的长方体
    const cubeGeometry = new THREE.BoxGeometry(4, 4, 4);

    // 创建材质（该材质不受光源影响）
    const cubeMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
    });
    // cubeMaterial.wireframe = true;

    // 创建一个立方体网格（mesh）：将材质包裹在几何体上
    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    // 立方体开启阴影效果
    cube.castShadow = true;
    cube.position.x = 4;
    cube.position.y = 2;
    cube.position.z = 0;
    // 将立方体网格加入到场景中
    // scene.add(cube);

    // 增加边框
    // 克隆长方体
    const box = cubeGeometry.clone();
    const edges = new THREE.EdgesGeometry(box);
    const edgesMaterial = new THREE.LineBasicMaterial({
      color: 0x333333,
    });
    const line = new THREE.LineSegments(edges, edgesMaterial);
    line.position.x = 4;
    line.position.y = 2;
    line.position.z = 0;
    // scene.add(line);

    let carObj: any = null;
    fbxLoader.load(window.location.href + "/bench/bench.fbx", (object) => {
      const mesh = object.children[0];
      mesh.traverse(function (child) {
        child.castShadow = true;
        child.receiveShadow = true;
      });
      mesh.position.set(0, 0, 0);
      mesh.rotation.y = Math.PI;
      mesh.rotation.x = Math.PI / 2;
      mesh.scale.set(0.01, 0.01, 0.01);
      scene.add(mesh);
      carObj = mesh;
    });

    // 创建一个球用于物理碰撞测试
    const sphereG = new THREE.SphereGeometry(1, 32, 32);
    const sphereM = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const mesh = new THREE.Mesh(sphereG, sphereM);
    mesh.position.set(1, 1, 1);
    mesh.castShadow = true;
    scene.add(mesh);

    // 初始化物理世界
    const world = new CANNON.World();
    world.quatNormalizeSkip = 0;
    world.quatNormalizeFast = false;
    world.defaultContactMaterial.friction = 0;
    world.gravity.set(0, -9.82, 0);
    world.broadphase = new CANNON.SAPBroadphase(world);
    // 初始化小球刚体
    const sphereShape = new CANNON.Sphere(0.5);
    const sphereBody = new CANNON.Body({
      mass: 1,
      position: new CANNON.Vec3(1, 1, 1),
      shape: sphereShape,
    });
    world.addBody(sphereBody);
    // mesh.userData = sphereBody;
    // 初始化地面刚体
    const floorShape = new CANNON.Plane();
    const floorBody = new CANNON.Body({
      mass: 0,
      shape: floorShape,
    });
    world.addBody(floorBody);
    floorBody.quaternion.setFromAxisAngle(
      new CANNON.Vec3(-1, 0, 0),
      Math.PI * 0.5
    );

    const carBodySize = new THREE.Vector3(4.52, 2.26, 1.08);
    // const wheelRadius = 0.5;
    // 小车
    //定义车体形状
    let chassisShape = null;
    //车体为一个矩形
    chassisShape = new CANNON.Box(
      new CANNON.Vec3(carBodySize.x / 2, carBodySize.y / 2, carBodySize.z / 2)
    );
    //定义车体刚体
    const chassisBody = new CANNON.Body({
      mass: 150,
      shape: chassisShape,
      material: new CANNON.Material({
        friction: 0,
        restitution: 0,
      }),
    });
    //初始化刚体的位置
    chassisBody.position.set(1, 1, 1);
    //设置一个初始的角速度
    chassisBody.angularVelocity.set(0, 0, 0);
    //初始化车辆引擎
    const vehicle = new CANNON.RaycastVehicle({
      chassisBody: chassisBody,
      indexForwardAxis: 0,
      indexRightAxis: 1,
      indexUpAxis: 2,
    });
    const options = {
      radius: 0.5,
      directionLocal: new CANNON.Vec3(0, 0, -1),
      suspensionStiffness: 30,
      suspensionRestLength: 0.3,
      frictionSlip: 5,
      dampingRelaxation: 2.3,
      dampingCompression: 4.4,
      maxSuspensionForce: 100000,
      rollInfluence: 0.01,
      axleLocal: new CANNON.Vec3(0, 1, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(1, 1, 0),
      maxSuspensionTravel: 0.3,
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true,
    };
    options.chassisConnectionPointLocal.set(1, 1, 0);
    vehicle.addWheel(options);
    options.chassisConnectionPointLocal.set(1, -1, 0);
    vehicle.addWheel(options);
    options.chassisConnectionPointLocal.set(-1, 1, 0);
    vehicle.addWheel(options);
    options.chassisConnectionPointLocal.set(-1, -1, 0);
    vehicle.addWheel(options);
    //通过addToWorld方法将将车辆及其约束添加到世界上。
    vehicle.addToWorld(world);
    const wheelBodies: CANNON.Body[] = [];
    const wheelMaterial = new CANNON.Material("wheel");
    const wheelOrientation = new CANNON.Quaternion();
    wheelOrientation.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI / 2);
    vehicle.wheelInfos.forEach((wheel) => {
      const wheelShape = new CANNON.Cylinder(
        wheel.radius,
        wheel.radius,
        wheel.radius / 2,
        8
      );
      const wheelBody = new CANNON.Body({
        type: CANNON.Body.KINEMATIC,
        collisionFilterGroup: 0, // turn off collisions
      });
      wheelBody.addShape(wheelShape, CANNON.Vec3.ZERO, wheelOrientation);
      wheelBodies.push(wheelBody);
      world.addBody(wheelBody);
    });
    // 增加材质（小车）
    const groundMaterial = new CANNON.Material("groundMaterial");
    const wheelGroundContactMaterial = new CANNON.ContactMaterial(
      wheelMaterial,
      groundMaterial,
      {
        friction: 0.3,
        restitution: 0,
        contactEquationStiffness: 1000,
      }
    );
    // We must add the contact materials to the world
    world.addContactMaterial(wheelGroundContactMaterial);
    world.addEventListener("postStep", function () {
      for (let i = 0; i < vehicle.wheelInfos.length; i++) {
        vehicle.updateWheelTransform(i);
        const t = vehicle.wheelInfos[i].worldTransform;
        const wheelBody = wheelBodies[i];
        wheelBody.position.copy(t.position);
        wheelBody.quaternion.copy(t.quaternion);
      }
      // @ts-ignore
      mesh.position.copy(vehicle.chassisBody.position);
      // @ts-ignore
      mesh.quaternion.copy(vehicle.chassisBody.quaternion);
      mesh.translateOnAxis(new THREE.Vector3(0, 0, 1), 0.6);
    });

    document.onkeydown = handler;
    document.onkeyup = handler;
    const maxSteerVal = 0.5;
    const maxForce = 1000;
    const brakeForce = 1000000;
    function handler(event: any) {
      const up = event.type == "keyup";
      if (!up && event.type !== "keydown") {
        return;
      }
      vehicle.setBrake(0, 0);
      vehicle.setBrake(0, 1);
      vehicle.setBrake(0, 2);
      vehicle.setBrake(0, 3);
      switch (event.keyCode) {
        case 38: // forward
          vehicle.applyEngineForce(up ? 0 : -maxForce, 2);
          vehicle.applyEngineForce(up ? 0 : -maxForce, 3);
          break;

        case 40: // backward
          vehicle.applyEngineForce(up ? 0 : maxForce, 2);
          vehicle.applyEngineForce(up ? 0 : maxForce, 3);
          break;

        case 66: // b
          vehicle.setBrake(brakeForce, 0);
          vehicle.setBrake(brakeForce, 1);
          vehicle.setBrake(brakeForce, 2);
          vehicle.setBrake(brakeForce, 3);
          break;

        case 39: // right
          vehicle.setSteeringValue(up ? 0 : -maxSteerVal, 0);
          vehicle.setSteeringValue(up ? 0 : -maxSteerVal, 1);
          break;

        case 37: // left
          vehicle.setSteeringValue(up ? 0 : maxSteerVal, 0);
          vehicle.setSteeringValue(up ? 0 : maxSteerVal, 1);
          break;
      }
    }

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

    const clock = new THREE.Clock();
    let oldElapsedTime = 0;

    const controls = new OrbitControls(camera, renderer.domElement);
    const stats = new Stats();
    // 0: fps, 1: ms, 2: mb, 3+: custom
    stats.showPanel(0);
    document.body.appendChild(stats.dom);
    function animate() {
      stats.begin();
      const elapsedTime = clock.getElapsedTime();
      const deltaTime = elapsedTime - oldElapsedTime;
      oldElapsedTime = elapsedTime;
      // sphereBody.applyForce(new CANNON.Vec3(-0.5, 0, 0), sphereBody.position);
      //更新物理世界
      world.step(1 / 60, deltaTime, 3);
      //位置更新
      // console.log("===chassisBody.position", vehicle.chassisBody.position);
      // mesh.position.copy(sphereBody.position);
      // this.updateDrive();
      // mesh.position.x = vehicle.chassisBody.position.x;
      // mesh.position.y = vehicle.chassisBody.position.y;
      // mesh.position.z = vehicle.chassisBody.position.z;
      controls.update();
      renderer.render(scene, camera);
      stats.end();
      requestAnimationFrame(animate);
    }
    animate();
    return renderer;
  }
}

export const gtaRenderer = new Renderer();
