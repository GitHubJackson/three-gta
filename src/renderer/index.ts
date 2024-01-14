import * as THREE from "three";

interface IInitPayload {
  // 挂载的节点id
  container: string;
}

class Renderer {
  constructor() {
    console.log("===init Renderer");
  }

  init(initPayload: IInitPayload) {
    // 初始化
    const container = document.getElementById(initPayload.container);
    const style = getComputedStyle(container!);
    const width = parseFloat(style.width);
    const height = parseFloat(style.height);
    // 创建一个场景
    const scene = new THREE.Scene();
    const gridHelper = new THREE.GridHelper(100, 30, 0x2c2c2c, 0x888888);
    scene.add(gridHelper);

    // 创建一个具有透视效果的摄像机
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 800);

    // 设置摄像机位置，并将其朝向场景中心
    camera.position.x = 10;
    camera.position.y = 10;
    camera.position.z = 30;
    camera.lookAt(scene.position);

    // 创建一个 WebGL 渲染器，Three.js 还提供 <canvas>, <svg>, CSS3D 渲染器。
    const renderer = new THREE.WebGLRenderer();

    // 设置渲染器的清除颜色（即背景色）和尺寸。
    // 若想用 body 作为背景，则可以不设置 clearColor，然后在创建渲染器时设置 alpha: true，即 new THREE.WebGLRenderer({ alpha: true })
    renderer.setClearColor(0xffffff);
    renderer.setSize(width, height);

    // 创建一个长宽高均为 4 个单位长度的立方体（几何体）
    const cubeGeometry = new THREE.BoxGeometry(4, 4, 4);

    // 创建材质（该材质不受光源影响）
    const cubeMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
    });

    // 创建一个立方体网格（mesh）：将材质包裹在几何体上
    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);

    // 设置网格的位置
    cube.position.x = 0;
    cube.position.y = -2;
    cube.position.z = 0;

    // 将立方体网格加入到场景中
    scene.add(cube);

    // 将渲染器的输出（此处是 canvas 元素）插入到 body 中
    document.body.appendChild(renderer.domElement);

    // 渲染，即摄像机拍下此刻的场景
    renderer.render(scene, camera);
  }
}

export const gtaRenderer = new Renderer();
