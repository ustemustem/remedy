"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Node,
  type Edge,
} from "reactflow";
import "reactflow/dist/style.css";
import { RotateCcw, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { RxNode, type RxNodeData } from "./rx-node";
import { RxEdge } from "./rx-edge";
import { layoutNodes } from "@/lib/layout";
import { getNodeResponse, getOptionResponse, MAX_BRANCH_DEPTH } from "@/lib/mockAI";
import {
  getSupersededIds,
  resolveVisibleParentId,
  deriveFeedbackContext,
} from "@/lib/graph";
import type { CanvasGraph, CanvasNodeData } from "@/lib/types";

const nodeTypes = { rxNode: RxNode };
const edgeTypes = { rxEdge: RxEdge };

interface Selection {
  nodeId: string;
  text: string;
  x: number;
  y: number;
}

function resolveVisibleGraph(graph: CanvasGraph) {
  const supersededIds = getSupersededIds(graph.nodes);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));

  const visibleNodes = graph.nodes
    .filter((n) => !supersededIds.has(n.id))
    .map((n) => ({
      ...n,
      parentId: resolveVisibleParentId(n.parentId, byId, supersededIds),
    }));

  return { visibleNodes, byId };
}

export function CanvasScreen({
  initialGraph,
  onGraphChange,
  onFinalize,
  onReset,
}: {
  initialGraph: CanvasGraph;
  /** Fires whenever the graph changes — lets the caller autosave to a session. */
  onGraphChange?: (graph: CanvasGraph) => void;
  onFinalize: (graph: CanvasGraph) => void;
  onReset: () => void;
}) {
  const [graph, setGraph] = useState<CanvasGraph>(initialGraph);

  useEffect(() => {
    onGraphChange?.(graph);
    // Only re-fire when the graph itself changes — onGraphChange is a fresh
    // closure on every parent render and isn't meant to gate this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);
  const [pendingNodeIds, setPendingNodeIds] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<Selection | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentOpen, setCommentOpen] = useState(false);

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<RxNodeData>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Liked/disliked themes, independent of "Select" — steers the mock AI's
  // next outputs and surfaces in the header strip below.
  const feedbackContext = useMemo(() => deriveFeedbackContext(graph.nodes), [graph.nodes]);

  const handleSelectToggle = useCallback((nodeId: string) => {
    setGraph((g) => ({
      ...g,
      nodes: g.nodes.map((n) => (n.id === nodeId ? { ...n, selected: !n.selected } : n)),
    }));
  }, []);

  const handleFeedbackToggle = useCallback((nodeId: string, type: "like" | "dislike") => {
    setGraph((g) => ({
      ...g,
      nodes: g.nodes.map((n) =>
        n.id === nodeId ? { ...n, feedback: n.feedback === type ? undefined : type } : n
      ),
    }));
  }, []);

  const handleOptionPick = useCallback(
    async (nodeId: string, choiceId: string) => {
      const node = graph.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      setPendingNodeIds((prev) => new Set(prev).add(nodeId));
      const { nodes: newNodes, edges: newEdges } = await getOptionResponse(
        node,
        choiceId,
        feedbackContext
      );
      setGraph((g) => ({ nodes: [...g.nodes, ...newNodes], edges: [...g.edges, ...newEdges] }));
      setPendingNodeIds((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    },
    [graph, feedbackContext]
  );

  // Shared by the comment popover AND the "Prefer this option" card
  // action — both are just "comment on this node," one with typed text, the
  // other with an implicit preference.
  const submitCommentFor = useCallback(
    async (nodeId: string, commentText: string, forceSelected?: boolean) => {
      const node = graph.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      setPendingNodeIds((prev) => new Set(prev).add(nodeId));
      const { node: newNode, edge: newEdge } = await getNodeResponse(
        node,
        commentText,
        feedbackContext
      );
      // Every comment refines the same recommendation — carry the "Select"
      // mark forward so the dashboard always reflects the latest revision's
      // data, not whatever version happened to be selected first. A forced
      // value wins — "Prefer this option" always accepts the new revision,
      // even if the card wasn't explicitly selected beforehand.
      const carried = { ...newNode, selected: forceSelected ?? node.selected };
      setGraph((g) => ({ nodes: [...g.nodes, carried], edges: [...g.edges, newEdge] }));
      setPendingNodeIds((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    },
    [graph, feedbackContext]
  );

  const handleSubmitComment = useCallback(() => {
    if (!selection) return;
    const nodeId = selection.nodeId;
    const commentText = commentDraft;
    setCommentOpen(false);
    setSelection(null);
    setCommentDraft("");
    submitCommentFor(nodeId, commentText);
  }, [selection, commentDraft, submitCommentFor]);

  // Accept-and-continue: always marks the resulting revision "Select",
  // whether or not the card was explicitly selected first — no separate
  // "click the card, then click this" step required.
  const handlePreferOption = useCallback(
    (nodeId: string) => {
      submitCommentFor(nodeId, "I prefer this — please continue in this direction.", true);
    },
    [submitCommentFor]
  );

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.toString().trim().length === 0) return;
    const anchorNode = sel.anchorNode;
    const anchorEl =
      anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement ?? null;
    const nodeEl = anchorEl?.closest("[data-node-id]");
    if (!nodeEl) return;
    const nodeId = nodeEl.getAttribute("data-node-id");
    if (!nodeId) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setSelection({
      nodeId,
      text: sel.toString().trim(),
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
    setCommentDraft("");
    setCommentOpen(true);
  }, []);

  // General "Add comment" from the hover menu — no text selection required.
  const handleOpenComment = useCallback((nodeId: string, pos: { x: number; y: number }) => {
    setSelection({ nodeId, text: "", x: pos.x, y: pos.y });
    setCommentDraft("");
    setCommentOpen(true);
  }, []);

  const hasSelectedNode = graph.nodes.some((n) => n.selected);

  // Rebuild React Flow nodes/edges whenever the domain graph or pending set changes.
  useEffect(() => {
    const { visibleNodes, byId } = resolveVisibleGraph(graph);
    const positions = layoutNodes(visibleNodes);

    const nextNodes: Node<RxNodeData>[] = visibleNodes.map((n) => {
      const original = byId.get(n.id) as CanvasNodeData;
      const predecessor = original.previousVersionId
        ? byId.get(original.previousVersionId) ?? null
        : null;
      return {
        id: n.id,
        type: "rxNode",
        position: positions[n.id] ?? { x: 0, y: 0 },
        data: {
          nodeData: original,
          pending: pendingNodeIds.has(n.id),
          predecessor,
          atDepthCap: original.depth >= MAX_BRANCH_DEPTH,
          onSelectToggle: handleSelectToggle,
          onOptionPick: handleOptionPick,
          onFeedbackToggle: handleFeedbackToggle,
          onOpenComment: handleOpenComment,
          onPreferOption: handlePreferOption,
        },
      };
    });

    const nextEdges: Edge[] = visibleNodes
      .filter((n) => n.parentId)
      .map((n) => ({
        id: `e-${n.parentId}-${n.id}`,
        source: n.parentId as string,
        target: n.id,
        type: "rxEdge",
      }));

    setRfNodes(nextNodes);
    setRfEdges(nextEdges);
  }, [
    graph,
    pendingNodeIds,
    handleSelectToggle,
    handleOptionPick,
    handleFeedbackToggle,
    handleOpenComment,
    handlePreferOption,
    setRfNodes,
    setRfEdges,
  ]);

  const proOptions = useMemo(() => ({ hideAttribution: true }), []);
  const hasFeedback = feedbackContext.liked.length > 0 || feedbackContext.disliked.length > 0;

  return (
    <div className="flex h-full flex-col bg-background" onMouseUp={handleMouseUp}>
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- static local SVG, no optimization needed */}
          <img src="/logo.svg" alt="Remedy" className="h-7 w-auto" />
          {hasFeedback && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">Themes that influenced this:</span>
              {feedbackContext.liked.map((theme) => (
                <Badge
                  key={`liked-${theme}`}
                  variant="outline"
                  className="border-primary/40 bg-primary/10 text-primary"
                >
                  {theme}
                </Badge>
              ))}
              {feedbackContext.disliked.map((theme) => (
                <Badge
                  key={`disliked-${theme}`}
                  variant="outline"
                  className="border-destructive/40 bg-destructive/10 text-destructive"
                >
                  {theme}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset session
          </Button>
          <Button
            variant="cta"
            size="sm"
            disabled={!hasSelectedNode}
            onClick={() => onFinalize(graph)}
          >
            <Send className="h-3.5 w-3.5" />
            Finalize
          </Button>
        </div>
      </header>

      <div className="relative flex-1">
        <ReactFlowProvider>
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={{ type: "rxEdge" }}
            proOptions={proOptions}
            fitView
            minZoom={0.2}
          >
            <Background color="var(--border)" gap={24} size={1} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className="!bg-card" />
          </ReactFlow>
        </ReactFlowProvider>

        {selection && (
          <Popover
            open={commentOpen}
            onOpenChange={(open) => {
              setCommentOpen(open);
              if (!open) setSelection(null);
            }}
          >
            <PopoverTrigger asChild>
              <span
                style={{
                  position: "fixed",
                  left: selection.x,
                  top: selection.y,
                  width: 1,
                  height: 1,
                }}
              />
            </PopoverTrigger>
            <PopoverContent className="w-72 space-y-2" side="top">
              <p className="text-xs text-muted-foreground">
                {selection.text ? (
                  <>
                    Commenting on:{" "}
                    <span className="font-medium text-foreground">
                      &ldquo;{selection.text}&rdquo;
                    </span>
                  </>
                ) : (
                  "A general comment on this node"
                )}
              </p>
              <Textarea
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                placeholder="Add a comment…"
                rows={3}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setCommentOpen(false);
                    setSelection(null);
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" disabled={!commentDraft.trim()} onClick={handleSubmitComment}>
                  Submit
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
