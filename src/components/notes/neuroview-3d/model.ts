import type { GraphLink, GraphNode } from "../graph/graph-types";

export type NeuroView3DFilter = "all" | "patients" | "recent" | "risk";

export type SpatialPoint = { x: number; y: number; z: number };

export type GraphSnapshot = {
  nodes: GraphNode[];
  links: GraphLink[];
};

export type ClinicalPath = {
  nodeIds: Set<string>;
  edgeIds: Set<string>;
};

const DAY_MS = 86_400_000;
const RECENT_WINDOW_MS = 30 * DAY_MS;

export const getGraphEndpointId = (endpoint: GraphLink["source"] | GraphLink["target"]) =>
  typeof endpoint === "string" ? endpoint : endpoint?.id;

export const getGraphEdgeId = (sourceId: string, targetId: string) =>
  sourceId < targetId ? `${sourceId}::${targetId}` : `${targetId}::${sourceId}`;

const hashNumber = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const hashUnit = (value: string, salt: string) =>
  (hashNumber(`${salt}:${value}`) % 10_000) / 10_000;

const vectorLength = (point: SpatialPoint) =>
  Math.hypot(point.x, point.y, point.z) || 1;

const normalizePoint = (point: SpatialPoint): SpatialPoint => {
  const length = vectorLength(point);
  return { x: point.x / length, y: point.y / length, z: point.z / length };
};

const multiplyPoint = (point: SpatialPoint, scalar: number): SpatialPoint => ({
  x: point.x * scalar,
  y: point.y * scalar,
  z: point.z * scalar,
});

const addPoint = (left: SpatialPoint, right: SpatialPoint): SpatialPoint => ({
  x: left.x + right.x,
  y: left.y + right.y,
  z: left.z + right.z,
});

const seededDirection = (id: string): SpatialPoint => {
  const theta = hashUnit(id, "theta") * Math.PI * 2;
  const z = hashUnit(id, "z") * 2 - 1;
  const radial = Math.sqrt(Math.max(0, 1 - z * z));
  return { x: Math.cos(theta) * radial, y: Math.sin(theta) * radial, z };
};

const directionNear = (base: SpatialPoint, id: string, spread: number) => {
  const jitter = seededDirection(id);
  return normalizePoint(addPoint(base, multiplyPoint(jitter, spread)));
};

export const buildAdjacency = (graph: GraphSnapshot) => {
  const adjacency = new Map<string, Array<{ id: string; edgeId: string }>>();
  graph.nodes.forEach((node) => adjacency.set(node.id, []));

  graph.links.forEach((link) => {
    const sourceId = getGraphEndpointId(link.source);
    const targetId = getGraphEndpointId(link.target);
    if (!sourceId || !targetId || !adjacency.has(sourceId) || !adjacency.has(targetId)) return;
    const edgeId = getGraphEdgeId(sourceId, targetId);
    adjacency.get(sourceId)?.push({ id: targetId, edgeId });
    adjacency.get(targetId)?.push({ id: sourceId, edgeId });
  });

  return adjacency;
};

export const getPatientSubgraphIds = (graph: GraphSnapshot, patientNodeId: string) => {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const patient = nodeById.get(patientNodeId);
  if (!patient || patient.type !== "patient") return new Set<string>();

  const patientId = String(patient.data?.id || patientNodeId.replace(/^pat-/, ""));
  const ids = new Set<string>([patientNodeId]);

  graph.nodes.forEach((node) => {
    if ((node.type === "note" || node.type === "flow") && String(node.data?.patient_id || "") === patientId) {
      ids.add(node.id);
    }
  });

  const adjacency = buildAdjacency(graph);
  adjacency.get(patientNodeId)?.forEach(({ id }) => {
    const neighbor = nodeById.get(id);
    if (neighbor?.type === "note" || neighbor?.type === "flow") ids.add(id);
  });

  Array.from(ids).forEach((id) => {
    const node = nodeById.get(id);
    if (node?.type !== "note" && node?.type !== "flow") return;
    adjacency.get(id)?.forEach(({ id: neighborId }) => {
      if (nodeById.get(neighborId)?.type === "tag") ids.add(neighborId);
    });
  });

  return ids;
};

export const findShortestClinicalPath = (
  graph: GraphSnapshot,
  startNodeId: string,
  targetPatientId?: string | null,
): ClinicalPath => {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  if (!nodeById.has(startNodeId)) return { nodeIds: new Set(), edgeIds: new Set() };

  const adjacency = buildAdjacency(graph);
  const allowedNodeIds = targetPatientId ? getPatientSubgraphIds(graph, targetPatientId) : null;
  const distances = new Map<string, number>([[startNodeId, 0]]);
  const predecessors = new Map<string, Array<{ id: string; edgeId: string }>>();
  const queue = [startNodeId];
  let minimumPatientDistance = Number.POSITIVE_INFINITY;
  const patients: string[] = [];

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const currentId = queue[cursor];
    const currentDistance = distances.get(currentId) ?? 0;
    if (currentDistance > minimumPatientDistance) break;

    const currentNode = nodeById.get(currentId);
    const isRequestedPatient = targetPatientId
      ? currentId === targetPatientId
      : currentNode?.type === "patient";

    if (isRequestedPatient) {
      if (currentDistance < minimumPatientDistance) {
        minimumPatientDistance = currentDistance;
        patients.length = 0;
      }
      patients.push(currentId);
      continue;
    }

    adjacency.get(currentId)?.forEach(({ id: neighborId, edgeId }) => {
      if (allowedNodeIds && !allowedNodeIds.has(neighborId)) return;
      const nextDistance = currentDistance + 1;
      const knownDistance = distances.get(neighborId);
      if (knownDistance === undefined) {
        distances.set(neighborId, nextDistance);
        predecessors.set(neighborId, [{ id: currentId, edgeId }]);
        queue.push(neighborId);
      } else if (knownDistance === nextDistance) {
        predecessors.get(neighborId)?.push({ id: currentId, edgeId });
      }
    });
  }

  if (!patients.length) return { nodeIds: new Set([startNodeId]), edgeIds: new Set() };

  const nodeIds = new Set<string>([startNodeId]);
  const edgeIds = new Set<string>();
  const visited = new Set<string>();
  const collect = (nodeId: string) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    nodeIds.add(nodeId);
    predecessors.get(nodeId)?.forEach((predecessor) => {
      edgeIds.add(predecessor.edgeId);
      collect(predecessor.id);
    });
  };
  patients.forEach(collect);

  return { nodeIds, edgeIds };
};

const timestampForNode = (node: GraphNode) => {
  if (node.type !== "note" && node.type !== "flow") return null;
  const value = node.data?.updated_at || node.data?.created_at;
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : null;
};

const riskScaleForPatient = (node: GraphNode) => {
  const score = Number(node.data?.risk_score);
  const explicitScale = Number(node.data?.risk_score_scale);
  if (explicitScale === 10 || explicitScale === 100) return explicitScale;
  return Number.isFinite(score) && score > 10 ? 100 : 10;
};

export const isRecordedRiskPatient = (node: GraphNode) => {
  if (node.type !== "patient" || node.data?.risk_score === null || node.data?.risk_score === undefined) return false;
  const score = Number(node.data.risk_score);
  if (!Number.isFinite(score)) return false;
  return score >= riskScaleForPatient(node) * 0.4;
};

const addArtifactsAndTagsForPatients = (
  graph: GraphSnapshot,
  patientNodeIds: Set<string>,
) => {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const included = new Set(patientNodeIds);
  const patientIds = new Set(
    Array.from(patientNodeIds).map((nodeId) => String(nodeById.get(nodeId)?.data?.id || nodeId.replace(/^pat-/, ""))),
  );

  graph.nodes.forEach((node) => {
    if ((node.type === "note" || node.type === "flow") && patientIds.has(String(node.data?.patient_id || ""))) {
      included.add(node.id);
    }
  });

  const adjacency = buildAdjacency(graph);
  Array.from(included).forEach((id) => {
    const node = nodeById.get(id);
    if (node?.type !== "note" && node?.type !== "flow") return;
    adjacency.get(id)?.forEach(({ id: neighborId }) => {
      if (nodeById.get(neighborId)?.type === "tag") included.add(neighborId);
    });
  });

  return included;
};

export const getVisibleNodeIds = (
  graph: GraphSnapshot,
  filter: NeuroView3DFilter,
  now = Date.now(),
) => {
  if (filter === "all") return new Set(graph.nodes.map((node) => node.id));
  if (filter === "patients") {
    return new Set(graph.nodes.filter((node) => node.type === "patient").map((node) => node.id));
  }

  if (filter === "risk") {
    const patientIds = new Set(
      graph.nodes.filter(isRecordedRiskPatient).map((node) => node.id),
    );
    return addArtifactsAndTagsForPatients(graph, patientIds);
  }

  const recentArtifacts = new Set(
    graph.nodes
      .filter((node) => {
        const timestamp = timestampForNode(node);
        return timestamp !== null && now - timestamp >= 0 && now - timestamp <= RECENT_WINDOW_MS;
      })
      .map((node) => node.id),
  );
  const included = new Set(recentArtifacts);
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const adjacency = buildAdjacency(graph);

  recentArtifacts.forEach((artifactId) => {
    const artifact = nodeById.get(artifactId);
    const patientId = String(artifact?.data?.patient_id || "");
    if (patientId && nodeById.has(`pat-${patientId}`)) included.add(`pat-${patientId}`);
    adjacency.get(artifactId)?.forEach(({ id }) => {
      if (nodeById.get(id)?.type === "tag") included.add(id);
    });
  });

  return included;
};

export const getActivityIntensity = (graph: GraphSnapshot, now = Date.now()) => {
  const timestamps = new Map<string, number>();
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const adjacency = buildAdjacency(graph);

  graph.nodes.forEach((node) => {
    const timestamp = timestampForNode(node);
    if (timestamp !== null) timestamps.set(node.id, timestamp);
  });

  graph.nodes.forEach((node) => {
    if (node.type !== "patient" && node.type !== "tag") return;
    const connectedTimestamps = (adjacency.get(node.id) || [])
      .map(({ id }) => timestamps.get(id))
      .filter((value): value is number => value !== undefined);
    if (connectedTimestamps.length) timestamps.set(node.id, Math.max(...connectedTimestamps));
  });

  return new Map(
    graph.nodes.map((node) => {
      const timestamp = timestamps.get(node.id);
      if (timestamp === undefined) return [node.id, 0.28] as const;
      const ageDays = Math.max(0, (now - timestamp) / DAY_MS);
      return [node.id, ageDays <= 7 ? 1 : ageDays <= 30 ? 0.62 : 0.28] as const;
    }),
  );
};

const relatedPatientDirection = (
  node: GraphNode,
  patientDirections: Map<string, SpatialPoint>,
  adjacency: ReturnType<typeof buildAdjacency>,
  nodeById: Map<string, GraphNode>,
) => {
  const patientId = String(node.data?.patient_id || "");
  if (patientId && patientDirections.has(`pat-${patientId}`)) return patientDirections.get(`pat-${patientId}`);
  const directPatient = adjacency.get(node.id)?.find(({ id }) => nodeById.get(id)?.type === "patient");
  return directPatient ? patientDirections.get(directPatient.id) : undefined;
};

export const computeSpatialLayout = (graph: GraphSnapshot) => {
  const panorama = new Map<string, SpatialPoint>();
  const flat = new Map<string, SpatialPoint>();
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const adjacency = buildAdjacency(graph);
  const maxFlatExtent = Math.max(
    1,
    ...graph.nodes.flatMap((node) => [Math.abs(Number(node.x) || 0), Math.abs(Number(node.y) || 0)]),
  );

  graph.nodes.forEach((node) => {
    flat.set(node.id, {
      x: ((Number(node.x) || 0) / maxFlatExtent) * 32,
      y: (-(Number(node.y) || 0) / maxFlatExtent) * 32,
      z: 0,
    });
  });

  const patientDirections = new Map<string, SpatialPoint>();
  graph.nodes.filter((node) => node.type === "patient").forEach((node) => {
    const flatPoint = flat.get(node.id) || { x: 0, y: 0, z: 0 };
    const direction = normalizePoint({
      x: flatPoint.x || seededDirection(node.id).x,
      y: flatPoint.y || seededDirection(node.id).y,
      z: (hashUnit(node.id, "patient-z") - 0.5) * 7,
    });
    patientDirections.set(node.id, direction);
    panorama.set(node.id, multiplyPoint(direction, 8));
  });

  graph.nodes.filter((node) => node.type === "flow" || node.type === "note").forEach((node) => {
    const patientDirection = relatedPatientDirection(node, patientDirections, adjacency, nodeById) || seededDirection(node.id);
    const radius = node.type === "flow" ? 19 : 30;
    panorama.set(node.id, multiplyPoint(directionNear(patientDirection, node.id, node.type === "flow" ? 0.42 : 0.68), radius));
  });

  graph.nodes.filter((node) => node.type === "tag").forEach((node) => {
    const connectedPoints = (adjacency.get(node.id) || [])
      .map(({ id }) => panorama.get(id))
      .filter((point): point is SpatialPoint => Boolean(point));
    const average = connectedPoints.reduce(addPoint, { x: 0, y: 0, z: 0 });
    const direction = connectedPoints.length
      ? directionNear(normalizePoint(average), node.id, 0.28)
      : seededDirection(node.id);
    panorama.set(node.id, multiplyPoint(direction, 43));
  });

  graph.nodes.forEach((node) => {
    if (!panorama.has(node.id)) panorama.set(node.id, multiplyPoint(seededDirection(node.id), 34));
  });

  return { flat, panorama };
};

export const computeFocusedLayout = (
  graph: GraphSnapshot,
  panorama: Map<string, SpatialPoint>,
  patientNodeId: string,
) => {
  const focused = new Map<string, SpatialPoint>();
  const subgraphIds = getPatientSubgraphIds(graph, patientNodeId);
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));

  graph.nodes.forEach((node) => {
    if (node.id === patientNodeId) {
      focused.set(node.id, { x: 0, y: 0, z: 0 });
      return;
    }
    if (subgraphIds.has(node.id)) {
      const radius = node.type === "flow" ? 9 : node.type === "note" ? 15 : 22;
      focused.set(node.id, multiplyPoint(seededDirection(`${patientNodeId}:${node.id}`), radius));
      return;
    }
    const base = panorama.get(node.id) || seededDirection(node.id);
    const direction = normalizePoint(base);
    const distance = nodeById.get(node.id)?.type === "patient" ? 68 : 78;
    focused.set(node.id, multiplyPoint(direction, distance));
  });

  return { positions: focused, subgraphIds };
};
