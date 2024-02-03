import { useEffect } from "react";
import { gtaRenderer } from "../../renderer";
import styles from "./index.module.css";

export function Playground() {
  useEffect(() => {
    const renderer = gtaRenderer.init({
      container: "playground",
    });
    // return () => {
    //   // 销毁时清除渲染器占用的资源
    //   renderer.dispose();
    // };
  }, []);

  return <div id="playground" className={styles["playground"]}></div>;
}
