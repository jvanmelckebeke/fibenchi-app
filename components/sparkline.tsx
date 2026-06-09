import { useMemo } from 'react';
import { View } from 'react-native';
import { Canvas, LinearGradient, Path, Skia, vec } from '@shopify/react-native-skia';

import { skiaColor } from '@/lib/theme';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  /** Stroke + gradient hue — typically a finance gain/loss colour. */
  color: string;
}

/**
 * Minimal sparkline (no axes) — the shape of a series — drawn on Skia: a stroked
 * line over a gradient area fill that fades to transparent, matching Fibenchi
 * web's area sparkline. A bare Skia `Path` (not a full chart) is light enough to
 * render once per list row. Same public props as the prior SVG version.
 */
export function Sparkline({ data, width = 92, height = 32, color }: SparklineProps) {
  const paths = useMemo(() => {
    if (data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const stepX = width / (data.length - 1);
    const yAt = (value: number) => height - ((value - min) / range) * height;

    const line = Skia.Path.Make();
    line.moveTo(0, yAt(data[0]));
    for (let i = 1; i < data.length; i++) {
      line.lineTo(i * stepX, yAt(data[i]));
    }

    // Area = the line closed down to the baseline, so the gradient has a region to fill.
    const area = line.copy();
    area.lineTo(width, height);
    area.lineTo(0, height);
    area.close();

    return { line, area };
  }, [data, width, height]);

  if (!paths) return <View style={{ width, height }} />;

  // Skia's CSS parser needs comma-separated hsl(); our theme uses spaces.
  const stroke = skiaColor(color);

  return (
    <Canvas style={{ width, height }}>
      <Path path={paths.area} opacity={0.18}>
        <LinearGradient start={vec(0, 0)} end={vec(0, height)} colors={[stroke, 'transparent']} />
      </Path>
      <Path
        path={paths.line}
        style="stroke"
        strokeWidth={1.5}
        strokeJoin="round"
        strokeCap="round"
        color={stroke}
      />
    </Canvas>
  );
}
