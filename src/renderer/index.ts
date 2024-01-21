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

    // // 地面
    // const planeGeometry = new THREE.PlaneGeometry(200, 200);
    // // 可产生阴影的材质
    // const planeMaterial = new THREE.MeshLambertMaterial({ color: 0xc6c6c6 });
    // const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    // plane.rotation.x = (-90 * Math.PI) / 180; // 地面 x轴 旋转-90度
    // // 地面接受阴影
    // plane.receiveShadow = true;
    // scene.add(plane);
    const planeGeometry = new THREE.PlaneGeometry(10, 10, 10);
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      side: THREE.DoubleSide,
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = Math.PI / 2;
    scene.add(plane);

    // let carObj: any = null;
    // fbxLoader.load(window.location.href + "/bench/bench.fbx", (object) => {
    //   const mesh = object.children[0];
    //   mesh.traverse(function (child) {
    //     child.castShadow = true;
    //     child.receiveShadow = true;
    //   });
    //   mesh.position.set(0, 0, 0);
    //   mesh.rotation.y = Math.PI;
    //   mesh.rotation.x = Math.PI / 2;
    //   mesh.scale.set(0.01, 0.01, 0.01);
    //   scene.add(mesh);
    //   carObj = mesh;
    // });

    // 创建一个球用于物理碰撞测试
    // const sphereG = new THREE.SphereGeometry(1, 32, 32);
    // const sphereM = new THREE.MeshStandardMaterial({ color: 0x888888 });
    // const box = new THREE.Mesh(sphereG, sphereM);
    // box.position.set(1, 1, 1);
    // box.castShadow = true;
    // scene.add(box);

    /**
     * Physics
     **/

    const world = new CANNON.World();
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.gravity.set(0, -10, 0);
    world.defaultContactMaterial.friction = 0;

    const groundMaterial = new CANNON.Material("groundMaterial");
    const wheelMaterial = new CANNON.Material("wheelMaterial");
    const wheelGroundContactMaterial = new CANNON.ContactMaterial(
      wheelMaterial,
      groundMaterial,
      {
        friction: 0.3,
        restitution: 0,
        contactEquationStiffness: 1000,
      }
    );
    world.addContactMaterial(wheelGroundContactMaterial);

    // car physics body
    const chassisShape = new CANNON.Box(new CANNON.Vec3(1, 0.3, 2));
    const chassisBody = new CANNON.Body({ mass: 150 });
    chassisBody.addShape(chassisShape);
    chassisBody.position.set(0, 0.2, 0);
    chassisBody.angularVelocity.set(0, 0, 0); // initial velocity

    // car visual body
    const geometry = new THREE.BoxGeometry(2, 0.6, 4); // double chasis shape
    const material = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      side: THREE.DoubleSide,
    });
    const box = new THREE.Mesh(geometry, material);
    scene.add(box);

    // parent vehicle object
    const vehicle = new CANNON.RaycastVehicle({
      chassisBody: chassisBody,
      indexRightAxis: 0, // x
      indexUpAxis: 1, // y
      indexForwardAxis: 2, // z
    });

    // wheel options
    const options = {
      radius: 0.3,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: 45,
      suspensionRestLength: 0.4,
      frictionSlip: 5,
      dampingRelaxation: 2.3,
      dampingCompression: 4.5,
      maxSuspensionForce: 200000,
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

    // car wheels
    const wheelBodies: any[] = [],
      wheelVisuals: any[] = [];
    vehicle.wheelInfos.forEach(function (wheel) {
      const shape = new CANNON.Cylinder(
        wheel.radius,
        wheel.radius,
        wheel.radius / 2,
        20
      );
      const body = new CANNON.Body({ mass: 1, material: wheelMaterial });
      const q = new CANNON.Quaternion();
      q.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
      body.addShape(shape, new CANNON.Vec3(), q);
      wheelBodies.push(body);
      // wheel visual body
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

    // update the wheels to match the physics
    world.addEventListener("postStep", function () {
      for (let i = 0; i < vehicle.wheelInfos.length; i++) {
        vehicle.updateWheelTransform(i);
        const t = vehicle.wheelInfos[i].worldTransform;
        // update wheel physics
        wheelBodies[i].position.copy(t.position);
        wheelBodies[i].quaternion.copy(t.quaternion);
        // update wheel visuals
        wheelVisuals[i].position.copy(t.position);
        wheelVisuals[i].quaternion.copy(t.quaternion);
      }
    });

    const q = plane.quaternion;
    const planeBody = new CANNON.Body({
      mass: 0, // mass = 0 makes the body static
      material: groundMaterial,
      shape: new CANNON.Plane(),
      // @ts-ignore
      quaternion: new CANNON.Quaternion(-q._x, q._y, q._z, q._w),
    });
    world.addBody(planeBody);

    function updatePhysics() {
      // if (carObj) {
      world.step(1 / 60);
      // update the chassis position
      // @ts-ignore
      box.position.copy(chassisBody.position);
      // @ts-ignore
      box.quaternion.copy(chassisBody.quaternion);
      // }
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

    function navigate(e: any) {
      if (e.type != "keydown" && e.type != "keyup") return;
      const keyup = e.type == "keyup";
      vehicle.setBrake(0, 0);
      vehicle.setBrake(0, 1);
      vehicle.setBrake(0, 2);
      vehicle.setBrake(0, 3);

      const engineForce = 800,
        maxSteerVal = 0.3;
      switch (e.keyCode) {
        case 38: // forward
          vehicle.applyEngineForce(keyup ? 0 : -engineForce, 2);
          vehicle.applyEngineForce(keyup ? 0 : -engineForce, 3);
          break;

        case 40: // backward
          vehicle.applyEngineForce(keyup ? 0 : engineForce, 2);
          vehicle.applyEngineForce(keyup ? 0 : engineForce, 3);
          break;

        case 39: // right
          vehicle.setSteeringValue(keyup ? 0 : -maxSteerVal, 2);
          vehicle.setSteeringValue(keyup ? 0 : -maxSteerVal, 3);
          break;

        case 37: // left
          vehicle.setSteeringValue(keyup ? 0 : maxSteerVal, 2);
          vehicle.setSteeringValue(keyup ? 0 : maxSteerVal, 3);
          break;
      }
    }

    window.addEventListener("keydown", navigate);
    window.addEventListener("keyup", navigate);

    // const clock = new THREE.Clock();
    // let oldElapsedTime = 0;

    const controls = new OrbitControls(camera, renderer.domElement);
    const stats = new Stats();
    // 0: fps, 1: ms, 2: mb, 3+: custom
    stats.showPanel(0);
    document.body.appendChild(stats.dom);
    function animate() {
      stats.begin();
      // const elapsedTime = clock.getElapsedTime();
      // const deltaTime = elapsedTime - oldElapsedTime;
      // oldElapsedTime = elapsedTime;
      // sphereBody.applyForce(new CANNON.Vec3(-0.5, 0, 0), sphereBody.position);
      //更新物理世界
      // world.step(1 / 60, deltaTime, 3);
      controls.update();
      renderer.render(scene, camera);
      updatePhysics();
      stats.end();
      requestAnimationFrame(animate);
    }
    animate();
    return renderer;
  }
}

export const gtaRenderer = new Renderer();
