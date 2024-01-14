import { useEffect } from "react";
import { gtaRenderer } from "../../renderer";
import styles from "./index.module.css";

export function Playground() {
  useEffect(() => {
    gtaRenderer.init({
      container: "playground",
    });
  }, []);

  return <div id="playground" className={styles["playground"]}></div>;
}
