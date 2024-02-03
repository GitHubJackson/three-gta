/* eslint-disable @typescript-eslint/no-unused-vars */
import { ESlideDirection } from "../types/enum";

// 计算划过的角度
export function getAngle(angx: number, angy: number) {
  return (Math.atan2(angy, angx) * 180) / Math.PI;
}
// 计算触屏方向
export function getDirection(
  startx: number,
  starty: number,
  endx: number,
  endy: number
): ESlideDirection {
  const angx = endx - startx;
  const angy = endy - starty;
  let result = ESlideDirection.None;
  if (Math.abs(angx) < 2 && Math.abs(angy) < 2) {
    return result;
  }
  const angle = getAngle(angx, angy);
  if (angle >= -135 && angle <= -45) {
    result = ESlideDirection.Top;
  } else if (angle > 45 && angle < 135) {
    result = ESlideDirection.Bottom;
  } else if (
    (angle >= 135 && angle <= 180) ||
    (angle >= -180 && angle < -135)
  ) {
    result = ESlideDirection.Left;
  } else if (angle >= -45 && angle <= 45) {
    result = ESlideDirection.Right;
  }
  return result;
}

export function getScore(
  origin: number[],
  vehiclePos: number[],
  vehicleQuaternion: number[]
) {
  let score = 0;
  const [originX, originY, originZ] = origin;
  const [vehiclePosX, vehiclePosY, vehiclePosZ] = vehiclePos;
  const [vehicleQuaternionX, vehicleQuaternionY, vehicleQuaternionZ] =
    vehicleQuaternion;
  // console.log("===origin", origin, vehiclePos);
  if (
    Math.abs(vehiclePosX - originX) > 1.5 ||
    Math.abs(vehiclePosZ - originZ) > 3 ||
    vehicleQuaternionY < 0
  ) {
    return 0;
  }
  score =
    50 +
    (Math.abs(vehiclePosX - originX) / 1.5) * 30 +
    (Math.abs(vehiclePosZ - originZ) / 3) * 30;
  score = score > 80 ? 80 : score;
  // 小于0说明没倒车
  if (vehicleQuaternionY > 0) {
    // 在π/2之内，值越大说明偏转越大，分数越小
    score += (Math.abs(Math.atan(vehicleQuaternionY)) / (Math.PI / 2)) * 20;
  }
  return parseInt(score + "");
}
