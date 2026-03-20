"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";

interface Node extends d3.SimulationNodeDatum {
  id: string;
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string | Node;
  target: string | Node;
}

export default function PerformancePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [error, setError] = useState<string | null>(null);
  const nodesRef = useRef<Node[]>([]);
  const linksRef = useRef<Link[]>([]);

  // Camera setup
  useEffect(() => {
    let stream: MediaStream | null = null;

    const init = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "user" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        await video.play();
      } catch {
        setError("カメラへのアクセスが拒否されました。");
      }
    };

    init();

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
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
      const nodeMap = new Map<string, { parentId: string | null }>();
      snapshot.forEach((doc) => {
        nodeMap.set(doc.id, doc.data() as { parentId: string | null });
      });

      // Build nodes - reuse existing positions
      const oldPositions = new Map<string, { x: number; y: number }>();
      for (const n of nodesRef.current) {
        if (n.x != null && n.y != null) {
          oldPositions.set(n.id, { x: n.x, y: n.y });
        }
      }

      const nodes: Node[] = [];
      for (const id of nodeMap.keys()) {
        const old = oldPositions.get(id);
        nodes.push(old ? { id, x: old.x, y: old.y } : { id });
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

      // Update D3
      const link = linkGroup
        .selectAll<SVGLineElement, Link>("line")
        .data(links, (d) => `${(d.source as string)}-${(d.target as string)}`);
      link.exit().remove();
      link
        .enter()
        .append("line")
        .attr("stroke", "rgba(255,255,255,0.4)")
        .attr("stroke-width", 2);

      const node = nodeGroup
        .selectAll<SVGCircleElement, Node>("circle")
        .data(nodes, (d) => d.id);
      node.exit().remove();
      node
        .enter()
        .append("circle")
        .attr("r", 20)
        .attr("fill", "rgba(255,255,255,0.15)")
        .attr("stroke", "#fff")
        .attr("stroke-width", 2);

      const label = labelGroup
        .selectAll<SVGTextElement, Node>("text")
        .data(nodes, (d) => d.id);
      label.exit().remove();
      label
        .enter()
        .append("text")
        .text((d) => d.id.slice(0, 4))
        .attr("fill", "#fff")
        .attr("font-size", 14)
        .attr("font-weight", "bold")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central");

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
        </>
      )}
    </div>
  );
}
