import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
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

export type NeuroViewCameraAction =
  | "orbit-left"
  | "orbit-right"
  | "orbit-up"
  | "orbit-down"
  | "dolly-in"
  | "dolly-out"
  | "strafe-left"
  | "strafe-right"
  | "elevate-up"
  | "elevate-down";

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
  setAutoRotate: (enabled: boolean) => void;
  moveCamera: (action: NeuroViewCameraAction) => void;
  playEmergence: () => void;
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
  currentReveal: number;
  startReveal: number;
  targetReveal: number;
  transitionDelay: number;
  velocity: THREE.Vector3;
  pinned: boolean;
  label: CSS2DObject;
  labelPresentation: "hidden" | "dimmed" | "visible";
  labelEmphasized: boolean;
};

type MeshGroup = {
  ids: string[];
  mesh: THREE.InstancedMesh;
  halo: THREE.InstancedMesh;
  hit: THREE.InstancedMesh;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshPhysicalMaterial;
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
  let geometry: THREE.BufferGeometry;
  if (type === "flow") geometry = new THREE.OctahedronGeometry(1, profile === "full" ? 3 : 1);
  else if (type === "note") geometry = new THREE.IcosahedronGeometry(1, profile === "full" ? 4 : 2);
  else if (type === "evidence") geometry = new THREE.DodecahedronGeometry(1, profile === "full" ? 3 : 1);
  else if (type === "tag") geometry = new THREE.SphereGeometry(1, profile === "full" ? 48 : 12, profile === "full" ? 36 : 8);
  else geometry = new THREE.SphereGeometry(1, profile === "full" ? 96 : 22, profile === "full" ? 64 : 14);
  geometry.computeVertexNormals();
  return geometry;
};

const ULTRA_PIXEL_BUDGET = 13_500_000;

const resolveRenderPixelRatio = (
  width: number,
  height: number,
  profile: NeuroViewSceneProfile,
) => {
  const deviceRatio = window.devicePixelRatio || 1;
  if (profile === "light") return Math.min(deviceRatio, 1.1);
  const budgetRatio = Math.sqrt(ULTRA_PIXEL_BUDGET / Math.max(1, width * height));
  return THREE.MathUtils.clamp(Math.min(deviceRatio, budgetRatio), 1, 2.5);
};

const createMicroSurfaceTextures = (maxAnisotropy: number) => {
  const size = 256;
  const heights = new Float32Array(size * size);
  const tau = Math.PI * 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;
      heights[y * size + x] = (
        Math.sin(tau * (u * 17 + v * 11)) * 0.46
        + Math.sin(tau * (u * 41 - v * 29)) * 0.31
        + Math.cos(tau * (u * 73 + v * 61)) * 0.16
        + Math.sin(tau * (u * 109 - v * 97)) * 0.07
      );
    }
  }

  const normalData = new Uint8Array(size * size * 4);
  const roughnessData = new Uint8Array(size * size * 4);
  const readHeight = (x: number, y: number) => heights[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const left = readHeight(x - 1, y);
      const right = readHeight(x + 1, y);
      const down = readHeight(x, y - 1);
      const up = readHeight(x, y + 1);
      const normalX = (left - right) * 0.34;
      const normalY = (down - up) * 0.34;
      const inverseLength = 1 / Math.sqrt(normalX * normalX + normalY * normalY + 1);
      const offset = (y * size + x) * 4;
      normalData[offset] = Math.round((normalX * inverseLength * 0.5 + 0.5) * 255);
      normalData[offset + 1] = Math.round((normalY * inverseLength * 0.5 + 0.5) * 255);
      normalData[offset + 2] = Math.round((inverseLength * 0.5 + 0.5) * 255);
      normalData[offset + 3] = 255;
      const roughness = THREE.MathUtils.clamp(239 + heights[y * size + x] * 7, 224, 250);
      roughnessData[offset] = roughness;
      roughnessData[offset + 1] = roughness;
      roughnessData[offset + 2] = roughness;
      roughnessData[offset + 3] = 255;
    }
  }

  const configure = (texture: THREE.DataTexture, name: string) => {
    texture.name = name;
    texture.colorSpace = THREE.NoColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 3);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = Math.min(16, Math.max(1, maxAnisotropy));
    texture.needsUpdate = true;
    return texture;
  };

  return {
    normal: configure(new THREE.DataTexture(normalData, size, size, THREE.RGBAFormat), "NeuroView micro-normal"),
    roughness: configure(new THREE.DataTexture(roughnessData, size, size, THREE.RGBAFormat), "NeuroView micro-roughness"),
  };
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
  element.style.contain = "layout paint style";
  element.style.willChange = "transform, opacity, scale";
  element.style.backfaceVisibility = "hidden";
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
  let transitionStaggerMax = 0;
  let frameId = 0;
  let lastRenderAt = performance.now();
  let animationUntil = transitionStartedAt + transitionDuration;
  let renderRequested = false;
  let controlsInteractionActive = false;
  let autoRotate = !reducedMotion;
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
  raycaster.layers.set(2);
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
  const collisionNormal = new THREE.Vector3();

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
      precision: "highp",
      powerPreference: profile === "full" ? "high-performance" : "low-power",
    });
  } catch (error) {
    onSceneError(error instanceof Error ? error.message : "WebGL indisponível.");
    throw error;
  }
  let renderPixelRatio = resolveRenderPixelRatio(
    Math.max(1, container.clientWidth),
    Math.max(1, container.clientHeight),
    profile,
  );
  renderer.setPixelRatio(renderPixelRatio);
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
  renderer.domElement.style.imageRendering = "auto";
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
  controls.autoRotate = autoRotate && !reducedMotion;
  controls.autoRotateSpeed = 0.48;
  controls.enablePan = false;
  controls.minDistance = 20;
  controls.maxDistance = 145;
  controls.rotateSpeed = 0.58;
  controls.zoomSpeed = 0.72;
  controls.target.copy(PANORAMA_TARGET);
  controls.update();

  RectAreaLightUniformsLib.init();
  const hemisphere = new THREE.HemisphereLight(darkMode ? 0xe9f5ff : 0xffffff, darkMode ? 0x101018 : 0xc8c1b8, darkMode ? 1.32 : 1.7);
  const keyLight = new THREE.RectAreaLight(darkMode ? 0xe8f6ff : 0xffffff, darkMode ? 14 : 11, 42, 30);
  keyLight.position.set(-28, 34, 44);
  keyLight.lookAt(0, 0, 0);
  const fillLight = new THREE.RectAreaLight(darkMode ? 0x78d7f4 : 0xaadce8, darkMode ? 8.5 : 6.5, 28, 38);
  fillLight.position.set(34, -16, 30);
  fillLight.lookAt(0, 0, 0);
  const rimLight = new THREE.PointLight(darkMode ? 0x9fe7ff : 0x77b7c9, darkMode ? 34 : 24, 170, 2);
  rimLight.position.set(30, -12, 32);
  scene.add(hemisphere, keyLight, fillLight, rimLight);

  let environmentTarget: THREE.WebGLRenderTarget | null = null;
  if (profile === "full") {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnvironment = new RoomEnvironment();
    environmentTarget = pmrem.fromScene(roomEnvironment, 0.055);
    scene.environment = environmentTarget.texture;
    scene.environmentIntensity = darkMode ? 0.82 : 0.68;
    roomEnvironment.dispose();
    pmrem.dispose();
  }
  const microSurface = profile === "full"
    ? createMicroSurfaceTextures(renderer.capabilities.getMaxAnisotropy())
    : null;

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
      currentReveal: 0,
      startReveal: 0,
      targetReveal: 1,
      transitionDelay: 0,
      velocity: new THREE.Vector3(),
      pinned: Boolean(getNodeEvidence(node)?.pinned),
      label,
      labelPresentation: "hidden",
      labelEmphasized: false,
    });
  });
  activeLayoutPositions = layout.panorama;

  groupsByType.forEach((nodes, type) => {
    const geometry = makeGeometry(type, profile);
    const material = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: type === "patient"
        ? (darkMode ? 0.14 : 0.27)
        : type === "flow"
          ? (darkMode ? 0.2 : 0.31)
          : (darkMode ? 0.34 : 0.46),
      metalness: type === "patient" ? (darkMode ? 0.3 : 0.1) : type === "flow" ? 0.22 : 0.07,
      clearcoat: type === "patient" ? 1 : 0.82,
      clearcoatRoughness: type === "patient" ? 0.075 : 0.14,
      ior: 1.48,
      reflectivity: darkMode ? 0.82 : 0.62,
      envMapIntensity: profile === "full" ? (darkMode ? 1.36 : 1.08) : 0.44,
      sheen: darkMode ? 0.12 : 0.05,
      sheenColor: new THREE.Color(darkMode ? 0x9fe8ff : 0xd8f4fb),
      sheenRoughness: 0.42,
      specularIntensity: darkMode ? 1 : 0.78,
      normalMap: microSurface?.normal || null,
      normalScale: new THREE.Vector2(type === "patient" ? 0.055 : 0.075, type === "patient" ? 0.055 : 0.075),
      roughnessMap: microSurface?.roughness || null,
      clearcoatNormalMap: microSurface?.normal || null,
      clearcoatNormalScale: new THREE.Vector2(0.022, -0.022),
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
    hit.layers.set(2);
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
  let gtao: GTAOPass | null = null;
  let smaa: SMAAPass | null = null;
  let renderPass: RenderPass | null = null;
  let outputPass: OutputPass | null = null;
  if (profile === "full") {
    const supportsHalfFloat = renderer.extensions.has("EXT_color_buffer_half_float")
      || renderer.extensions.has("EXT_color_buffer_float");
    const composerTarget = new THREE.WebGLRenderTarget(1, 1, {
      type: supportsHalfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
      samples: Math.min(4, renderer.capabilities.maxSamples),
    });
    composer = new EffectComposer(renderer, composerTarget);
    composer.setPixelRatio(renderPixelRatio);
    renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    gtao = new GTAOPass(scene, camera, 1, 1);
    gtao.output = GTAOPass.OUTPUT.Default;
    gtao.blendIntensity = darkMode ? 0.34 : 0.22;
    gtao.updateGtaoMaterial({
      radius: 0.38,
      distanceExponent: 1.7,
      thickness: 1.6,
      distanceFallOff: 0.82,
      scale: 0.82,
      samples: 12,
      screenSpaceRadius: false,
    });
    gtao.updatePdMaterial({
      lumaPhi: 11,
      depthPhi: 2.2,
      normalPhi: 4,
      radius: 3,
      radiusExponent: 1.35,
      rings: 2,
      samples: 12,
    });
    composer.addPass(gtao);
    bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), darkMode ? 0.28 : 0.09, 0.36, 0.9);
    composer.addPass(bloom);
    outputPass = new OutputPass();
    composer.addPass(outputPass);
    smaa = new SMAAPass();
    composer.addPass(smaa);
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
    hemisphere.intensity = darkMode ? 1.32 : 1.7;
    keyLight.color.set(darkMode ? 0xe8f6ff : 0xffffff);
    keyLight.intensity = darkMode ? 14 : 11;
    fillLight.color.set(darkMode ? 0x78d7f4 : 0xaadce8);
    fillLight.intensity = darkMode ? 8.5 : 6.5;
    rimLight.color.set(darkMode ? 0x9fe7ff : 0x77b7c9);
    rimLight.intensity = darkMode ? 34 : 24;
    scene.environmentIntensity = profile === "full" ? (darkMode ? 0.82 : 0.68) : 1;
    inactiveEdgeMaterial.linewidth = darkMode ? 0.68 : 1;
    inactiveEdgeMaterial.opacity = darkMode ? 1 : 0.72;
    inactiveEdgeMaterial.blending = darkMode ? THREE.AdditiveBlending : THREE.NormalBlending;
    inactiveEdgeMaterial.needsUpdate = true;
    activeEdgeMaterial.opacity = darkMode ? 0.88 : 0.72;
    activeEdgeMaterial.blending = darkMode ? THREE.AdditiveBlending : THREE.NormalBlending;
    activeEdgeMaterial.needsUpdate = true;
    activeEdgeGlowMaterial.opacity = darkMode ? 0.3 : 0.12;
    if (bloom) bloom.strength = darkMode ? 0.28 : 0.09;
    if (gtao) gtao.blendIntensity = darkMode ? 0.34 : 0.22;
    groups.forEach((group, type) => {
      group.haloMaterial.opacity = darkMode ? 0.16 : 0.08;
      group.material.roughness = type === "patient"
        ? (darkMode ? 0.14 : 0.27)
        : type === "flow"
          ? (darkMode ? 0.2 : 0.31)
          : (darkMode ? 0.34 : 0.46);
      group.material.metalness = type === "patient" ? (darkMode ? 0.3 : 0.1) : type === "flow" ? 0.22 : 0.07;
      group.material.reflectivity = darkMode ? 0.82 : 0.62;
      group.material.envMapIntensity = profile === "full" ? (darkMode ? 1.36 : 1.08) : 0.44;
      group.material.sheen = darkMode ? 0.12 : 0.05;
      group.material.sheenColor.set(darkMode ? 0x9fe8ff : 0xd8f4fb);
      group.material.specularIntensity = darkMode ? 1 : 0.78;
      group.material.needsUpdate = true;
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
    transitionStaggerMax = 0;
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
      record.startReveal = record.currentReveal;
      record.transitionDelay = 0;
      record.velocity.set(0, 0, 0);
      const visible = nextVisibleIds.has(id);
      const legible = !focusedPatientId || nextFocusedSubgraph.has(id);
      record.targetScale = visible ? baseNodeScale(record.node, darkMode) * (legible ? 1 : 0.2) : 0.001;
      record.targetBrightness = visible
        ? (activity.get(id) || 0.28) * (legible ? 1 : 0.07)
        : 0;
      record.targetReveal = visible && legible ? 1 : 0;
    });
  };

  const updateLabels = () => {
    const pathActive = highlightedNodeIds.size > 0;
    const focusedCount = focusedSubgraphIds.size;
    const cameraDistance = camera.position.distanceTo(controls.target);
    const candidates: Array<{ id: string; priority: number }> = [];
    records.forEach((record, id) => {
      record.label.position.copy(record.current);
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
      candidates.push({ id, priority });
    });

    // O conjunto de rótulos é deliberadamente independente do azimute da câmera.
    // Isso impede que a rotação automática alterne nomes a cada colisão em tela.
    const labelBudget = lens === "attention"
      ? 24
      : cameraDistance >= 92
        ? 18
        : cameraDistance >= 62
          ? 32
          : focusedPatientId
            ? 56
            : 44;
    candidates.sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
    const selectedIds = new Set(candidates.slice(0, labelBudget).map(({ id }) => id));
    highlightedNodeIds.forEach((id) => {
      if (visibleNodeIds.has(id) && (!focusedPatientId || focusedSubgraphIds.has(id))) selectedIds.add(id);
    });

    records.forEach((record, id) => {
      const emphasized = highlightedNodeIds.has(id);
      const presentation = selectedIds.has(id)
        ? pathActive && !emphasized ? "dimmed" : "visible"
        : "hidden";
      if (record.labelPresentation !== presentation) {
        record.labelPresentation = presentation;
        record.label.element.style.opacity = presentation === "hidden" ? "0" : presentation === "dimmed" ? "0.3" : "1";
        record.label.element.style.visibility = presentation === "hidden" ? "hidden" : "visible";
      }
      if (record.labelEmphasized !== emphasized) {
        record.labelEmphasized = emphasized;
        record.label.element.style.scale = emphasized ? "1.04" : "1";
      }
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

  const resolveNodeIntersections = () => {
    const candidates = Array.from(records.entries()).filter(([id, record]) => (
      visibleNodeIds.has(id)
      && (!focusedPatientId || focusedSubgraphIds.has(id))
      && record.currentReveal > 0.015
      && record.currentScale > 0.015
    ));
    if (candidates.length < 2) return false;

    const maximumRadius = candidates.reduce(
      (largest, [, record]) => Math.max(largest, record.currentScale),
      0.5,
    );
    const cellSize = Math.max(2.25, maximumRadius * 2.08);
    let adjusted = false;

    for (let pass = 0; pass < 3; pass += 1) {
      const cells = new Map<string, Array<[string, NodeRecord]>>();
      candidates.forEach(([id, record]) => {
        const cellX = Math.floor(record.current.x / cellSize);
        const cellY = Math.floor(record.current.y / cellSize);
        const cellZ = Math.floor(record.current.z / cellSize);

        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
            for (let offsetZ = -1; offsetZ <= 1; offsetZ += 1) {
              const neighbors = cells.get(`${cellX + offsetX}:${cellY + offsetY}:${cellZ + offsetZ}`);
              if (!neighbors) continue;
              neighbors.forEach(([otherId, other]) => {
                const minimumDistance = record.currentScale + other.currentScale + 0.08;
                collisionNormal.copy(other.current).sub(record.current);
                let distance = collisionNormal.length();
                if (distance >= minimumDistance - 0.0005) return;
                if (distance < 0.0001) {
                  const orderedKey = id < otherId ? `${id}:${otherId}` : `${otherId}:${id}`;
                  const azimuth = organicSeed(`${orderedKey}:azimuth`) * Math.PI * 2;
                  const vertical = organicSeed(`${orderedKey}:vertical`) * 1.6 - 0.8;
                  const horizontal = Math.sqrt(Math.max(0.001, 1 - vertical * vertical));
                  collisionNormal.set(Math.cos(azimuth) * horizontal, Math.sin(azimuth) * horizontal, vertical);
                  distance = 0;
                } else {
                  collisionNormal.multiplyScalar(1 / distance);
                }

                let recordWeight = record.pinned ? 0 : 1;
                let otherWeight = other.pinned ? 0 : 1;
                if (recordWeight + otherWeight === 0) {
                  if (draggedNodeId === id) otherWeight = 1;
                  else if (draggedNodeId === otherId) recordWeight = 1;
                  else {
                    recordWeight = 1;
                    otherWeight = 1;
                  }
                }
                const totalWeight = recordWeight + otherWeight;
                const penetration = minimumDistance - distance;
                record.current.addScaledVector(collisionNormal, -penetration * recordWeight / totalWeight);
                other.current.addScaledVector(collisionNormal, penetration * otherWeight / totalWeight);

                const relativeNormalSpeed = other.velocity.dot(collisionNormal) - record.velocity.dot(collisionNormal);
                if (relativeNormalSpeed < 0) {
                  const impulse = -relativeNormalSpeed / totalWeight;
                  record.velocity.addScaledVector(collisionNormal, -impulse * recordWeight);
                  other.velocity.addScaledVector(collisionNormal, impulse * otherWeight);
                }
                if (record.pinned && recordWeight > 0) record.target.copy(record.current);
                if (other.pinned && otherWeight > 0) other.target.copy(other.current);
                adjusted = true;
              });
            }
          }
        }

        const key = `${cellX}:${cellY}:${cellZ}`;
        const cell = cells.get(key) || [];
        cell.push([id, record]);
        cells.set(key, cell);
      });
    }
    return adjusted;
  };

  const updateInstances = (now: number) => {
    const transitionElapsed = now - transitionStartedAt;
    const background = backgroundColor(darkMode);

    if (layoutTransitionActive) {
      records.forEach((record) => {
        const progress = THREE.MathUtils.clamp(
          (transitionElapsed - record.transitionDelay) / transitionDuration,
          0,
          1,
        );
        const eased = reducedMotion ? 1 : easeInOutCubic(progress);
        record.current.lerpVectors(record.start, record.target, eased);
        record.currentScale = THREE.MathUtils.lerp(record.startScale, record.targetScale, eased);
        record.currentBrightness = THREE.MathUtils.lerp(record.startBrightness, record.targetBrightness, eased);
        record.currentReveal = THREE.MathUtils.lerp(record.startReveal, record.targetReveal, eased);
      });
      if (transitionElapsed >= transitionDuration + transitionStaggerMax) {
        layoutTransitionActive = false;
        wakePhysics(1800);
      }
    }
    const physicsMoving = integratePhysics(now);
    const collisionAdjusted = resolveNodeIntersections();
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
      const edgeReveal = Math.min(source.currentReveal, target.currentReveal);
      const focusVisible = !focusedPatientId
        || (focusedSubgraphIds.has(edge.sourceId) && focusedSubgraphIds.has(edge.targetId));
      const inactiveVisible = visible
        && focusVisible
        && lens !== "attention"
        && edgeReveal > 0.001;
      const inactiveIntensity = highlightedNodeIds.size && !active
        ? (darkMode ? 0.01 : 0.08)
        : cameraDistance >= 92
          ? (darkMode ? 0.012 : 0.14)
          : darkMode ? 0.038 : 0.3;
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
        const segmentReveal = THREE.MathUtils.clamp(edgeReveal * edgeSegmentCount - segment, 0, 1);
        const inactiveReveal = inactiveVisible ? segmentReveal : 0;
        inactiveEdgePositions[offset] = edgePointA.x;
        inactiveEdgePositions[offset + 1] = edgePointA.y;
        inactiveEdgePositions[offset + 2] = edgePointA.z;
        inactiveEdgePositions[offset + 3] = THREE.MathUtils.lerp(edgePointA.x, edgePointB.x, inactiveReveal);
        inactiveEdgePositions[offset + 4] = THREE.MathUtils.lerp(edgePointA.y, edgePointB.y, inactiveReveal);
        inactiveEdgePositions[offset + 5] = THREE.MathUtils.lerp(edgePointA.z, edgePointB.z, inactiveReveal);
        inactiveEdgeColors[offset] = inactiveColor.r;
        inactiveEdgeColors[offset + 1] = inactiveColor.g;
        inactiveEdgeColors[offset + 2] = inactiveColor.b;
        inactiveEdgeColors[offset + 3] = inactiveColor.r;
        inactiveEdgeColors[offset + 4] = inactiveColor.g;
        inactiveEdgeColors[offset + 5] = inactiveColor.b;

        const activeReveal = activeVisible ? segmentReveal : 0;
        activeEdgePositions[offset] = edgePointA.x;
        activeEdgePositions[offset + 1] = edgePointA.y;
        activeEdgePositions[offset + 2] = edgePointA.z;
        activeEdgePositions[offset + 3] = THREE.MathUtils.lerp(edgePointA.x, edgePointB.x, activeReveal);
        activeEdgePositions[offset + 4] = THREE.MathUtils.lerp(edgePointA.y, edgePointB.y, activeReveal);
        activeEdgePositions[offset + 5] = THREE.MathUtils.lerp(edgePointA.z, edgePointB.z, activeReveal);
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
    return physicsMoving || collisionAdjusted;
  };

  const render = (now: number) => {
    renderRequested = false;
    if (disposed) return;
    const deltaSeconds = Math.min(0.05, Math.max(0.001, (now - lastRenderAt) / 1000));
    lastRenderAt = now;
    const animatingCamera = updateCameraTween(now);
    const physicsMoving = updateInstances(now);
    const controlsChanged = controls.update(deltaSeconds);
    if (composer) composer.render();
    else renderer.render(scene, camera);
    labelsRenderer.render(scene, camera);
    if (now < animationUntil || animatingCamera || controlsChanged || physicsMoving || controlsInteractionActive || autoRotate) requestRender();
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

  const setAutoRotate = (enabled: boolean) => {
    autoRotate = enabled && !reducedMotion;
    controls.autoRotate = autoRotate;
    lastRenderAt = performance.now();
    requestRender(autoRotate ? 120 : 320);
  };

  const moveCamera = (action: NeuroViewCameraAction) => {
    cameraTween.active = false;
    const orbitStep = THREE.MathUtils.degToRad(4.5);
    const dollyScale = 0.9;
    const panStep = 34;

    if (action === "orbit-left") controls.rotateLeft(orbitStep);
    else if (action === "orbit-right") controls.rotateLeft(-orbitStep);
    else if (action === "orbit-up") controls.rotateUp(orbitStep);
    else if (action === "orbit-down") controls.rotateUp(-orbitStep);
    else if (action === "dolly-in") controls.dollyIn(dollyScale);
    else if (action === "dolly-out") controls.dollyOut(dollyScale);
    else if (action === "strafe-left") controls.pan(panStep, 0);
    else if (action === "strafe-right") controls.pan(-panStep, 0);
    else if (action === "elevate-up") controls.pan(0, panStep);
    else controls.pan(0, -panStep);

    if (!focusedPatientId) {
      savedPanoramaCamera.copy(camera.position);
      savedPanoramaTarget.copy(controls.target);
    }
    lastRenderAt = performance.now();
    requestRender(reducedMotion ? 80 : 520);
  };

  const playEmergence = () => {
    if (reducedMotion) {
      applyTransitionTargets(activeLayoutPositions, visibleNodeIds, focusedSubgraphIds, 1);
      requestRender(80);
      return;
    }

    const adjacency = new Map<string, string[]>();
    records.forEach((_, id) => adjacency.set(id, []));
    edgeRecords.forEach((edge) => {
      adjacency.get(edge.sourceId)?.push(edge.targetId);
      adjacency.get(edge.targetId)?.push(edge.sourceId);
    });
    adjacency.forEach((neighbors) => neighbors.sort((left, right) => left.localeCompare(right)));

    const roots = Array.from(records.entries())
      .filter(([id, record]) => visibleNodeIds.has(id) && record.node.type === "patient")
      .map(([id]) => id)
      .sort((left, right) => left.localeCompare(right));
    const fallbackRoot = Array.from(visibleNodeIds).sort((left, right) => left.localeCompare(right))[0];
    const queue = (roots.length ? roots : fallbackRoot ? [fallbackRoot] : []).map((id) => ({ id, depth: 0, rootId: id }));
    const depthById = new Map<string, number>();
    const rootById = new Map<string, string>();
    queue.forEach(({ id, rootId }) => {
      depthById.set(id, 0);
      rootById.set(id, rootId);
    });
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      adjacency.get(current.id)?.forEach((neighborId) => {
        if (!visibleNodeIds.has(neighborId) || depthById.has(neighborId)) return;
        depthById.set(neighborId, current.depth + 1);
        rootById.set(neighborId, current.rootId);
        queue.push({ id: neighborId, depth: current.depth + 1, rootId: current.rootId });
      });
    }

    const orderedIds = Array.from(visibleNodeIds).sort((left, right) => (
      (depthById.get(left) ?? 99) - (depthById.get(right) ?? 99)
      || left.localeCompare(right)
    ));
    const distanceScale = connectionDistanceScale(dynamics.connectionDistance);
    transitionStartedAt = performance.now();
    transitionDuration = 760;
    transitionStaggerMax = Math.min(1_650, Math.max(0, (orderedIds.length - 1) * 34));
    layoutTransitionActive = true;
    physicsActive = false;
    settledPhysicsFrames = 0;

    const orderById = new Map(orderedIds.map((id, index) => [id, index]));
    records.forEach((record, id) => {
      const visible = visibleNodeIds.has(id) && (!focusedPatientId || focusedSubgraphIds.has(id));
      const root = records.get(rootById.get(id) || "");
      const startPosition = record.node.type === "patient" || record.pinned
        ? record.current
        : root?.current || controls.target;
      record.start.copy(startPosition);
      record.current.copy(startPosition);
      if (!record.pinned) {
        record.target.copy(pointToVector(activeLayoutPositions.get(id) || { x: 0, y: 0, z: 0 }).multiplyScalar(distanceScale));
      }
      record.currentScale = visible ? 0.018 : 0.001;
      record.startScale = record.currentScale;
      record.targetScale = visible ? baseNodeScale(record.node, darkMode) : 0.001;
      record.currentBrightness = 0;
      record.startBrightness = 0;
      record.targetBrightness = visible ? activity.get(id) || 0.28 : 0;
      record.currentReveal = 0;
      record.startReveal = 0;
      record.targetReveal = visible ? 1 : 0;
      record.transitionDelay = visible ? Math.min(1_650, (orderById.get(id) || 0) * 34) : 0;
      record.velocity.set(0, 0, 0);
    });

    animationUntil = Math.max(
      animationUntil,
      transitionStartedAt + transitionDuration + transitionStaggerMax + 1_100,
    );
    requestRender(transitionDuration + transitionStaggerMax + 1_100);
  };

  const resize = () => {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    const nextPixelRatio = resolveRenderPixelRatio(width, height, profile);
    if (Math.abs(nextPixelRatio - renderPixelRatio) > 0.01) {
      renderPixelRatio = nextPixelRatio;
      renderer.setPixelRatio(renderPixelRatio);
      composer?.setPixelRatio(renderPixelRatio);
    }
    renderer.setSize(width, height, false);
    labelsRenderer.setSize(width, height);
    composer?.setSize(width, height);
    gtao?.setSize(
      Math.max(1, Math.round(width * renderPixelRatio * 0.62)),
      Math.max(1, Math.round(height * renderPixelRatio * 0.62)),
    );
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

  const handleControlsStart = () => {
    controlsInteractionActive = true;
    requestRender();
  };
  const handleControlsChange = () => {
    requestRender();
  };
  const handleControlsEnd = () => {
    controlsInteractionActive = false;
    if (!focusedPatientId) {
      savedPanoramaCamera = camera.position.clone();
      savedPanoramaTarget = controls.target.clone();
    }
    requestRender(280);
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  renderer.domElement.addEventListener("pointermove", handlePointerMove);
  renderer.domElement.addEventListener("pointerdown", handlePointerDown, true);
  renderer.domElement.addEventListener("pointerup", handlePointerUp);
  renderer.domElement.addEventListener("pointercancel", handlePointerCancel);
  renderer.domElement.addEventListener("pointerleave", handlePointerLeave);
  controls.addEventListener("start", handleControlsStart);
  controls.addEventListener("change", handleControlsChange);
  controls.addEventListener("end", handleControlsEnd);

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
    setAutoRotate,
    moveCamera,
    playEmergence,
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
      controls.removeEventListener("start", handleControlsStart);
      controls.removeEventListener("change", handleControlsChange);
      controls.removeEventListener("end", handleControlsEnd);
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
      renderPass?.dispose();
      gtao?.dispose();
      bloom?.dispose();
      outputPass?.dispose();
      smaa?.dispose();
      composer?.dispose();
      microSurface?.normal.dispose();
      microSurface?.roughness.dispose();
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
