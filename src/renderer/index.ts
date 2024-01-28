/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import Stats from "stats.js";

const fbxLoader = new FBXLoader();

interface IInitPayload {
  // 挂载的节点id
  container: string;
}

class Renderer {
  scene: THREE.Scene | null = null;
  // 选中的车位
  selectedParkSpace: THREE.Object3D | null = null;

  constructor() {
    // console.log("===Renderer");
  }

  createParkingSpace() {
    const plane = new THREE.PlaneGeometry(8, 5);
    const material = new THREE.MeshPhongMaterial({
      color: 0x666666,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(plane, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(10, 0.12, -20);
    this.scene?.add(mesh);
    // 增加自定义type，便于后面处理车位的选中逻辑
    mesh.userData.type = "parkingSpace";
  }

  init(initPayload: IInitPayload) {
    const container = document.getElementById(initPayload.container);
    const style = container!.getBoundingClientRect();
    const width = style.width;
    const height = style.height;
    /***** 创建一个场景 *****/
    const scene = new THREE.Scene();
    this.scene = scene;
    const gridHelper = new THREE.GridHelper(100, 30, 0x4c4c4c, 0x5c5c5c);
    gridHelper.position.y = 0.1;
    scene.add(gridHelper);
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
    // camera.position.y = 10;
    // camera.position.z = 20;
    // camera.lookAt(scene.position);
    /***** 创建一个 WebGL 渲染器 *****/
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
    const planeMaterial = new THREE.MeshLambertMaterial({
      color: 0xc6c6c6,
      side: THREE.DoubleSide,
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    // 地面接受阴影
    plane.receiveShadow = true;
    plane.rotation.x = Math.PI / 2;
    scene.add(plane);

    // 小车
    const geometry = new THREE.BoxGeometry(2, 0.6, 3);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      side: THREE.DoubleSide,
    });
    const vehicle = new THREE.Mesh(geometry, material);
    vehicle.position.set(0, 1, 0);
    scene.add(vehicle);
    // 增加边框
    const box = geometry.clone();
    const edges = new THREE.EdgesGeometry(box);
    const edgesMaterial = new THREE.LineBasicMaterial({
      color: 0x333333,
    });
    const line = new THREE.LineSegments(edges, edgesMaterial);
    line.position.x = 0;
    line.position.y = 1;
    line.position.z = 0;
    scene.add(line);
    // 组成一个Group
    const egoCar = new THREE.Group();
    egoCar.name = "自车";
    egoCar.add(vehicle, line);
    scene.add(egoCar);
    // 车轮
    const axlewidth = 0.7;
    const radius = 0.4;
    const wheels: any[] = [];
    const wheelObjects: any[] = [];
    wheels.push({ position: [axlewidth, 0.4, -1], radius });
    wheels.push({
      position: [-axlewidth, 0.4, -1],
      radius,
    });
    wheels.push({ position: [axlewidth, 0.4, 1], radius });
    wheels.push({ position: [-axlewidth, 0.4, 1], radius });
    wheels.forEach(function (wheel) {
      const geometry = new THREE.CylinderGeometry(
        wheel.radius,
        wheel.radius,
        0.4,
        32
      );
      const material = new THREE.MeshPhongMaterial({
        color: 0xd0901d,
        emissive: 0xee0000,
        side: THREE.DoubleSide,
        flatShading: true,
      });
      const cylinder = new THREE.Mesh(geometry, material);
      cylinder.geometry.rotateZ(Math.PI / 2);
      cylinder.position.set(
        wheel.position[0],
        wheel.position[1],
        wheel.position[2]
      );
      egoCar.add(cylinder);
      wheelObjects.push(cylinder);
    });
    // 看向自车
    camera.lookAt(egoCar.position);

    /***** 绘制车位 *****/
    this.createParkingSpace();

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
    document.addEventListener("click", (e) => handleParkSpaceClick(e, this));

    // 记录开始按下的时间
    let startTime = 0;
    const activeKeys = new Set();
    let t = 0;
    document.addEventListener("keydown", (e) => {
      activeKeys.add(e.key);
      if (startTime === 0) {
        startTime = Date.now();
      }
      t = (Date.now() - startTime) / 1000;
      if (t > 10) {
        t = 10;
      }
    });
    document.addEventListener("keyup", (e) => {
      activeKeys.delete(e.key);
      // 没按转向键时校正车轮
      if (e.key === "ArrowLeft") {
        wheelObjects.forEach((wheel) => {
          wheel.rotation.y -= Math.PI / 4;
        });
      }
      if (e.key === "ArrowRight") {
        wheelObjects.forEach((wheel) => {
          wheel.rotation.y += Math.PI / 4;
        });
      }
      if (!activeKeys.has("ArrowUp") && !activeKeys.has("ArrowDown")) {
        startTime = 0;
      }
    });

    const controls = new OrbitControls(camera, renderer.domElement);
    const stats = new Stats();
    // 0: fps, 1: ms, 2: mb, 3+: custom
    stats.showPanel(0);
    document.body.appendChild(stats.dom);
    const animate = () => {
      stats.begin();
      controls.update();
      // 相机跟随自车
      camera.position.y = egoCar.position.y + 15;
      camera.position.z = egoCar.position.z + 25;
      camera.lookAt(egoCar.position);
      // 行车逻辑
      if (activeKeys.has("ArrowUp")) {
        egoCar.position.z -= t * 0.1 * Math.cos(egoCar.rotation.y);
        egoCar.position.x -= t * 0.1 * Math.sin(egoCar.rotation.y);
      }
      if (activeKeys.has("ArrowDown")) {
        egoCar.position.z += t * 0.1 * Math.cos(egoCar.rotation.y);
        egoCar.position.x += t * 0.1 * Math.sin(egoCar.rotation.y);
      }
      if (activeKeys.has("ArrowLeft")) {
        egoCar.rotation.y += 0.01;
        wheelObjects.forEach((wheel) => {
          wheel.rotation.y = egoCar.rotation.y + Math.PI / 4;
        });
      }
      if (activeKeys.has("ArrowRight")) {
        egoCar.rotation.y -= 0.01;
        wheelObjects.forEach((wheel) => {
          wheel.rotation.y = egoCar.rotation.y - Math.PI / 4;
        });
      }
      // 自动泊车
      if (this.selectedParkSpace) {
        const position = this.selectedParkSpace.position;
        if (egoCar.position.z >= position.z) {
          egoCar.position.z -= 0.1;
        }
        if (egoCar.position.x <= position.x) {
          egoCar.position.x += 0.1;
        }
      }
      renderer.render(scene, camera);
      stats.end();
      requestAnimationFrame(animate);
    };
    animate();
    return renderer;
  }
}

export const gtaRenderer = new Renderer();
