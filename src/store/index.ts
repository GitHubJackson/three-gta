import { makeAutoObservable } from "mobx";

class VehicleStore {
  score = 0;
  setScore(score?: number) {
    this.score = score ?? 0;
  }
  isStop = false;
  trigger() {
    this.isStop = !this.isStop;
  }
  stop() {
    this.isStop = true;
  }

  // 游戏判断
  isSuccess = false;
  isGameOver = false;

  constructor() {
    makeAutoObservable(this);
  }
}

export const vehicleStore = new VehicleStore();
