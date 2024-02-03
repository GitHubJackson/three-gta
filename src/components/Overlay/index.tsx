import { observer } from "mobx-react";
import { vehicleStore } from "../../store";
import styles from "./index.module.css";
import { useEffect, useState } from "react";

export const Overlay = observer(() => {
  const [score, setScore] = useState(0);
  useEffect(() => {
    if (vehicleStore.score) {
      const timer = setInterval(() => {
        setScore((score) => {
          if (score + 1 === vehicleStore.score) {
            clearInterval(timer);
          }
          return score + 1;
        });
      }, 10);
    }
  }, [vehicleStore.score]);

  if (!vehicleStore.isStop) {
    return null;
  }

  return (
    <div className={styles["container"]}>
      <div className={styles["score-box"]}>
        <div className={styles["score-desc"]}>得分</div>
        <div>{score}</div>
      </div>
    </div>
  );
});
