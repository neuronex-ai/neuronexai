import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";

import type { NeuroViewLens, NeuroViewTimeWindow } from "../clinical-evidence/evidence-types";
import type { GraphNode } from "../graph/graph-types";
import {
  computeFocusedLayout,
  computeSpatialLayout,
  findShortestClinicalPath,
  getActivityIntensity,
  getGraphEdgeId,
  getGraphEndpointId,
  getPatientSubgraphIds,
  getNodeEvidence,
  getVisibleNodeIds,
  type GraphSnapshot,
  type NeuroView3DFilter,
  type SpatialPoint,
} from "./model";

export type NeuroViewSceneProfile = "full" | "light";

export type NeuroViewDynamicsSettings = {
  centralGravity: number;
  elasticity: number;
  connectionDistance: number;
};

export const DEFAULT_NEUROVIEW_DYNAMICS: NeuroViewDynamicsSettings = {
  centralGravity: 32,
  elasticity: 58,
  connectionDistance: 50,
};

type SceneOptions = {
  container: HTMLDivElement;
  graph: GraphSnapshot;
  darkMode: boolean;
  profile: NeuroViewSceneProfile;
  reducedMotion: boolean;
  emphasizedNodeIds?: ReadonlySet<string>;
  onHoverNode: (nodeId: string | null) => void;
  onActivateNode: (node: GraphNode) => void;
  onSceneError: (message: string) => void;
};

export type NeuroViewSceneController = {
  setView: (filter: NeuroView3DFilter, focusedPatientId: string | null, darkMode: boolean) => void;
  setHighlight: (nodeId: string | null) => void;
  setDynamics: (settings: NeuroViewDynamicsSettings) => void;
  resetDynamics: () => void;
  resetCamera: () => void;
  focusNode: (nodeId: string) => void;
  setLens: (lens: NeuroViewLens) => void;
  setTimeWindow: (window: NeuroViewTimeWindow) => void;
  dispose: () => void;
};

type NodeRecord = {
  node: GraphNode;
  current: THREE.Vector3;
  start: THREE.Vector3;
  target: THREE.Vector3;
  currentScale: number;
  startScale: number;
  targetScale: number;
  currentBrightness: number;
  startBrightness: number;
  targetBrightness: number;
  velocity: THREE.Vector3;
  pinned: boolean;
  label: CSS2DObject;
};

type MeshGroup = {
  ids: string[];
  mesh: THREE.InstancedMesh;
  halo: THREE.InstancedMesh;
  hit: THREE.InstancedMesh;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial;
  haloMaterial: THREE.MeshBasicMaterial;
};

const PANORAMA_CAMERA = new THREE.Vector3(0, 7, 116);
const PANORAMA_TARGET = new THREE.Vector3(0, 0, 0);

const baseNodeScale = (node: GraphNode, darkMode: boolean) => {
  const darkModeReduction = darkMode ? 0.828 : 1;
  if (node.type === "patient") return 1.9 * darkModeReduction;
  if (node.type === "flow") return 1.24 * darkModeReduction;
  if (node.type === "note") return 0.96 * darkModeReduction;
  if (node.type === "evidence") return 0.76 * darkModeReduction;
  return 0.59 * darkModeReduction;
};

const nodeColor = (node: GraphNode, darkMode: boolean) => {
  if (darkMode) {
    if (node.type === "patient") return new THREE.Color("#f5f5f7");
    if (node.type === "flow") return new THREE.Color("#75d8f5");
    if (node.type === "note") return new THREE.Color("#bbb8b5");
    if (node.type === "evidence") return new THREE.Color("#c9bcff");
    return new THREE.Color("#86818b");
  }
  if (node.type === "patient") return new THREE.Color("#202027");
  if (node.type === "flow") return new THREE.Color("#087f9e");
  if (node.type === "note") return new THREE.Color("#625e66");
  if (node.type === "evidence") return new THREE.Color("#6653a6");
  return new THREE.Color("#8a8179");
};

const backgroundColor = (darkMode: boolean) => new THREE.Color(darkMode ? "#070709" : "#f3f1ec");

const easeInOutCubic = (value: number) =>
  value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;

const pointToVector = (point: SpatialPoint) => new THREE.Vector3(point.x, point.y, point.z);

const clampDynamics = (settings: NeuroViewDynamicsSettings): NeuroViewDynamicsSettings => ({
  centralGravity: THREE.MathUtils.clamp(settings.centralGravity, 0, 100),
  elasticity: THREE.MathUtils.clamp(settings.elasticity, 0, 100),
  connectionDistance: THREE.MathUtils.clamp(settings.connectionDistance, 0, 100),
});

const connectionDistanceScale = (value: number) => 0.55 + THREE.MathUtils.clamp(value, 0, 100) * 0.009;

const organicSeed = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10_000) / 10_000;
};

type EdgeRecord = {
  sourceId: string;
  targetId: string;
  edgeId: string;
  bend: number;
  twist: number;
  bundleKey: string | null;
  patientNodeId: string | null;
};

const makeGeometry = (type: GraphNode["type"], profile: NeuroViewSceneProfile) => {
  const detail = profile === "full" ? 3 : 2;
  if (type === "flow") return new THREE.OctahedronGeometry(1, profile === "full" ? 2 : 1);
  if (type === "note") return new THREE.IcosahedronGeometry(1, detail);
  if (type === "evidence") return new THREE.DodecahedronGeometry(1, profile === "full" ? 2 : 1);
  if (type === "tag") return new THREE.SphereGeometry(1, profile === "full" ? 18 : 12, profile === "full" ? 12 : 8);
  return new THREE.SphereGeometry(1, profile === "full" ? 36 : 22, profile === "full" ? 24 : 14);
};

const makeLabel = (node: GraphNode, darkMode: boolean) => {
  const element = document.createElement("span");
  element.className = [
    "pointer-events-none select-none whitespace-nowrap rounded-full border px-2.5 py-1",
    "text-[10px] font-semibold tracking-[-0.01em] shadow-sm backdrop-blur-xl transition-opacity duration-200",
  ].join(" ");
  element.textContent = node.label || "Sem título";
  element.dataset.nodeType = node.type;
  element.style.borderColor = darkMode ? "rgba(255,255,255,0.12)" : "rgba(22,22,29,0.1)";
  element.style.background = darkMode ? "rgba(17,17,20,0.78)" : "rgba(255,255,255,0.78)";
  element.style.color = darkMode ? "rgba(250,250,252,0.9)" : "rgba(25,25,31,0.88)";
  element.style.opacity = "0";
  const label = new CSS2DObject(element);
  label.center.set(0.5, -0.45);
  return label;
};

const updateLabelTheme = (record: NodeRecord, darkMode: boolean) => {
  const element = record.label.element;
  element.style.borderColor = darkMode ? "rgba(255,255,255,0.12)" : "rgba(22,22,29,0.1)";
  element.style.background = darkMode ? "rgba(17,17,20,0.78)" : "rgba(255,255,255,0.8)";
  element.style.color = darkMode ? "rgba(250,250,252,0.9)" : "rgba(25,25,31,0.88)";
};

export const createNeuroViewScene = (options: SceneOptions): NeuroViewSceneController => {
  const {
    container,
    graph,
    profile,
    reducedMotion,
    onHoverNode,
    onActivateNode,
    onSceneError,
  } = options;
  let darkMode = options.darkMode;
  let lens: NeuroViewLens = "panorama";
  let timeWindow: NeuroViewTimeWindow = {};
  let disposed = false;
  let filter: NeuroView3DFilter = "all";
  let focusedPatientId: string | null = null;
  let highlightedNodeId: string | null = null;
  let highlightedNodeIds = new Set<string>(options.emphasizedNodeIds || []);
  let highlightedEdgeIds = new Set<string>();
  let visibleNodeIds = getVisibleNodeIds(graph, filter);
  let focusedSubgraphIds = new Set<string>();
  let transitionStartedAt = performance.now();
  let transitionDuration = reducedMotion ? 120 : 900;
  let frameId = 0;
  let animationUntil = transitionStartedAt + transitionDuration;
  let renderRequested = false;
  let hoveredNodeId: string | null = null;
  let pointerStart: { x: number; y: number } | null = null;
  let draggedNodeId: string | null = null;
  let dragMoved = false;
  let dynamics = { ...DEFAULT_NEUROVIEW_DYNAMICS };
  let activeLayoutPositions = new Map<string, SpatialPoint>();
  let layoutTransitionActive = true;
  let physicsActive = false;
  let physicsLastAt = performance.now();
  let settledPhysicsFrames = 0;
  let savedPanoramaCamera = PANORAMA_CAMERA.clone();
  let savedPanoramaTarget = PANORAMA_TARGET.clone();

  const layout = computeSpatialLayout(graph);
  const activity = getActivityIntensity(graph);
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const records = new Map<string, NodeRecord>();
  const groups = new Map<GraphNode["type"], MeshGroup>();
  const meshLookup = new Map<THREE.InstancedMesh, string[]>();
  const hitGeometry = new THREE.SphereGeometry(1, 10, 8);
  const hitMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false,
  });
  const dummy = new THREE.Object3D();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(2, 2);
  const dragPlane = new THREE.Plane();
  const dragHit = new THREE.Vector3();
  const dragOffset = new THREE.Vector3();
  const cameraDirection = new THREE.Vector3();
  const edgeDirection = new THREE.Vector3();
  const edgeNormal = new THREE.Vector3();
  const edgeBinormal = new THREE.Vector3();
  const edgeControlA = new THREE.Vector3();
  const edgeControlB = new THREE.Vector3();
  const edgePointA = new THREE.Vector3();
  const edgePointB = new THREE.Vector3();
  const edgeBundleAnchor = new THREE.Vector3();

  const scene = new THREE.Scene();
  scene.background = null;
  scene.fog = new THREE.FogExp2(backgroundColor(darkMode), darkMode ? 0.0058 : 0.0042);

  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 320);
  camera.position.copy(PANORAMA_CAMERA);

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: profile === "full",
      alpha: true,
      powerPreference: profile === "full" ? "high-performance" : "low-power",
    });
  } catch (error) {
    onSceneError(error instanceof Error ? error.message : "WebGL indisponível.");
    throw error;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, profile === "full" ? 1.75 : 1.1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = darkMode ? 1.18 : 0.94;
  renderer.setClearColor(backgroundColor(darkMode), 0);
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.tabIndex = -1;
  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.inset = "0";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.touchAction = "none";
  container.appendChild(renderer.domElement);
  const handleContextLost = (event: Event) => {
    event.preventDefault();
    if (!disposed) onSceneError("O contexto gráfico foi interrompido. A visualização plana continua disponível.");
  };
  renderer.domElement.addEventListener("webglcontextlost", handleContextLost);

  const labelsRenderer = new CSS2DRenderer();
  labelsRenderer.domElement.setAttribute("aria-hidden", "true");
  labelsRenderer.domElement.style.position = "absolute";
  labelsRenderer.domElement.style.inset = "0";
  labelsRenderer.domElement.style.pointerEvents = "none";
  labelsRenderer.domElement.style.overflow = "hidden";
  container.appendChild(labelsRenderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !reducedMotion;
  controls.dampingFactor = 0.085;
  controls.enablePan = false;
  controls.minDistance = 20;
  controls.maxDistance = 145;
  controls.rotateSpeed = 0.58;
  controls.zoomSpeed = 0.72;
  controls.target.copy(PANORAMA_TARGET);
  controls.update();

  const hemisphere = new THREE.HemisphereLight(darkMode ? 0xe9f5ff : 0xffffff, darkMode ? 0x101018 : 0xc8c1b8, darkMode ? 2.15 : 2.5);
  const keyLight = new THREE.DirectionalLight(darkMode ? 0xd9efff : 0xffffff, darkMode ? 4.2 : 4.8);
  keyLight.position.set(-26, 32, 38);
  const rimLight = new THREE.PointLight(darkMode ? 0x6dcff0 : 0x77b7c9, darkMode ? 68 : 38, 150, 2);
  rimLight.position.set(30, -12, 32);
  scene.add(hemisphere, keyLight, rimLight);

  let environmentTarget: THREE.WebGLRenderTarget | null = null;
  if (profile === "full") {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnvironment = new RoomEnvironment();
    environmentTarget = pmrem.fromScene(roomEnvironment, 0.04);
    scene.environment = environmentTarget.texture;
    roomEnvironment.dispose();
    pmrem.dispose();
  }

  const groupsByType = new Map<GraphNode["type"], GraphNode[]>();
  graph.nodes.forEach((node) => {
    const list = groupsByType.get(node.type) || [];
    list.push(node);
    groupsByType.set(node.type, list);

    const initial = pointToVector(layout.flat.get(node.id) || { x: 0, y: 0, z: 0 });
    const label = makeLabel(node, darkMode);
    label.position.copy(initial);
    scene.add(label);
    records.set(node.id, {
      node,
      current: initial.clone(),
      start: initial.clone(),
      target: pointToVector(layout.panorama.get(node.id) || { x: 0, y: 0, z: 0 }),
      currentScale: 0.04,
      startScale: 0.04,
      targetScale: baseNodeScale(node, darkMode),
      currentBrightness: 0,
      startBrightness: 0,
      targetBrightness: activity.get(node.id) || 0.28,
      velocity: new THREE.Vector3(),
      pinned: Boolean(getNodeEvidence(node)?.pinned),
      label,
    });
  });
  activeLayoutPositions = layout.panorama;

  groupsByType.forEach((nodes, type) => {
    const geometry = makeGeometry(type, profile);
    const material = type === "patient"
      ? new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          vertexColors: true,
          roughness: darkMode ? 0.2 : 0.34,
          metalness: darkMode ? 0.16 : 0.05,
          clearcoat: 1,
          clearcoatRoughness: 0.18,
        })
      : new THREE.MeshStandardMaterial({
          color: 0xffffff,
          vertexColors: true,
          roughness: type === "flow" ? 0.28 : 0.48,
          metalness: type === "flow" ? 0.2 : 0.04,
        });
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
      transparent: true,
      opacity: darkMode ? 0.16 : 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, nodes.length);
    const halo = new THREE.InstancedMesh(geometry, haloMaterial, nodes.length);
    const hit = new THREE.InstancedMesh(hitGeometry, hitMaterial, nodes.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    halo.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    hit.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    halo.frustumCulled = false;
    hit.frustumCulled = false;
    halo.raycast = () => undefined;
    const ids = nodes.map((node) => node.id);
    groups.set(type, { ids, mesh, halo, hit, geometry, material, haloMaterial });
    meshLookup.set(hit, ids);
    scene.add(halo, mesh, hit);
  });

  const attentionHaloColors: Record<string, number> = {
    "recorded-risk": 0xfb7185,
    "overdue-action": 0xfcd34d,
    "pending-review": 0xc4b5fd,
    "observed-mood-change": 0x67e8f9,
  };
  const attentionHalos = graph.nodes
    .filter((node) => node.type === "patient" && Array.isArray(node.data?.attentionReasons) && node.data.attentionReasons.length)
    .map((node) => {
      const group = new THREE.Group();
      const reasons = (node.data.attentionReasons as Array<{ type: string }>).slice(0, 4);
      const geometries: THREE.RingGeometry[] = [];
      const materials: THREE.MeshBasicMaterial[] = [];
      reasons.forEach((reason, index) => {
        const start = index * (Math.PI * 2 / reasons.length) + 0.08;
        const length = Math.PI * 2 / reasons.length - 0.16;
        const geometry = new THREE.RingGeometry(2.52, 2.64, 28, 1, start, length);
        const material = new THREE.MeshBasicMaterial({
          color: attentionHaloColors[reason.type] || 0xffffff,
          transparent: true,
          opacity: darkMode ? 0.74 : 0.62,
          depthTest: false,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.renderOrder = 5;
        group.add(mesh);
        geometries.push(geometry);
        materials.push(material);
      });
      scene.add(group);
      return { nodeId: node.id, group, geometries, materials };
    });

  const edgeRecords = graph.links.flatMap<EdgeRecord>((link) => {
    const sourceId = getGraphEndpointId(link.source);
    const targetId = getGraphEndpointId(link.target);
    if (!sourceId || !targetId) return [];
    const key = getGraphEdgeId(sourceId, targetId);
    const sourceNode = nodeById.get(sourceId);
    const targetNode = nodeById.get(targetId);
    const patientNode = sourceNode?.type === "patient" ? sourceNode : targetNode?.type === "patient" ? targetNode : null;
    const artifactNode = sourceNode?.type === "patient" ? targetNode : targetNode?.type === "patient" ? sourceNode : null;
    const evidence = artifactNode ? getNodeEvidence(artifactNode) : null;
    const theme = evidence?.theme || (Array.isArray(artifactNode?.data?.tags) ? artifactNode?.data?.tags[0] : null);
    return [{
      sourceId,
      targetId,
      edgeId: key,
      bend: organicSeed(`${key}:bend`) * 2 - 1,
      twist: organicSeed(`${key}:twist`) * 2 - 1,
      bundleKey: patientNode && theme ? `${patientNode.id}:${theme}` : null,
      patientNodeId: patientNode?.id || null,
    }];
  });
  const edgeSegmentCount = profile === "full" ? 10 : 6;
  const edgeArrayLength = edgeRecords.length * edgeSegmentCount * 6;
  const inactiveEdgePositions = new Float32Array(edgeArrayLength);
  const inactiveEdgeColors = new Float32Array(edgeArrayLength);
  const activeEdgePositions = new Float32Array(edgeArrayLength);
  const activeEdgeColors = new Float32Array(edgeArrayLength);
  const inactiveEdgeGeometry = new LineSegmentsGeometry();
  inactiveEdgeGeometry.setPositions(inactiveEdgePositions);
  inactiveEdgeGeometry.setColors(inactiveEdgeColors);
  const inactiveEdgeMaterial = new LineMaterial({
    color: 0xffffff,
    vertexColors: true,
    linewidth: 0.68,
    transparent: true,
    opacity: 1,
    alphaToCoverage: true,
    blending: darkMode ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: false,
  });
  const inactiveEdgeLines = new LineSegments2(inactiveEdgeGeometry, inactiveEdgeMaterial);
  inactiveEdgeLines.frustumCulled = false;
  inactiveEdgeLines.renderOrder = -2;

  const activeEdgeGeometry = new THREE.BufferGeometry();
  activeEdgeGeometry.setAttribute("position", new THREE.BufferAttribute(activeEdgePositions, 3));
  activeEdgeGeometry.setAttribute("color", new THREE.BufferAttribute(activeEdgeColors, 3));
  const activeEdgeMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: darkMode ? 0.88 : 0.72,
    blending: darkMode ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: false,
  });
  const activeEdgeGlowMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: darkMode ? 0.3 : 0.12,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const activeEdgeLines = new THREE.LineSegments(activeEdgeGeometry, activeEdgeMaterial);
  const activeEdgeGlowLines = new THREE.LineSegments(activeEdgeGeometry, activeEdgeGlowMaterial);
  activeEdgeLines.frustumCulled = false;
  activeEdgeGlowLines.frustumCulled = false;
  activeEdgeGlowLines.renderOrder = -1;
  scene.add(inactiveEdgeLines, activeEdgeGlowLines, activeEdgeLines);

  let composer: EffectComposer | null = null;
  let bloom: UnrealBloomPass | null = null;
  if (profile === "full") {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), darkMode ? 0.34 : 0.11, 0.55, 0.86);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  const cameraTween = {
    active: false,
    startedAt: 0,
    duration: 0,
    fromPosition: camera.position.clone(),
    toPosition: camera.position.clone(),
    fromTarget: controls.target.clone(),
    toTarget: controls.target.clone(),
  };

  const updateCameraTween = (now: number) => {
    if (!cameraTween.active) return false;
    const progress = Math.min(1, (now - cameraTween.startedAt) / Math.max(1, cameraTween.duration));
    const eased = easeInOutCubic(progress);
    camera.position.lerpVectors(cameraTween.fromPosition, cameraTween.toPosition, eased);
    controls.target.lerpVectors(cameraTween.fromTarget, cameraTween.toTarget, eased);
    if (progress >= 1) cameraTween.active = false;
    return true;
  };

  const beginCameraTween = (position: THREE.Vector3, target: THREE.Vector3, duration: number) => {
    cameraTween.active = duration > 0;
    cameraTween.startedAt = performance.now();
    cameraTween.duration = Math.max(1, duration);
    cameraTween.fromPosition.copy(camera.position);
    cameraTween.toPosition.copy(position);
    cameraTween.fromTarget.copy(controls.target);
    cameraTween.toTarget.copy(target);
    if (!cameraTween.active) {
      camera.position.copy(position);
      controls.target.copy(target);
      controls.update();
    }
    animationUntil = Math.max(animationUntil, cameraTween.startedAt + duration + 32);
  };

  const updateSceneTheme = () => {
    const background = backgroundColor(darkMode);
    scene.background = null;
    renderer.setClearColor(background, 0);
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.copy(background);
      scene.fog.density = darkMode ? 0.0058 : 0.0042;
    }
    renderer.toneMappingExposure = darkMode ? 1.18 : 0.94;
    hemisphere.color.set(darkMode ? 0xe9f5ff : 0xffffff);
    hemisphere.groundColor.set(darkMode ? 0x101018 : 0xc8c1b8);
    hemisphere.intensity = darkMode ? 2.15 : 2.5;
    keyLight.color.set(darkMode ? 0xd9efff : 0xffffff);
    keyLight.intensity = darkMode ? 4.2 : 4.8;
    rimLight.color.set(darkMode ? 0x6dcff0 : 0x77b7c9);
    rimLight.intensity = darkMode ? 68 : 38;
    inactiveEdgeMaterial.linewidth = darkMode ? 0.68 : 1;
    inactiveEdgeMaterial.opacity = darkMode ? 1 : 0.72;
    inactiveEdgeMaterial.blending = darkMode ? THREE.AdditiveBlending : THREE.NormalBlending;
    inactiveEdgeMaterial.needsUpdate = true;
    activeEdgeMaterial.opacity = darkMode ? 0.88 : 0.72;
    activeEdgeMaterial.blending = darkMode ? THREE.AdditiveBlending : THREE.NormalBlending;
    activeEdgeMaterial.needsUpdate = true;
    activeEdgeGlowMaterial.opacity = darkMode ? 0.3 : 0.12;
    if (bloom) bloom.strength = darkMode ? 0.34 : 0.11;
    groups.forEach((group) => {
      group.haloMaterial.opacity = darkMode ? 0.16 : 0.08;
      if (group.material instanceof THREE.MeshPhysicalMaterial) {
        group.material.roughness = darkMode ? 0.2 : 0.34;
        group.material.metalness = darkMode ? 0.16 : 0.05;
      }
    });
    attentionHalos.forEach((halo) => halo.materials.forEach((material) => {
      material.opacity = darkMode ? 0.74 : 0.62;
    }));
    records.forEach((record) => updateLabelTheme(record, darkMode));
  };

  const getStateVisibleNodeIds = () => {
    const ids = getVisibleNodeIds(graph, filter);
    if (focusedPatientId) {
      const subgraph = getPatientSubgraphIds(graph, focusedPatientId);
      Array.from(ids).forEach((id) => {
        if (!subgraph.has(id)) ids.delete(id);
      });
      ids.add(focusedPatientId);
    }
    const start = timeWindow.start ?? null;
    const end = timeWindow.end ?? null;
    if (start !== null || end !== null) {
      records.forEach((record, id) => {
        const evidence = getNodeEvidence(record.node);
        if (!evidence) return;
        const timestamp = new Date(evidence.occurredAt).getTime();
        if ((start !== null && timestamp < start) || (end !== null && timestamp > end)) ids.delete(id);
      });
      graph.nodes.filter((node) => node.type === "tag").forEach((node) => {
        const hasVisibleNeighbor = graph.links.some((link) => {
          const sourceId = getGraphEndpointId(link.source);
          const targetId = getGraphEndpointId(link.target);
          return (sourceId === node.id && targetId && ids.has(targetId))
            || (targetId === node.id && sourceId && ids.has(sourceId));
        });
        if (!hasVisibleNeighbor) ids.delete(node.id);
      });
    }
    return ids;
  };

  const applyTransitionTargets = (
    positions: Map<string, SpatialPoint>,
    nextVisibleIds: Set<string>,
    nextFocusedSubgraph: Set<string>,
    duration: number,
  ) => {
    activeLayoutPositions = positions;
    transitionStartedAt = performance.now();
    transitionDuration = Math.max(1, duration);
    layoutTransitionActive = true;
    physicsActive = false;
    animationUntil = Math.max(animationUntil, transitionStartedAt + transitionDuration + 48);
    const distanceScale = connectionDistanceScale(dynamics.connectionDistance);

    records.forEach((record, id) => {
      record.start.copy(record.current);
      if (!record.pinned) {
        record.target.copy(pointToVector(positions.get(id) || { x: 0, y: 0, z: 0 }).multiplyScalar(distanceScale));
      }
      record.startScale = record.currentScale;
      record.startBrightness = record.currentBrightness;
      record.velocity.set(0, 0, 0);
      const visible = nextVisibleIds.has(id);
      const legible = !focusedPatientId || nextFocusedSubgraph.has(id);
      record.targetScale = visible ? baseNodeScale(record.node, darkMode) * (legible ? 1 : 0.2) : 0.001;
      record.targetBrightness = visible
        ? (activity.get(id) || 0.28) * (legible ? 1 : 0.07)
        : 0;
    });
  };

  const updateLabels = () => {
    const pathActive = highlightedNodeIds.size > 0;
    const focusedCount = focusedSubgraphIds.size;
    const cameraDistance = camera.position.distanceTo(controls.target);
    const candidates: Array<{ record: NodeRecord; id: string; priority: number; point: THREE.Vector3 }> = [];
    records.forEach((record, id) => {
      record.label.position.copy(record.current);
      record.label.element.style.opacity = "0";
      const visible = visibleNodeIds.has(id);
      const inFocus = !focusedPatientId || focusedSubgraphIds.has(id);
      const pathVisible = highlightedNodeIds.has(id);
      const showPanoramaPatient = !focusedPatientId && record.node.type === "patient";
      const showFocusedArtifact = Boolean(focusedPatientId)
        && inFocus
        && (focusedCount <= 60 || record.node.type !== "tag");
      const evidence = getNodeEvidence(record.node);
      const semanticLabel = lens === "attention"
        ? record.node.type === "patient"
        : cameraDistance >= 92
          ? record.node.type === "patient"
          : cameraDistance >= 62
            ? record.node.type === "patient" || record.node.type === "flow" || record.node.type === "tag" || Boolean(evidence && evidence.gravity.score >= 0.62)
            : showPanoramaPatient || showFocusedArtifact;
      const show = visible && inFocus && (pathVisible || semanticLabel);
      if (!show) return;
      const priority = pathVisible ? 120
        : record.node.type === "patient" ? 100
          : record.node.type === "flow" ? 72
            : record.node.type === "tag" ? 64
              : 40 + (evidence?.gravity.score || 0) * 30;
      const point = record.current.clone().project(camera);
      candidates.push({ record, id, priority, point });
    });
    const occupied: Array<{ left: number; right: number; top: number; bottom: number }> = [];
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    candidates.sort((left, right) => right.priority - left.priority).forEach(({ record, id, point }) => {
      if (point.z < -1 || point.z > 1) return;
      const centerX = (point.x * 0.5 + 0.5) * width;
      const centerY = (-point.y * 0.5 + 0.5) * height;
      const labelWidth = Math.min(220, Math.max(70, (record.node.label || "").length * 6.2 + 22));
      const box = { left: centerX - labelWidth / 2, right: centerX + labelWidth / 2, top: centerY - 14, bottom: centerY + 14 };
      const collision = occupied.some((other) => !(box.right < other.left || box.left > other.right || box.bottom < other.top || box.top > other.bottom));
      if (collision && !highlightedNodeIds.has(id)) return;
      occupied.push(box);
      record.label.element.style.opacity = pathActive && !highlightedNodeIds.has(id) ? "0.3" : "1";
      record.label.element.style.transform = highlightedNodeIds.has(id) ? "scale(1.04)" : "scale(1)";
    });
  };

  const wakePhysics = (duration = 2200) => {
    if (reducedMotion) return;
    physicsActive = true;
    settledPhysicsFrames = 0;
    physicsLastAt = performance.now();
    animationUntil = Math.max(animationUntil, physicsLastAt + duration);
  };

  const integratePhysics = (now: number) => {
    if (!physicsActive || reducedMotion) return false;
    const deltaSeconds = Math.min(0.032, Math.max(0.001, (now - physicsLastAt) / 1000));
    physicsLastAt = now;
    const gravity = dynamics.centralGravity / 100;
    const elasticity = dynamics.elasticity / 100;
    const distanceScale = connectionDistanceScale(dynamics.connectionDistance);
    const anchorStrength = 1.35 + elasticity * 0.45;
    const gravityStrength = gravity * 0.72;
    const springStrength = 0.62 + elasticity * 2.35;

    records.forEach((record, id) => {
      const visible = visibleNodeIds.has(id);
      const inFocus = !focusedPatientId || focusedSubgraphIds.has(id);
      if (!visible || !inFocus || record.pinned) {
        record.velocity.set(0, 0, 0);
        return;
      }
      record.velocity.addScaledVector(edgePointA.copy(record.target).sub(record.current), anchorStrength * deltaSeconds);
      record.velocity.addScaledVector(record.current, -gravityStrength * deltaSeconds);
    });

    edgeRecords.forEach((edge) => {
      const source = records.get(edge.sourceId);
      const target = records.get(edge.targetId);
      if (!source || !target) return;
      const visible = visibleNodeIds.has(edge.sourceId) && visibleNodeIds.has(edge.targetId);
      const inFocus = !focusedPatientId
        || (focusedSubgraphIds.has(edge.sourceId) && focusedSubgraphIds.has(edge.targetId));
      if (!visible || !inFocus) return;

      edgeDirection.copy(target.current).sub(source.current);
      const currentLength = Math.max(0.001, edgeDirection.length());
      const sourceBase = activeLayoutPositions.get(edge.sourceId);
      const targetBase = activeLayoutPositions.get(edge.targetId);
      const baseLength = sourceBase && targetBase
        ? Math.hypot(targetBase.x - sourceBase.x, targetBase.y - sourceBase.y, targetBase.z - sourceBase.z)
        : currentLength;
      const restLength = Math.max(2.2, baseLength * distanceScale);
      const force = (currentLength - restLength) * springStrength;
      edgeDirection.multiplyScalar(1 / currentLength);
      if (!source.pinned) source.velocity.addScaledVector(edgeDirection, force * deltaSeconds);
      if (!target.pinned) target.velocity.addScaledVector(edgeDirection, -force * deltaSeconds);
    });

    const damping = Math.exp(-(5.4 - elasticity * 2.45) * deltaSeconds);
    let maximumSpeed = 0;
    records.forEach((record, id) => {
      const visible = visibleNodeIds.has(id);
      const inFocus = !focusedPatientId || focusedSubgraphIds.has(id);
      if (!visible || !inFocus || record.pinned) return;
      record.velocity.multiplyScalar(damping);
      const speed = record.velocity.length();
      if (speed > 38) record.velocity.multiplyScalar(38 / speed);
      record.current.addScaledVector(record.velocity, deltaSeconds);
      const maximumSemanticDrift = record.node.type === "patient" ? 5.5 : record.node.type === "tag" ? 8 : 6.5;
      edgePointA.copy(record.current).sub(record.target);
      if (edgePointA.lengthSq() > maximumSemanticDrift * maximumSemanticDrift) {
        edgePointA.setLength(maximumSemanticDrift);
        record.current.copy(record.target).add(edgePointA);
        record.velocity.multiplyScalar(0.42);
      }
      maximumSpeed = Math.max(maximumSpeed, record.velocity.length());
    });

    settledPhysicsFrames = maximumSpeed < 0.025 ? settledPhysicsFrames + 1 : 0;
    if (settledPhysicsFrames >= 14) physicsActive = false;
    return physicsActive;
  };

  const updateInstances = (now: number) => {
    const progress = layoutTransitionActive
      ? Math.min(1, (now - transitionStartedAt) / transitionDuration)
      : 1;
    const eased = reducedMotion ? 1 : easeInOutCubic(progress);
    const background = backgroundColor(darkMode);

    if (layoutTransitionActive) {
      records.forEach((record) => {
        record.current.lerpVectors(record.start, record.target, eased);
        record.currentScale = THREE.MathUtils.lerp(record.startScale, record.targetScale, eased);
        record.currentBrightness = THREE.MathUtils.lerp(record.startBrightness, record.targetBrightness, eased);
      });
      if (progress >= 1) {
        layoutTransitionActive = false;
        wakePhysics(1800);
      }
    }
    const physicsMoving = integratePhysics(now);
    const cameraDistance = camera.position.distanceTo(controls.target);

    groups.forEach((group) => {
      group.ids.forEach((id, index) => {
        const record = records.get(id);
        if (!record) return;
        const highlighted = highlightedNodeIds.has(id);
        const dimForPath = highlightedNodeIds.size > 0 && !highlighted;
        const evidence = getNodeEvidence(record.node);
        let semanticScale = 1;
        if (lens === "attention" && record.node.type !== "patient" && !highlighted) {
          semanticScale = 0.001;
        } else if (!focusedPatientId && cameraDistance >= 92 && record.node.type !== "patient" && !highlighted) {
          semanticScale = evidence && evidence.gravity.score >= 0.72 ? 0.26 : 0.025;
        } else if (!focusedPatientId && cameraDistance >= 62 && record.node.type !== "patient" && !highlighted) {
          if (record.node.type === "tag" || record.node.type === "flow") semanticScale = 0.74;
          else semanticScale = evidence ? THREE.MathUtils.lerp(0.18, 0.82, evidence.gravity.score) : 0.34;
        }
        const displayScale = record.currentScale * semanticScale * (highlighted ? 1.24 : 1);
        dummy.position.copy(record.current);
        dummy.scale.setScalar(Math.max(0.001, displayScale));
        dummy.updateMatrix();
        group.mesh.setMatrixAt(index, dummy.matrix);

        dummy.scale.setScalar(Math.max(0.001, displayScale * (highlighted ? 1.85 : 1.48)));
        dummy.updateMatrix();
        group.halo.setMatrixAt(index, dummy.matrix);

        const hitScale = semanticScale > 0.08
          ? Math.max(displayScale * 1.58, record.node.type === "patient" ? 2.65 : 1.16)
          : 0.001;
        dummy.scale.setScalar(hitScale);
        dummy.updateMatrix();
        group.hit.setMatrixAt(index, dummy.matrix);

        const brightness = Math.max(0, record.currentBrightness * semanticScale * (highlighted ? 1.34 : dimForPath ? 0.18 : 1));
        const color = nodeColor(record.node, darkMode).multiplyScalar(brightness);
        if (dimForPath) color.lerp(background, 0.58);
        group.mesh.setColorAt(index, color);
        group.halo.setColorAt(index, highlighted ? new THREE.Color(darkMode ? "#bcecff" : "#168bab") : color.clone().multiplyScalar(0.48));
      });
      group.mesh.instanceMatrix.needsUpdate = true;
      group.halo.instanceMatrix.needsUpdate = true;
      group.hit.instanceMatrix.needsUpdate = true;
      if (group.mesh.instanceColor) group.mesh.instanceColor.needsUpdate = true;
      if (group.halo.instanceColor) group.halo.instanceColor.needsUpdate = true;
    });

    attentionHalos.forEach((halo) => {
      const record = records.get(halo.nodeId);
      if (!record) return;
      halo.group.visible = visibleNodeIds.has(halo.nodeId)
        && (!focusedPatientId || focusedPatientId === halo.nodeId)
        && (lens === "attention" || cameraDistance >= 68 || focusedPatientId === halo.nodeId);
      halo.group.position.copy(record.current);
      halo.group.quaternion.copy(camera.quaternion);
      const haloScale = lens === "attention" ? 1.12 : 0.94;
      halo.group.scale.setScalar(Math.max(0.001, record.currentScale / Math.max(0.1, baseNodeScale(record.node, darkMode)) * haloScale));
    });

    edgeRecords.forEach((edge, edgeIndex) => {
      const source = records.get(edge.sourceId);
      const target = records.get(edge.targetId);
      if (!source || !target) return;

      edgeDirection.copy(target.current).sub(source.current);
      const edgeLength = Math.max(0.001, edgeDirection.length());
      const tangent = edgeDirection.clone().multiplyScalar(1 / edgeLength);
      edgeNormal.set(edge.bend, 0.75 + Math.abs(edge.twist) * 0.35, edge.twist).normalize();
      edgeNormal.crossVectors(tangent, edgeNormal);
      if (edgeNormal.lengthSq() < 0.01) edgeNormal.crossVectors(tangent, camera.up);
      edgeNormal.normalize();
      edgeBinormal.crossVectors(tangent, edgeNormal).normalize();
      const bendAmount = THREE.MathUtils.clamp(edgeLength * (0.075 + Math.abs(edge.bend) * 0.035), 0.45, 4.6);
      edgeControlA.copy(source.current)
        .addScaledVector(edgeDirection, 0.32)
        .addScaledVector(edgeNormal, bendAmount * (edge.bend < 0 ? -1 : 1))
        .addScaledVector(edgeBinormal, bendAmount * edge.twist * 0.34);
      edgeControlB.copy(source.current)
        .addScaledVector(edgeDirection, 0.68)
        .addScaledVector(edgeNormal, bendAmount * (edge.bend < 0 ? -0.72 : 0.72))
        .addScaledVector(edgeBinormal, -bendAmount * edge.twist * 0.28);

      if (edge.bundleKey && edge.patientNodeId && cameraDistance > 58) {
        const patientRecord = records.get(edge.patientNodeId);
        if (patientRecord) {
          const angle = organicSeed(`${edge.bundleKey}:angle`) * Math.PI * 2;
          const depth = (organicSeed(`${edge.bundleKey}:depth`) - 0.5) * 4;
          edgeBundleAnchor.set(Math.cos(angle) * 8, Math.sin(angle) * 8, depth).add(patientRecord.current);
          const bundleStrength = THREE.MathUtils.clamp((cameraDistance - 58) / 46, 0, 0.82);
          edgeControlA.lerp(edgeBundleAnchor, bundleStrength);
          edgeControlB.lerp(edgeBundleAnchor, bundleStrength * 0.58);
        }
      }

      const active = highlightedEdgeIds.has(edge.edgeId);
      const visible = visibleNodeIds.has(edge.sourceId) && visibleNodeIds.has(edge.targetId);
      const focusVisible = !focusedPatientId
        || (focusedSubgraphIds.has(edge.sourceId) && focusedSubgraphIds.has(edge.targetId));
      const artifactNode = nodeById.get(edge.sourceId)?.type === "patient"
        ? nodeById.get(edge.targetId)
        : nodeById.get(edge.targetId)?.type === "patient"
          ? nodeById.get(edge.sourceId)
          : null;
      const artifactGravity = artifactNode ? getNodeEvidence(artifactNode)?.gravity.score || 0 : 0;
      const farTrunk = Boolean(edge.bundleKey) && artifactGravity >= 0.56;
      const inactiveVisible = visible
        && focusVisible
        && lens !== "attention"
        && (cameraDistance < 92 || farTrunk || active);
      const inactiveIntensity = highlightedNodeIds.size && !active
        ? (darkMode ? 0.018 : 0.08)
        : cameraDistance >= 92
          ? (darkMode ? 0.034 : 0.18)
          : darkMode ? 0.052 : 0.36;
      const inactiveColor = new THREE.Color(darkMode ? "#ffffff" : "#88857f").multiplyScalar(inactiveIntensity);
      const activeVisible = active && visible && focusVisible;
      const activeColor = new THREE.Color(darkMode ? "#eafcff" : "#087f9e").multiplyScalar(darkMode ? 1.8 : 1.15);

      for (let segment = 0; segment < edgeSegmentCount; segment += 1) {
        const t0 = segment / edgeSegmentCount;
        const t1 = (segment + 1) / edgeSegmentCount;
        const inverse0 = 1 - t0;
        const inverse1 = 1 - t1;
        edgePointA.copy(source.current).multiplyScalar(inverse0 ** 3)
          .addScaledVector(edgeControlA, 3 * inverse0 ** 2 * t0)
          .addScaledVector(edgeControlB, 3 * inverse0 * t0 ** 2)
          .addScaledVector(target.current, t0 ** 3);
        edgePointB.copy(source.current).multiplyScalar(inverse1 ** 3)
          .addScaledVector(edgeControlA, 3 * inverse1 ** 2 * t1)
          .addScaledVector(edgeControlB, 3 * inverse1 * t1 ** 2)
          .addScaledVector(target.current, t1 ** 3);
        const offset = (edgeIndex * edgeSegmentCount + segment) * 6;
        const inactiveEnd = inactiveVisible ? edgePointB : edgePointA;
        inactiveEdgePositions[offset] = edgePointA.x;
        inactiveEdgePositions[offset + 1] = edgePointA.y;
        inactiveEdgePositions[offset + 2] = edgePointA.z;
        inactiveEdgePositions[offset + 3] = inactiveEnd.x;
        inactiveEdgePositions[offset + 4] = inactiveEnd.y;
        inactiveEdgePositions[offset + 5] = inactiveEnd.z;
        inactiveEdgeColors[offset] = inactiveColor.r;
        inactiveEdgeColors[offset + 1] = inactiveColor.g;
        inactiveEdgeColors[offset + 2] = inactiveColor.b;
        inactiveEdgeColors[offset + 3] = inactiveColor.r;
        inactiveEdgeColors[offset + 4] = inactiveColor.g;
        inactiveEdgeColors[offset + 5] = inactiveColor.b;

        const activeEnd = activeVisible ? edgePointB : edgePointA;
        activeEdgePositions[offset] = edgePointA.x;
        activeEdgePositions[offset + 1] = edgePointA.y;
        activeEdgePositions[offset + 2] = edgePointA.z;
        activeEdgePositions[offset + 3] = activeEnd.x;
        activeEdgePositions[offset + 4] = activeEnd.y;
        activeEdgePositions[offset + 5] = activeEnd.z;
        activeEdgeColors[offset] = activeColor.r;
        activeEdgeColors[offset + 1] = activeColor.g;
        activeEdgeColors[offset + 2] = activeColor.b;
        activeEdgeColors[offset + 3] = activeColor.r;
        activeEdgeColors[offset + 4] = activeColor.g;
        activeEdgeColors[offset + 5] = activeColor.b;
      }
    });
    const inactiveStart = inactiveEdgeGeometry.getAttribute("instanceStart") as THREE.InterleavedBufferAttribute;
    const inactiveColorStart = inactiveEdgeGeometry.getAttribute("instanceColorStart") as THREE.InterleavedBufferAttribute;
    inactiveStart.data.needsUpdate = true;
    inactiveColorStart.data.needsUpdate = true;
    (activeEdgeGeometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    (activeEdgeGeometry.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
    updateLabels();
    return physicsMoving;
  };

  const render = (now: number) => {
    renderRequested = false;
    if (disposed) return;
    const animatingCamera = updateCameraTween(now);
    const physicsMoving = updateInstances(now);
    const controlsChanged = controls.update();
    if (composer) composer.render();
    else renderer.render(scene, camera);
    labelsRenderer.render(scene, camera);
    if (now < animationUntil || animatingCamera || controlsChanged || physicsMoving) requestRender();
  };

  function requestRender(duration = 0) {
    if (disposed) return;
    if (duration > 0) animationUntil = Math.max(animationUntil, performance.now() + duration);
    if (renderRequested) return;
    renderRequested = true;
    frameId = requestAnimationFrame(render);
  }

  const setHighlight = (nodeId: string | null) => {
    highlightedNodeId = nodeId;
    if (!nodeId) {
      highlightedNodeIds = new Set(options.emphasizedNodeIds || []);
      highlightedEdgeIds = new Set();
    } else {
      const path = findShortestClinicalPath(graph, nodeId, focusedPatientId);
      highlightedNodeIds = new Set(path.nodeIds);
      highlightedEdgeIds = new Set(path.edgeIds);
      edgeRecords.forEach((edge) => {
        if (edge.sourceId !== nodeId && edge.targetId !== nodeId) return;
        const neighborId = edge.sourceId === nodeId ? edge.targetId : edge.sourceId;
        const visible = visibleNodeIds.has(edge.sourceId) && visibleNodeIds.has(edge.targetId);
        const inFocus = !focusedPatientId
          || (focusedSubgraphIds.has(edge.sourceId) && focusedSubgraphIds.has(edge.targetId));
        if (!visible || !inFocus) return;
        highlightedEdgeIds.add(edge.edgeId);
        highlightedNodeIds.add(neighborId);
      });
    }
    requestRender(80);
  };

  const setView = (nextFilter: NeuroView3DFilter, nextFocusedPatientId: string | null, nextDarkMode: boolean) => {
    if (filter === nextFilter && focusedPatientId === nextFocusedPatientId && darkMode === nextDarkMode) return;
    const previousFocus = focusedPatientId;
    const layoutChanged = filter !== nextFilter || focusedPatientId !== nextFocusedPatientId;
    filter = nextFilter;
    focusedPatientId = nextFocusedPatientId;
    if (layoutChanged) {
      records.forEach((record) => {
        record.pinned = Boolean(getNodeEvidence(record.node)?.pinned);
        record.velocity.set(0, 0, 0);
      });
    }
    if (focusedPatientId) {
      focusedSubgraphIds = getPatientSubgraphIds(graph, focusedPatientId);
    } else {
      focusedSubgraphIds = new Set();
    }
    visibleNodeIds = getStateVisibleNodeIds();

    if (darkMode !== nextDarkMode) {
      darkMode = nextDarkMode;
      updateSceneTheme();
    }

    const duration = reducedMotion ? 120 : previousFocus !== focusedPatientId ? 650 : 320;
    const nextLayout = focusedPatientId
      ? computeFocusedLayout(graph, layout.panorama, focusedPatientId).positions
      : layout.panorama;
    applyTransitionTargets(nextLayout, visibleNodeIds, focusedSubgraphIds, duration);

    if (!previousFocus && focusedPatientId) {
      savedPanoramaCamera = camera.position.clone();
      savedPanoramaTarget = controls.target.clone();
      const direction = camera.position.clone().sub(controls.target).normalize();
      const focusCamera = direction.lengthSq() > 0.1 ? direction.multiplyScalar(56) : new THREE.Vector3(0, 6, 56);
      beginCameraTween(focusCamera, PANORAMA_TARGET, reducedMotion ? 0 : 650);
    } else if (previousFocus && !focusedPatientId) {
      beginCameraTween(savedPanoramaCamera, savedPanoramaTarget, reducedMotion ? 0 : 650);
    }
    if (highlightedNodeId) setHighlight(highlightedNodeId);
    requestRender(duration + 100);
  };

  const setLens = (nextLens: NeuroViewLens) => {
    if (lens === nextLens) return;
    lens = nextLens;
    visibleNodeIds = getStateVisibleNodeIds();
    applyTransitionTargets(
      activeLayoutPositions,
      visibleNodeIds,
      focusedSubgraphIds,
      reducedMotion ? 1 : 320,
    );
    requestRender(reducedMotion ? 60 : 460);
  };

  const setTimeWindow = (nextWindow: NeuroViewTimeWindow) => {
    const normalized = {
      start: Number.isFinite(nextWindow.start) ? nextWindow.start : null,
      end: Number.isFinite(nextWindow.end) ? nextWindow.end : null,
    };
    if (timeWindow.start === normalized.start && timeWindow.end === normalized.end) return;
    timeWindow = normalized;
    visibleNodeIds = getStateVisibleNodeIds();
    applyTransitionTargets(
      activeLayoutPositions,
      visibleNodeIds,
      focusedSubgraphIds,
      reducedMotion ? 1 : 220,
    );
    requestRender(reducedMotion ? 60 : 360);
  };

  const focusNode = (nodeId: string) => {
    const record = records.get(nodeId);
    if (!record || !visibleNodeIds.has(nodeId)) return;
    const direction = camera.position.clone().sub(controls.target).normalize();
    const distance = record.node.type === "patient" ? 34 : 24;
    beginCameraTween(
      record.current.clone().addScaledVector(direction.lengthSq() > 0.1 ? direction : new THREE.Vector3(0, 0, 1), distance),
      record.current.clone(),
      reducedMotion ? 0 : 560,
    );
    setHighlight(nodeId);
    requestRender(640);
  };

  const setDynamics = (nextSettings: NeuroViewDynamicsSettings) => {
    const normalized = clampDynamics(nextSettings);
    const changed = normalized.centralGravity !== dynamics.centralGravity
      || normalized.elasticity !== dynamics.elasticity
      || normalized.connectionDistance !== dynamics.connectionDistance;
    if (!changed) return;
    const distanceChanged = normalized.connectionDistance !== dynamics.connectionDistance;
    dynamics = normalized;
    if (distanceChanged) {
      applyTransitionTargets(
        activeLayoutPositions,
        visibleNodeIds,
        focusedSubgraphIds,
        reducedMotion ? 1 : 260,
      );
      requestRender(reducedMotion ? 40 : 420);
    } else {
      wakePhysics(2600);
      requestRender(2600);
    }
  };

  const resetDynamics = () => {
    records.forEach((record) => {
      record.pinned = Boolean(getNodeEvidence(record.node)?.pinned);
      record.velocity.set(0, 0, 0);
    });
    applyTransitionTargets(
      activeLayoutPositions,
      visibleNodeIds,
      focusedSubgraphIds,
      reducedMotion ? 1 : 420,
    );
    requestRender(reducedMotion ? 40 : 2300);
  };

  const resetCamera = () => {
    if (focusedPatientId) {
      const direction = camera.position.clone().sub(controls.target).normalize();
      beginCameraTween(direction.multiplyScalar(56), PANORAMA_TARGET, reducedMotion ? 0 : 520);
    } else {
      beginCameraTween(PANORAMA_CAMERA, PANORAMA_TARGET, reducedMotion ? 0 : 520);
    }
    requestRender(600);
  };

  const resize = () => {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    labelsRenderer.setSize(width, height);
    composer?.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    requestRender(80);
  };

  const updatePointerRay = (event: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
  };

  const findNodeAtPointer = (event: PointerEvent) => {
    updatePointerRay(event);
    const intersections = raycaster.intersectObjects(Array.from(meshLookup.keys()), false);
    for (const intersection of intersections) {
      if (!(intersection.object instanceof THREE.InstancedMesh) || intersection.instanceId === undefined) continue;
      const nodeId = meshLookup.get(intersection.object)?.[intersection.instanceId];
      if (!nodeId || !visibleNodeIds.has(nodeId)) continue;
      if (focusedPatientId && !focusedSubgraphIds.has(nodeId)) continue;
      return nodeId;
    }
    return null;
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (draggedNodeId) {
      const record = records.get(draggedNodeId);
      if (!record) return;
      updatePointerRay(event);
      if (!raycaster.ray.intersectPlane(dragPlane, dragHit)) return;
      const nextPosition = dragHit.sub(dragOffset);
      const start = pointerStart;
      dragMoved = dragMoved || Boolean(start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 3);
      if (!dragMoved) return;
      layoutTransitionActive = false;
      physicsActive = false;
      record.current.copy(nextPosition);
      record.start.copy(nextPosition);
      record.target.copy(nextPosition);
      record.velocity.set(0, 0, 0);
      record.pinned = true;
      renderer.domElement.style.cursor = "grabbing";
      requestRender(100);
      return;
    }
    if (pointerStart && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) return;
    const nodeId = findNodeAtPointer(event);
    if (nodeId === hoveredNodeId) return;
    hoveredNodeId = nodeId;
    renderer.domElement.style.cursor = "grab";
    setHighlight(nodeId);
    onHoverNode(nodeId);
  };
  const handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    pointerStart = { x: event.clientX, y: event.clientY };
    dragMoved = false;
    const nodeId = findNodeAtPointer(event);
    const record = nodeId ? records.get(nodeId) : null;
    if (!nodeId || !record) return;
    draggedNodeId = nodeId;
    controls.enabled = false;
    camera.getWorldDirection(cameraDirection);
    dragPlane.setFromNormalAndCoplanarPoint(cameraDirection, record.current);
    updatePointerRay(event);
    if (raycaster.ray.intersectPlane(dragPlane, dragHit)) dragOffset.copy(dragHit).sub(record.current);
    else dragOffset.set(0, 0, 0);
    renderer.domElement.setPointerCapture?.(event.pointerId);
    renderer.domElement.style.cursor = "grabbing";
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const handlePointerUp = (event: PointerEvent) => {
    const start = pointerStart;
    pointerStart = null;
    const releasedNodeId = draggedNodeId;
    draggedNodeId = null;
    controls.enabled = true;
    if (renderer.domElement.hasPointerCapture?.(event.pointerId)) {
      renderer.domElement.releasePointerCapture(event.pointerId);
    }
    renderer.domElement.style.cursor = "grab";
    if (dragMoved) {
      dragMoved = false;
      wakePhysics(3200);
      requestRender(3200);
      return;
    }
    dragMoved = false;
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return;
    const nodeId = findNodeAtPointer(event);
    const node = nodeId && nodeId === releasedNodeId ? nodeById.get(nodeId) : null;
    if (node) onActivateNode(node);
  };
  const handlePointerLeave = () => {
    if (draggedNodeId) return;
    pointerStart = null;
    hoveredNodeId = null;
    renderer.domElement.style.cursor = "grab";
    setHighlight(null);
    onHoverNode(null);
  };
  const handlePointerCancel = (event: PointerEvent) => {
    pointerStart = null;
    draggedNodeId = null;
    dragMoved = false;
    controls.enabled = true;
    if (renderer.domElement.hasPointerCapture?.(event.pointerId)) {
      renderer.domElement.releasePointerCapture(event.pointerId);
    }
    renderer.domElement.style.cursor = "grab";
    requestRender(80);
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  renderer.domElement.addEventListener("pointermove", handlePointerMove);
  renderer.domElement.addEventListener("pointerdown", handlePointerDown, true);
  renderer.domElement.addEventListener("pointerup", handlePointerUp);
  renderer.domElement.addEventListener("pointercancel", handlePointerCancel);
  renderer.domElement.addEventListener("pointerleave", handlePointerLeave);
  controls.addEventListener("change", () => requestRender(180));
  controls.addEventListener("end", () => {
    if (!focusedPatientId) {
      savedPanoramaCamera = camera.position.clone();
      savedPanoramaTarget = controls.target.clone();
    }
    requestRender(280);
  });

  resize();
  updateSceneTheme();
  applyTransitionTargets(layout.panorama, visibleNodeIds, focusedSubgraphIds, reducedMotion ? 120 : 900);
  requestRender(reducedMotion ? 160 : 980);

  return {
    setView,
    setHighlight,
    setDynamics,
    resetDynamics,
    resetCamera,
    focusNode,
    setLens,
    setTimeWindow,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      if (frameId) cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown, true);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointercancel", handlePointerCancel);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
      renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
      controls.dispose();
      records.forEach((record) => {
        record.label.removeFromParent();
        record.label.element.remove();
      });
      groups.forEach((group) => {
        group.mesh.removeFromParent();
        group.halo.removeFromParent();
        group.hit.removeFromParent();
        group.geometry.dispose();
        group.material.dispose();
        group.haloMaterial.dispose();
      });
      attentionHalos.forEach((halo) => {
        halo.group.removeFromParent();
        halo.geometries.forEach((geometry) => geometry.dispose());
        halo.materials.forEach((material) => material.dispose());
      });
      hitGeometry.dispose();
      hitMaterial.dispose();
      inactiveEdgeLines.removeFromParent();
      activeEdgeGlowLines.removeFromParent();
      activeEdgeLines.removeFromParent();
      inactiveEdgeGeometry.dispose();
      inactiveEdgeMaterial.dispose();
      activeEdgeGeometry.dispose();
      activeEdgeMaterial.dispose();
      activeEdgeGlowMaterial.dispose();
      composer?.dispose();
      environmentTarget?.dispose();
      scene.environment = null;
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
      labelsRenderer.domElement.remove();
      renderer.domElement.remove();
    },
  };
};
