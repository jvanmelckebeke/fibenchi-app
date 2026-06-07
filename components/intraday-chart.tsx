import { useWindowDimensions, View } from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';

interface IntradayChartProps {
  /** Close per minute for today. */
  points: number[];
  /** Prior session close — drawn as a dashed baseline. */
  previousClose: number;
  color: string;
  baselineColor: string;
  height?: number;
  /** Horizontal padding to subtract from screen width. */
  horizontalPadding?: number;
}

/** Today's trajectory: an intraday line with a dashed previous-close baseline. */
export function IntradayChart({
  points,
  previousClose,
  color,
  baselineColor,
  height = 180,
  horizontalPadding = 32,
}: IntradayChartProps) {
  const { width: screenWidth } = useWindowDimensions();
  const width = screenWidth - horizontalPadding;
  if (points.length < 2) return <View style={{ width, height }} />;

  const all = [...points, previousClose];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = max - min || 1;
  const x = (i: number) => (i / (points.length - 1)) * width;
  const y = (value: number) => height - ((value - min) / range) * height;

  const line = points.map((value, i) => `${x(i).toFixed(1)},${y(value).toFixed(1)}`).join(' ');
  const baseY = y(previousClose).toFixed(1);

  return (
    <Svg width={width} height={height}>
      <Line x1={0} y1={baseY} x2={width} y2={baseY} stroke={baselineColor} strokeWidth={1} strokeDasharray="4 4" />
      <Polyline points={line} fill="none" stroke={color} strokeWidth={2} />
    </Svg>
  );
}
