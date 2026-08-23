export type NeuroViewSceneWorkPolicy = {
  denseGraph: boolean;
  collisionPasses: number;
};

export const resolveNeuroViewSceneWorkPolicy = (
  nodeCount: number,
  linkCount: number,
): NeuroViewSceneWorkPolicy => {
  const safeNodeCount = Math.max(0, nodeCount);
  const safeLinkCount = Math.max(0, linkCount);
  const denseGraph = safeNodeCount >= 720 || safeLinkCount >= 1_200;

  return {
    denseGraph,
    collisionPasses: denseGraph ? 1 : safeNodeCount >= 360 ? 2 : 3,
  };
};

export const shouldUseFullAmbientOcclusion = ({
  cameraMotion,
  denseGraph,
  physicsMoving,
  layoutTransitionActive,
}: {
  cameraMotion: boolean;
  denseGraph: boolean;
  physicsMoving: boolean;
  layoutTransitionActive: boolean;
}) => !cameraMotion && !(denseGraph && (physicsMoving || layoutTransitionActive));
