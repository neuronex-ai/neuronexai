import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

import type { GraphNode } from "../graph/graph-types";
import {
  computeFocusedLayout,
  computeSpatialLayout,
  findShortestClinicalPath,
  getActivityIntensity,
  getGraphEdgeId,
  getGraphEndpointId,
  getPatientSubgraphIds,
  getVisibleNodeIds,
  type GraphSnapshot,
  type NeuroView3DFilter,
  type SpatialPoint,
} from "./model";

export type NeuroViewSceneProfile = "full" | "light";

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
  resetCamera: () => void;
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
  label: CSS2DObject;
};

type MeshGroup = {
  ids: string[];
  mesh: THREE.InstancedMesh;
  halo: THREE.InstancedMesh;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial;
  haloMaterial: THREE.MeshBasicMaterial;
};

const PANORAMA_CAMERA = new THREE.Vector3(0, 7, 116);
const PANORAMA_TARGET = new THREE.Vector3(0, 0, 0);

const baseNodeScale = (node: GraphNode) => {
  if (node.type === "patient") return 2.55;
  if (node.type === "flow") return 1.65;
  if (node.type === "note") return 1.28;
  return 0.78;
};

const nodeColor = (node: GraphNode, darkMode: boolean) => {
  if (darkMode) {
    if (node.type === "patient") return new THREE.Color("#f5f5f7");
    if (node.type === "flow") return new THREE.Color("#75d8f5");
    if (node.type === "note") return new THREE.Color("#bbb8b5");
    return new THREE.Color("#86818b");
  }
  if (node.type === "patient") return new THREE.Color("#202027");
  if (node.type === "flow") return new THREE.Color("#087f9e");
  if (node.type === "note") return new THREE.Color("#625e66");
  return new THREE.Color("#8a8179");
};

const backgroundColor = (darkMode: boolean) => new THREE.Color(darkMode ? "#070709" : "#f3f1ec");

const easeInOutCubic = (value: number) =>
  value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;

const pointToVector = (point: SpatialPoint) => new THREE.Vector3(point.x, point.y, point.z);

const makeGeometry = (type: GraphNode["type"], profile: NeuroViewSceneProfile) => {
  const detail = profile === "full" ? 3 : 2;
  if (type === "flow") return new THREE.OctahedronGeometry(1, profile === "full" ? 2 : 1);
  if (type === "note") return new THREE.IcosahedronGeometry(1, detail);
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
  let savedPanoramaCamera = PANORAMA_CAMERA.clone();
  let savedPanoramaTarget = PANORAMA_TARGET.clone();

  const layout = computeSpatialLayout(graph);
  const activity = getActivityIntensity(graph);
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const records = new Map<string, NodeRecord>();
  const groups = new Map<GraphNode["type"], MeshGroup>();
  const meshLookup = new Map<THREE.InstancedMesh, string[]>();
  const dummy = new THREE.Object3D();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(2, 2);

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
      targetScale: baseNodeScale(node),
      currentBrightness: 0,
      startBrightness: 0,
      targetBrightness: activity.get(node.id) || 0.28,
      label,
    });
  });

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
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    halo.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    halo.frustumCulled = false;
    halo.raycast = () => undefined;
    const ids = nodes.map((node) => node.id);
    groups.set(type, { ids, mesh, halo, geometry, material, haloMaterial });
    meshLookup.set(mesh, ids);
    scene.add(halo, mesh);
  });

  const edgePositions = new Float32Array(graph.links.length * 6);
  const edgeColors = new Float32Array(graph.links.length * 6);
  const edgeGeometry = new THREE.BufferGeometry();
  edgeGeometry.setAttribute("position", new THREE.BufferAttribute(edgePositions, 3));
  edgeGeometry.setAttribute("color", new THREE.BufferAttribute(edgeColors, 3));
  const edgeMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: darkMode ? 0.72 : 0.54,
    blending: darkMode ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: false,
  });
  const edgeLines = new THREE.LineSegments(edgeGeometry, edgeMaterial);
  edgeLines.frustumCulled = false;
  scene.add(edgeLines);

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
    edgeMaterial.opacity = darkMode ? 0.72 : 0.54;
    edgeMaterial.blending = darkMode ? THREE.AdditiveBlending : THREE.NormalBlending;
    if (bloom) bloom.strength = darkMode ? 0.34 : 0.11;
    groups.forEach((group) => {
      group.haloMaterial.opacity = darkMode ? 0.16 : 0.08;
      if (group.material instanceof THREE.MeshPhysicalMaterial) {
        group.material.roughness = darkMode ? 0.2 : 0.34;
        group.material.metalness = darkMode ? 0.16 : 0.05;
      }
    });
    records.forEach((record) => updateLabelTheme(record, darkMode));
  };

  const applyTransitionTargets = (
    positions: Map<string, SpatialPoint>,
    nextVisibleIds: Set<string>,
    nextFocusedSubgraph: Set<string>,
    duration: number,
  ) => {
    transitionStartedAt = performance.now();
    transitionDuration = Math.max(1, duration);
    animationUntil = Math.max(animationUntil, transitionStartedAt + transitionDuration + 48);

    records.forEach((record, id) => {
      record.start.copy(record.current);
      record.target.copy(pointToVector(positions.get(id) || { x: 0, y: 0, z: 0 }));
      record.startScale = record.currentScale;
      record.startBrightness = record.currentBrightness;
      const visible = nextVisibleIds.has(id);
      const legible = !focusedPatientId || nextFocusedSubgraph.has(id);
      record.targetScale = visible ? baseNodeScale(record.node) * (legible ? 1 : 0.2) : 0.001;
      record.targetBrightness = visible
        ? (activity.get(id) || 0.28) * (legible ? 1 : 0.07)
        : 0;
    });
  };

  const updateLabels = () => {
    const pathActive = highlightedNodeIds.size > 0;
    const focusedCount = focusedSubgraphIds.size;
    records.forEach((record, id) => {
      record.label.position.copy(record.current);
      const visible = visibleNodeIds.has(id);
      const inFocus = !focusedPatientId || focusedSubgraphIds.has(id);
      const pathVisible = highlightedNodeIds.has(id);
      const showPanoramaPatient = !focusedPatientId && record.node.type === "patient";
      const showFocusedArtifact = Boolean(focusedPatientId)
        && inFocus
        && (focusedCount <= 60 || record.node.type !== "tag");
      const show = visible && inFocus && (pathVisible || showPanoramaPatient || showFocusedArtifact);
      record.label.element.style.opacity = show ? (pathActive && !pathVisible ? "0.3" : "1") : "0";
      record.label.element.style.transform = pathVisible ? "scale(1.04)" : "scale(1)";
    });
  };

  const updateInstances = (now: number) => {
    const progress = Math.min(1, (now - transitionStartedAt) / transitionDuration);
    const eased = reducedMotion ? 1 : easeInOutCubic(progress);
    const background = backgroundColor(darkMode);

    records.forEach((record) => {
      record.current.lerpVectors(record.start, record.target, eased);
      record.currentScale = THREE.MathUtils.lerp(record.startScale, record.targetScale, eased);
      record.currentBrightness = THREE.MathUtils.lerp(record.startBrightness, record.targetBrightness, eased);
    });

    groups.forEach((group) => {
      group.ids.forEach((id, index) => {
        const record = records.get(id);
        if (!record) return;
        const highlighted = highlightedNodeIds.has(id);
        const dimForPath = highlightedNodeIds.size > 0 && !highlighted;
        const displayScale = record.currentScale * (highlighted ? 1.24 : 1);
        dummy.position.copy(record.current);
        dummy.scale.setScalar(Math.max(0.001, displayScale));
        dummy.updateMatrix();
        group.mesh.setMatrixAt(index, dummy.matrix);

        dummy.scale.setScalar(Math.max(0.001, displayScale * (highlighted ? 1.85 : 1.48)));
        dummy.updateMatrix();
        group.halo.setMatrixAt(index, dummy.matrix);

        const brightness = Math.max(0, record.currentBrightness * (highlighted ? 1.34 : dimForPath ? 0.18 : 1));
        const color = nodeColor(record.node, darkMode).multiplyScalar(brightness);
        if (dimForPath) color.lerp(background, 0.58);
        group.mesh.setColorAt(index, color);
        group.halo.setColorAt(index, highlighted ? new THREE.Color(darkMode ? "#bcecff" : "#168bab") : color.clone().multiplyScalar(0.48));
      });
      group.mesh.instanceMatrix.needsUpdate = true;
      group.halo.instanceMatrix.needsUpdate = true;
      if (group.mesh.instanceColor) group.mesh.instanceColor.needsUpdate = true;
      if (group.halo.instanceColor) group.halo.instanceColor.needsUpdate = true;
    });

    graph.links.forEach((link, index) => {
      const sourceId = getGraphEndpointId(link.source);
      const targetId = getGraphEndpointId(link.target);
      const source = sourceId ? records.get(sourceId) : null;
      const target = targetId ? records.get(targetId) : null;
      if (!source || !target || !sourceId || !targetId) return;
      const offset = index * 6;
      edgePositions[offset] = source.current.x;
      edgePositions[offset + 1] = source.current.y;
      edgePositions[offset + 2] = source.current.z;
      edgePositions[offset + 3] = target.current.x;
      edgePositions[offset + 4] = target.current.y;
      edgePositions[offset + 5] = target.current.z;

      const edgeId = getGraphEdgeId(sourceId, targetId);
      const active = highlightedEdgeIds.has(edgeId);
      const visible = visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
      const focusVisible = !focusedPatientId || (focusedSubgraphIds.has(sourceId) && focusedSubgraphIds.has(targetId));
      const base = active
        ? new THREE.Color(darkMode ? "#d9f6ff" : "#087f9e")
        : new THREE.Color(darkMode ? "#30343b" : "#a9a39a");
      const intensity = !visible ? 0 : !focusVisible ? 0.025 : highlightedNodeIds.size && !active ? 0.12 : active ? 1 : 0.42;
      base.multiplyScalar(intensity);
      edgeColors[offset] = base.r;
      edgeColors[offset + 1] = base.g;
      edgeColors[offset + 2] = base.b;
      edgeColors[offset + 3] = base.r;
      edgeColors[offset + 4] = base.g;
      edgeColors[offset + 5] = base.b;
    });
    (edgeGeometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    (edgeGeometry.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
    updateLabels();
  };

  const render = (now: number) => {
    renderRequested = false;
    if (disposed) return;
    const animatingCamera = updateCameraTween(now);
    updateInstances(now);
    const controlsChanged = controls.update();
    if (composer) composer.render();
    else renderer.render(scene, camera);
    labelsRenderer.render(scene, camera);
    if (now < animationUntil || animatingCamera || controlsChanged) requestRender();
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
      highlightedNodeIds = path.nodeIds;
      highlightedEdgeIds = path.edgeIds;
    }
    requestRender(80);
  };

  const setView = (nextFilter: NeuroView3DFilter, nextFocusedPatientId: string | null, nextDarkMode: boolean) => {
    if (filter === nextFilter && focusedPatientId === nextFocusedPatientId && darkMode === nextDarkMode) return;
    const previousFocus = focusedPatientId;
    filter = nextFilter;
    focusedPatientId = nextFocusedPatientId;
    visibleNodeIds = getVisibleNodeIds(graph, filter);
    if (focusedPatientId) {
      visibleNodeIds.add(focusedPatientId);
      focusedSubgraphIds = getPatientSubgraphIds(graph, focusedPatientId);
    } else {
      focusedSubgraphIds = new Set();
    }

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

  const findNodeAtPointer = (event: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
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
    if (pointerStart && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) return;
    const nodeId = findNodeAtPointer(event);
    if (nodeId === hoveredNodeId) return;
    hoveredNodeId = nodeId;
    renderer.domElement.style.cursor = nodeId ? "pointer" : "grab";
    setHighlight(nodeId);
    onHoverNode(nodeId);
  };
  const handlePointerDown = (event: PointerEvent) => {
    pointerStart = { x: event.clientX, y: event.clientY };
  };
  const handlePointerUp = (event: PointerEvent) => {
    const start = pointerStart;
    pointerStart = null;
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return;
    const nodeId = findNodeAtPointer(event);
    const node = nodeId ? nodeById.get(nodeId) : null;
    if (node) onActivateNode(node);
  };
  const handlePointerLeave = () => {
    pointerStart = null;
    hoveredNodeId = null;
    renderer.domElement.style.cursor = "grab";
    setHighlight(null);
    onHoverNode(null);
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  renderer.domElement.addEventListener("pointermove", handlePointerMove);
  renderer.domElement.addEventListener("pointerdown", handlePointerDown);
  renderer.domElement.addEventListener("pointerup", handlePointerUp);
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
    resetCamera,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      if (frameId) cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
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
        group.geometry.dispose();
        group.material.dispose();
        group.haloMaterial.dispose();
      });
      edgeLines.removeFromParent();
      edgeGeometry.dispose();
      edgeMaterial.dispose();
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
