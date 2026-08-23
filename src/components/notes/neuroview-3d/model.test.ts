import { describe, expect, it } from "vitest";

import type { GraphLink, GraphNode } from "../graph/graph-types";
import {
  buildHoverEquivalentHighlight,
  computeSpatialLayout,
  findShortestClinicalPath,
  getGraphEdgeId,
  getVisibleNodeIds,
  isRecordedRiskPatient,
  type GraphSnapshot,
} from "./model";

const node = (
  id: string,
  type: GraphNode["type"],
  data: Record<string, unknown> = {},
  position: { x?: number; y?: number } = {},
): GraphNode => ({
  id,
  type,
  label: id,
  data,
  color: "#fff",
  val: 1,
  currentRadius: 1,
  targetRadius: 1,
  currentGlow: 1,
  targetGlow: 1,
  x: position.x,
  y: position.y,
});

const link = (source: string, target: string): GraphLink => ({ source, target, value: 1 });

describe("NeuroView 3d graph model", () => {
  it("highlights every equally short clinical path to the nearest patients", () => {
    const graph: GraphSnapshot = {
      nodes: [
        node("pat-a", "patient", { id: "a" }),
        node("pat-b", "patient", { id: "b" }),
        node("note-a", "note", { patient_id: "a" }),
        node("note-b", "note", { patient_id: "b" }),
        node("tag-shared", "tag"),
      ],
      links: [
        link("pat-a", "note-a"),
        link("note-a", "tag-shared"),
        link("pat-b", "note-b"),
        link("note-b", "tag-shared"),
      ],
    };

    const path = findShortestClinicalPath(graph, "tag-shared");
    expect(path.nodeIds).toEqual(new Set(["tag-shared", "note-a", "pat-a", "note-b", "pat-b"]));
    expect(path.edgeIds).toEqual(new Set([
      getGraphEdgeId("tag-shared", "note-a"),
      getGraphEdgeId("note-a", "pat-a"),
      getGraphEdgeId("tag-shared", "note-b"),
      getGraphEdgeId("note-b", "pat-b"),
    ]));

    const focusedPath = findShortestClinicalPath(graph, "tag-shared", "pat-a");
    expect(focusedPath.nodeIds).toEqual(new Set(["tag-shared", "note-a", "pat-a"]));
  });

  it("reproduces patient hover for Synapse-linked notes", () => {
    const graph: GraphSnapshot = {
      nodes: [
        node("pat-a", "patient", { id: "a" }),
        node("note-a", "note", { patient_id: "a" }),
        node("note-b", "note", { patient_id: "a" }),
        node("tag-theme", "tag"),
      ],
      links: [
        link("pat-a", "note-a"),
        link("pat-a", "note-b"),
        link("note-a", "tag-theme"),
      ],
    };

    const highlight = buildHoverEquivalentHighlight(graph, ["pat-a"]);

    expect(highlight.nodeIds).toEqual(new Set(["pat-a", "note-a", "note-b"]));
    expect(highlight.edgeIds).toEqual(new Set([
      getGraphEdgeId("pat-a", "note-a"),
      getGraphEdgeId("pat-a", "note-b"),
    ]));
  });

  it("combines note groups and resolves one tag inside the requested patient", () => {
    const graph: GraphSnapshot = {
      nodes: [
        node("pat-a", "patient", { id: "a" }),
        node("pat-b", "patient", { id: "b" }),
        node("note-a", "note", { patient_id: "a" }),
        node("note-b", "note", { patient_id: "a" }),
        node("note-other", "note", { patient_id: "b" }),
        node("tag-shared", "tag"),
      ],
      links: [
        link("pat-a", "note-a"),
        link("pat-a", "note-b"),
        link("pat-b", "note-other"),
        link("note-a", "tag-shared"),
        link("note-b", "tag-shared"),
        link("note-other", "tag-shared"),
      ],
    };

    const noteGroup = buildHoverEquivalentHighlight(graph, ["note-a", "note-b"], "pat-a");
    expect(noteGroup.nodeIds).toEqual(new Set(["note-a", "pat-a", "tag-shared", "note-b"]));
    expect(noteGroup.nodeIds.has("note-other")).toBe(false);

    const tagGroup = buildHoverEquivalentHighlight(graph, ["tag-shared"], "pat-a");
    expect(tagGroup.nodeIds).toEqual(new Set(["tag-shared", "note-a", "pat-a", "note-b"]));
    expect(tagGroup.nodeIds.has("pat-b")).toBe(false);
  });

  it("uses inclusive 30-day recency boundaries", () => {
    const now = Date.UTC(2026, 7, 22, 12);
    const daysAgo = (days: number) => new Date(now - days * 86_400_000).toISOString();
    const graph: GraphSnapshot = {
      nodes: [
        node("pat-a", "patient", { id: "a" }),
        node("note-7", "note", { patient_id: "a", updated_at: daysAgo(7) }),
        node("flow-30", "flow", { patient_id: "a", updated_at: daysAgo(30) }),
        node("note-31", "note", { patient_id: "a", updated_at: daysAgo(31) }),
        node("tag-recent", "tag"),
      ],
      links: [
        link("pat-a", "note-7"),
        link("pat-a", "flow-30"),
        link("pat-a", "note-31"),
        link("flow-30", "tag-recent"),
      ],
    };

    expect(getVisibleNodeIds(graph, "recent", now)).toEqual(
      new Set(["pat-a", "note-7", "flow-30", "tag-recent"]),
    );
  });

  it("respects explicit risk scales without crossing shared tags into another patient", () => {
    const risk10 = node("pat-10", "patient", { id: "10", risk_score: 4, risk_score_scale: 10 });
    const risk100 = node("pat-100", "patient", { id: "100", risk_score: 40, risk_score_scale: 100 });
    const safe = node("pat-safe", "patient", { id: "safe", risk_score: 3.9, risk_score_scale: 10 });
    const graph: GraphSnapshot = {
      nodes: [
        risk10,
        risk100,
        safe,
        node("note-10", "note", { patient_id: "10" }),
        node("note-100", "note", { patient_id: "100" }),
        node("note-safe", "note", { patient_id: "safe" }),
        node("tag-shared", "tag"),
      ],
      links: [
        link("pat-10", "note-10"),
        link("pat-100", "note-100"),
        link("pat-safe", "note-safe"),
        link("note-10", "tag-shared"),
        link("note-safe", "tag-shared"),
      ],
    };

    expect(isRecordedRiskPatient(risk10)).toBe(true);
    expect(isRecordedRiskPatient(risk100)).toBe(true);
    expect(isRecordedRiskPatient(safe)).toBe(false);
    expect(getVisibleNodeIds(graph, "risk")).toEqual(
      new Set(["pat-10", "pat-100", "note-10", "note-100", "tag-shared"]),
    );
  });

  it("starts on the flat plane and maps density to radius and chronology to depth", () => {
    const evidence = (sourceId: string, score: number, occurredAt: string) => ({
      id: `session_note:${sourceId}`,
      sourceId,
      sourceType: "session_note" as const,
      patientId: "a",
      title: sourceId,
      occurredAt,
      updatedAt: occurredAt,
      tags: ["ansiedade"],
      reviewed: true,
      isActionable: false,
      actionDueAt: null,
      actionCompleted: false,
      priority: 0,
      pinned: false,
      hidden: false,
      theme: "Ansiedade",
      metadata: {},
      gravity: {
        recency: score,
        recurrence: score,
        sourceDiversity: score,
        actionability: 0,
        clinicianPriority: 0,
        score,
        eligible: true,
      },
    });
    const graph: GraphSnapshot = {
      nodes: [
        node("pat-a", "patient", { id: "a" }, { x: -50, y: 10 }),
        node("evidence-high", "evidence", {
          patient_id: "a",
          evidence: evidence("high", 0.92, "2026-08-22T12:00:00.000Z"),
        }, { x: 10, y: 20 }),
        node("evidence-low", "evidence", {
          patient_id: "a",
          evidence: evidence("low", 0.08, "2026-01-01T12:00:00.000Z"),
        }, { x: 40, y: -20 }),
        node("tag-a", "tag", {}, { x: 50, y: 30 }),
      ],
      links: [
        link("pat-a", "evidence-high"),
        link("pat-a", "evidence-low"),
        link("evidence-high", "tag-a"),
      ],
    };

    const layout = computeSpatialLayout(graph);
    expect(Array.from(layout.flat.values()).every((point) => point.z === 0)).toBe(true);
    const distanceFromPatient = (id: string) => {
      const point = layout.panorama.get(id)!;
      const patient = layout.panorama.get("pat-a")!;
      return Math.hypot(point.x - patient.x, point.y - patient.y, point.z - patient.z);
    };
    expect(distanceFromPatient("evidence-high")).toBeLessThan(distanceFromPatient("evidence-low"));
    expect(layout.panorama.get("evidence-high")!.z).toBeGreaterThan(layout.panorama.get("evidence-low")!.z);
  });
});
