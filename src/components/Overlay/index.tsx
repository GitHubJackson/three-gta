import { observer } from "mobx-react";
import { vehicleStore } from "../../store";
import styles from "./index.module.css";

export const Overlay = observer(() => {
  if (!vehicleStore.isGameOver && !vehicleStore.isSuccess) {
    return null;
  }

  return (
    <div className={styles["container"]}>
      <div className={styles["score-box"]}>
        {/* <div className={styles["score-desc"]}>得分</div> */}
        <div>{vehicleStore.isGameOver ? "Game Over" : "恭喜你到达终点"}</div>
      </div>
    </div>
  );
});
