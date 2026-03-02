import React, { useMemo } from 'react';
import Svg, { Polyline, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

interface Props {
  data: number[];
  width: number;
  height: number;
  positive: boolean; // 수익이면 true, 손실이면 false
}

export default function SparklineChart({ data, width, height, positive }: Props) {
  const points = useMemo(() => {
    if (data.length < 2) return '';

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padV = height * 0.1;
    const padH = 2;
    const usableW = width - padH * 2;
    const usableH = height - padV * 2;

    return data
      .map((v, i) => {
        const x = padH + (i / (data.length - 1)) * usableW;
        const y = padV + (1 - (v - min) / range) * usableH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [data, width, height]);

  const color = positive ? '#00FFA3' : '#FF006B';

  if (!points) return null;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={`grad_${positive ? 'p' : 'n'}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.25} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
