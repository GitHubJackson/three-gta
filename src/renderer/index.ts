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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let carObj: any = null;
    // TODO 需要增加 gta 这个静态目录...能不能优化？
    fbxLoader.load("gta/bench/bench.fbx", (object) => {
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

    // 监听组合键
    const activeKeys = new Set();
    // 长按时间
    let startTime = 0;
    // 监听事件
    document.addEventListener("keydown", (e) => {
      activeKeys.add(e.key);
      if (startTime === 0) {
        startTime = Date.now();
      }
      let t = (Date.now() - startTime) / 1000;
      if (t > 10) {
        t = 10;
      }
      // const key = e.key;
      if (activeKeys.has("ArrowUp")) {
        carObj.position.z -= t * 0.3;
      }
      if (activeKeys.has("ArrowDown")) {
        carObj.position.z += t * 0.3;
      }
      if (activeKeys.has("ArrowLeft")) {
        carObj.position.x -= t * 0.3;
      }
      if (activeKeys.has("ArrowRight")) {
        carObj.position.x += t * 0.3;
      }
    });
    document.addEventListener("keyup", (e) => {
      activeKeys.delete(e.key);
      startTime = 0;
    });
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

    const controls = new OrbitControls(camera, renderer.domElement);
    const stats = new Stats();
    // 0: fps, 1: ms, 2: mb, 3+: custom
    stats.showPanel(0);
    document.body.appendChild(stats.dom);
    function animate() {
      stats.begin();
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
