export const GRAPH_EDGE_BEND_SCALE = 0.4;

export type GraphEdgeEndpoint = {
  x: number;
  y: number;
};

export type GraphEdgeGeometry = {
  path: string;
  midX: number;
  midY: number;
  labelAngle: number;
};

const roundToTenth = (value: number) => Math.round(value * 10) / 10;

const formatPoint = (x: number, y: number) =>
  `${String(roundToTenth(x))} ${String(roundToTenth(y))}`;

const uprightAngle = (degrees: number) => {
  if (degrees > 90) {
    return degrees - 180;
  }

  return degrees <= -90 ? degrees + 180 : degrees;
};

export const buildGraphEdgeGeometry = (
  source: GraphEdgeEndpoint,
  target: GraphEdgeEndpoint,
  bend: number,
): GraphEdgeGeometry => {
  const deltaX = target.x - source.x;
  const deltaY = target.y - source.y;
  const distance = Math.hypot(deltaX, deltaY);
  const perpendicularX = distance === 0 ? 0 : -deltaY / distance;
  const perpendicularY = distance === 0 ? 0 : deltaX / distance;
  const offset = bend * distance * GRAPH_EDGE_BEND_SCALE;
  const controlX = (source.x + target.x) / 2 + perpendicularX * offset;
  const controlY = (source.y + target.y) / 2 + perpendicularY * offset;
  const firstHandleX = (source.x + controlX) / 2;
  const firstHandleY = (source.y + controlY) / 2;
  const secondHandleX = (controlX + target.x) / 2;
  const secondHandleY = (controlY + target.y) / 2;
  const midX = (firstHandleX + secondHandleX) / 2;
  const midY = (firstHandleY + secondHandleY) / 2;
  const tangentDegrees =
    (Math.atan2(secondHandleY - firstHandleY, secondHandleX - firstHandleX) *
      180) /
    Math.PI;
  const start = formatPoint(source.x, source.y);
  const middle = formatPoint(midX, midY);
  const end = formatPoint(target.x, target.y);
  const path =
    bend === 0
      ? `M ${start} L ${middle} L ${end}`
      : `M ${start} Q ${formatPoint(firstHandleX, firstHandleY)} ${middle} Q ${formatPoint(secondHandleX, secondHandleY)} ${end}`;

  return {
    path,
    midX: roundToTenth(midX),
    midY: roundToTenth(midY),
    labelAngle: roundToTenth(uprightAngle(tangentDegrees)),
  };
};
