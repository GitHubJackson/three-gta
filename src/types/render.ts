// 线条参数
export interface ILineInfo {
  // 宽度
  width: number;
  // 起始位置
  pos: number[];
  // 默认白色
  color?: string;
  // 是否虚线，默认实线
  dash?: boolean;
  // 虚线间隔，默认2
  dashOffset?: number;
  // 虚线段数，默认10段
  dashNum?: number;
}
