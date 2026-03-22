"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { collection, doc, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { watchCameraStream } from "../lib/webrtc";

interface Node extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  state: "on" | "off";
  isGoal?: boolean;
  isMaster?: boolean;
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string | Node;
  target: string | Node;
}

export default function PerformancePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [goalCompleted, setGoalCompleted] = useState(false);
  const [goalHitCount, setGoalHitCount] = useState(0);
  const [goalConnected, setGoalConnected] = useState(false);
  const nodesRef = useRef<Node[]>([]);
  const linksRef = useRef<Link[]>([]);

  // Camera setup: watch for WebRTC remote stream, auto-reconnect on camera change
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const unsubscribe = watchCameraStream((remoteStream) => {
      video.srcObject = remoteStream;
      video.play().catch(() => {});
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Goal completion & hitCount listener
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "meta", "goal"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data?.completed) setGoalCompleted(true);
        if (typeof data?.hitCount === "number") setGoalHitCount(data.hitCount);
      }
    });
    return () => unsubscribe();
  }, []);

  // Firestore subscription + D3 visualization
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const width = window.innerWidth;
    const height = window.innerHeight;

    svg.attr("width", width).attr("height", height);

    const linkGroup = svg.append("g");
    const nodeGroup = svg.append("g");
    const labelGroup = svg.append("g");

    let simulation = d3
      .forceSimulation<Node>([])
      .force("link", d3.forceLink<Node, Link>([]).id((d) => d.id).distance(120))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2));

    simulation.on("tick", () => {
      linkGroup
        .selectAll<SVGLineElement, Link>("line")
        .attr("x1", (d) => (d.source as Node).x!)
        .attr("y1", (d) => (d.source as Node).y!)
        .attr("x2", (d) => (d.target as Node).x!)
        .attr("y2", (d) => (d.target as Node).y!);

      nodeGroup
        .selectAll<SVGCircleElement, Node>("circle")
        .attr("cx", (d) => d.x!)
        .attr("cy", (d) => d.y!);

      labelGroup
        .selectAll<SVGTextElement, Node>("text")
        .attr("x", (d) => d.x!)
        .attr("y", (d) => d.y!);
    });

    const unsubscribe = onSnapshot(collection(db, "nodes"), (snapshot) => {
      const entries: { id: string; parentId: string | null; state: "on" | "off"; createdAt: Timestamp | null; isGoal?: boolean; isMaster?: boolean }[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as { parentId: string | null; state?: "on" | "off"; createdAt?: Timestamp; isGoal?: boolean; isMaster?: boolean };
        entries.push({ id: doc.id, parentId: data.parentId, state: data.state ?? "off", createdAt: data.createdAt ?? null, isGoal: data.isGoal, isMaster: data.isMaster });
      });

      // Sort by createdAt to assign stable hex labels
      entries.sort((a, b) => {
        if (!a.createdAt) return -1;
        if (!b.createdAt) return 1;
        return a.createdAt.toMillis() - b.createdAt.toMillis();
      });

      const labelMap = new Map<string, string>();
      entries.forEach((e, i) => {
        labelMap.set(e.id, i.toString(16).toUpperCase().padStart(2, "0"));
      });

      const nodeMap = new Map<string, { parentId: string | null }>();
      for (const e of entries) {
        nodeMap.set(e.id, { parentId: e.parentId });
      }

      // Build nodes - reuse existing positions
      const oldPositions = new Map<string, { x: number; y: number }>();
      for (const n of nodesRef.current) {
        if (n.x != null && n.y != null) {
          oldPositions.set(n.id, { x: n.x, y: n.y });
        }
      }

      const nodes: Node[] = [];
      for (const e of entries) {
        const old = oldPositions.get(e.id);
        const label = e.isGoal ? "GOAL" : e.isMaster ? "MASTER" : labelMap.get(e.id)!;
        nodes.push(old
          ? { id: e.id, label, state: e.state, isGoal: e.isGoal, isMaster: e.isMaster, x: old.x, y: old.y }
          : { id: e.id, label, state: e.state, isGoal: e.isGoal, isMaster: e.isMaster });
      }

      // Build links from parent relationships
      const links: Link[] = [];
      for (const [id, data] of nodeMap.entries()) {
        if (data.parentId && nodeMap.has(data.parentId)) {
          links.push({ source: data.parentId, target: id });
        }
      }

      nodesRef.current = nodes;
      linksRef.current = links;

      // Check if goal node has a parent (= connected to network)
      const goalEntry = entries.find((e) => e.isGoal);
      setGoalConnected(!!(goalEntry && goalEntry.parentId));

      // Update D3
      const link = linkGroup
        .selectAll<SVGLineElement, Link>("line")
        .data(links, (d) => `${(d.source as string)}-${(d.target as string)}`);
      link.exit().remove();
      link
        .enter()
        .append("line")
        .attr("stroke", "rgba(255,255,255,0.4)")
        .attr("stroke-width", 1);

      const node = nodeGroup
        .selectAll<SVGCircleElement, Node>("circle")
        .data(nodes, (d) => d.id);
      node.exit().remove();
      node
        .enter()
        .append("circle")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1)
        .merge(node)
        .attr("r", (d) => (d.isGoal || d.isMaster) ? 30 : 20)
        .attr("fill", (d) => d.state === "on" ? "#fff" : "none");

      const label = labelGroup
        .selectAll<SVGTextElement, Node>("text")
        .data(nodes, (d) => d.id);
      label.exit().remove();
      label
        .enter()
        .append("text")
        .text((d) => d.label)
        .attr("font-size", 14)
        .attr("font-family", "'Times New Roman', 'Noto Serif', Georgia, serif")
        .attr("font-style", "italic")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .merge(label)
        .attr("fill", (d) => d.state === "on" ? "#0000ff" : "#fff");

      // Restart simulation with new data
      simulation.nodes(nodes);
      (
        simulation.force("link") as d3.ForceLink<Node, Link>
      ).links(links);
      simulation.alpha(0.3).restart();
    });

    return () => {
      unsubscribe();
      simulation.stop();
      svg.selectAll("*").remove();
    };
  }, []);

  return (
    <div id="performance">
      {error ? (
        <p id="error">{error}</p>
      ) : (
        <>
          <video ref={videoRef} autoPlay playsInline muted />
          <svg ref={svgRef} id="network-overlay" />
          {goalConnected && !goalCompleted && goalHitCount > 0 && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10,
                fontFamily: "'Times New Roman', 'Noto Serif', Georgia, serif",
              }}
            >
              <p style={{ fontSize: "min(20vw, 240px)", color: "#fff", fontStyle: "italic" }}>
                {3 - goalHitCount}
              </p>
            </div>
          )}
          {goalCompleted && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10,
                fontFamily: "'Times New Roman', 'Noto Serif', Georgia, serif",
              }}
            >
              <h1 style={{ fontSize: "min(20vw, 240px)", color: "#fff", fontStyle: "italic" }}>
                Hello, World!
              </h1>
            </div>
          )}
        </>
      )}
    </div>
  );
}
