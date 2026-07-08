import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { onValue, ref, set, update, remove } from "firebase/database";
import { toast } from "sonner";
import { getFirebaseDb } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  Folder,
  FileCode,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Sparkles,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/syllabus/$docId")({
  component: SyllabusTreeEditor,
});

type SyllabusNode = {
  title: string;
  kind: "unit" | "topic" | "subtopic";
  parentId: string | null;
  order: number;
  chunkIds?: string[];
};

type DocumentItem = {
  title: string;
};

function SyllabusTreeEditor() {
  const { docId } = Route.useParams();
  const navigate = useNavigate();

  const [document, setDocument] = useState<DocumentItem | null>(null);
  const [nodes, setNodes] = useState<Record<string, SyllabusNode>>({});
  const [loading, setLoading] = useState(true);

  // Tree interactive states
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  // Add node modals/inline inputs
  const [addingChildToId, setAddingChildToId] = useState<string | null>(null);
  const [newChildTitle, setNewChildTitle] = useState("");
  const [newChildKind, setNewChildKind] = useState<"unit" | "topic" | "subtopic">("topic");

  const [newUnitTitle, setNewUnitTitle] = useState("");

  useEffect(() => {
    const db = getFirebaseDb();

    // Fetch document metadata
    const docRef = ref(db, `documents/${docId}`);
    const unsubDoc = onValue(docRef, (snap) => {
      setDocument(snap.val());
    });

    // Fetch syllabus tree nodes
    const nodesRef = ref(db, `syllabusTrees/${docId}/nodes`);
    const unsubNodes = onValue(
      nodesRef,
      (snap) => {
        setNodes(snap.val() ?? {});
        setLoading(false);
      },
      () => {
        setLoading(false);
      },
    );

    return () => {
      unsubDoc();
      unsubNodes();
    };
  }, [docId]);

  const toggleCollapse = (id: string) => {
    setCollapsedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSelectNode = (id: string, checked: boolean) => {
    if (checked) {
      // Select node and all its nested children recursively
      const toSelect = [id, ...getChildrenRecursive(id)];
      setSelectedNodeIds((prev) => Array.from(new Set([...prev, ...toSelect])));
    } else {
      // Deselect node and all its children recursively
      const toDeselect = [id, ...getChildrenRecursive(id)];
      setSelectedNodeIds((prev) => prev.filter((x) => !toDeselect.includes(x)));
    }
  };

  const getChildrenRecursive = (parentId: string): string[] => {
    const directChildren = Object.entries(nodes)
      .filter(([_, node]) => node.parentId === parentId)
      .map(([id]) => id);

    let allChildren = [...directChildren];
    for (const childId of directChildren) {
      allChildren = [...allChildren, ...getChildrenRecursive(childId)];
    }
    return allChildren;
  };

  const handleStartRename = (id: string, title: string) => {
    setEditingNodeId(id);
    setEditingTitle(title);
  };

  const handleSaveRename = async () => {
    if (!editingNodeId || !editingTitle.trim()) return;
    try {
      const db = getFirebaseDb();
      await update(ref(db, `syllabusTrees/${docId}/nodes/${editingNodeId}`), {
        title: editingTitle.trim(),
      });
      setEditingNodeId(null);
      toast.success("Node renamed");
    } catch (e) {
      toast.error("Failed to rename");
    }
  };

  const handleAddUnit = async () => {
    if (!newUnitTitle.trim()) return;
    try {
      const db = getFirebaseDb();
      const newId = `node_${Date.now()}`;
      const newNode: SyllabusNode = {
        title: newUnitTitle.trim(),
        kind: "unit",
        parentId: null,
        order: Object.values(nodes).filter((n) => !n.parentId).length + 1,
      };

      await set(ref(db, `syllabusTrees/${docId}/nodes/${newId}`), newNode);
      setNewUnitTitle("");
      toast.success("Unit created");
    } catch (e) {
      toast.error("Failed to create unit");
    }
  };

  const handleAddChild = async (parentId: string) => {
    if (!newChildTitle.trim()) return;
    try {
      const db = getFirebaseDb();
      const newId = `node_${Date.now()}`;
      const parentNode = nodes[parentId];
      const kind: SyllabusNode["kind"] = parentNode.kind === "unit" ? "topic" : "subtopic";

      const newNode: SyllabusNode = {
        title: newChildTitle.trim(),
        kind,
        parentId,
        order: Object.values(nodes).filter((n) => n.parentId === parentId).length + 1,
      };

      await set(ref(db, `syllabusTrees/${docId}/nodes/${newId}`), newNode);
      setNewChildTitle("");
      setAddingChildToId(null);
      toast.success(`${kind} added successfully`);
    } catch (e) {
      toast.error("Failed to add node");
    }
  };

  const handleDeleteNode = async (id: string) => {
    if (
      !confirm("Are you sure you want to delete this syllabus node and all its nested subtopics?")
    )
      return;
    try {
      const db = getFirebaseDb();
      const nodesToDelete = [id, ...getChildrenRecursive(id)];
      for (const nid of nodesToDelete) {
        await remove(ref(db, `syllabusTrees/${docId}/nodes/${nid}`));
      }
      toast.success("Nodes deleted");
    } catch (e) {
      toast.error("Failed to delete nodes");
    }
  };

  const handleTriggerGenerator = () => {
    if (selectedNodeIds.length === 0) {
      toast.error("Please select at least one syllabus node to generate questions.");
      return;
    }
    // Redirect to Quiz Generator with selected parameters
    navigate({
      to: "/admin/generate",
      search: {
        docId,
        nodeIds: selectedNodeIds.join(","),
      },
    });
  };

  // Reconstruct tree from flat nodes
  const renderTreeNode = (nodeId: string, depth: number = 0) => {
    const node = nodes[nodeId];
    if (!node) return null;

    const children = Object.entries(nodes)
      .filter(([_, n]) => n.parentId === nodeId)
      .sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0));

    const isCollapsed = collapsedNodes[nodeId];
    const isEditing = editingNodeId === nodeId;
    const isAddingChild = addingChildToId === nodeId;
    const hasChildren = children.length > 0;

    return (
      <div key={nodeId} className="space-y-2 select-none">
        <div
          className={`group flex items-center justify-between rounded-lg border p-3.5 transition-colors ${
            selectedNodeIds.includes(nodeId)
              ? "bg-primary/5 border-primary/45"
              : "bg-card hover:bg-muted/30"
          }`}
          style={{ marginLeft: `${depth * 20}px` }}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Checkbox
              checked={selectedNodeIds.includes(nodeId)}
              onCheckedChange={(val) => toggleSelectNode(nodeId, !!val)}
            />

            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleCollapse(nodeId)}
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            ) : (
              <div className="w-4 shrink-0" />
            )}

            <Folder
              className={`h-4.5 w-4.5 shrink-0 ${node.kind === "unit" ? "text-amber-500" : "text-sky-500"}`}
            />

            {isEditing ? (
              <div className="flex items-center gap-1.5 flex-1 max-w-md">
                <Input
                  className="h-8 text-sm"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveRename()}
                  autoFocus
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-emerald-600"
                  onClick={handleSaveRename}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-muted-foreground"
                  onClick={() => setEditingNodeId(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <span className="text-sm font-semibold truncate text-foreground">{node.title}</span>
            )}
            <Badge variant="outline" className="text-[9px] uppercase tracking-wider font-bold">
              {node.kind}
            </Badge>
          </div>

          {!isEditing && (
            <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 transition-opacity shrink-0">
              {node.kind !== "subtopic" && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => setAddingChildToId(nodeId)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => handleStartRename(nodeId, node.title)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-destructive"
                onClick={() => handleDeleteNode(nodeId)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Inline Add Child form */}
        {isAddingChild && (
          <div
            className="flex items-center gap-2 border border-dashed rounded-lg p-2.5 bg-muted/10 animate-in fade-in duration-200"
            style={{ marginLeft: `${(depth + 1) * 20}px` }}
          >
            <Input
              placeholder={`Enter title for new ${node.kind === "unit" ? "topic" : "subtopic"}...`}
              value={newChildTitle}
              onChange={(e) => setNewChildTitle(e.target.value)}
              className="h-8 text-xs"
              onKeyDown={(e) => e.key === "Enter" && handleAddChild(nodeId)}
            />
            <Button size="sm" onClick={() => handleAddChild(nodeId)} className="h-8 py-1 px-3 text-xs">
              Add
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAddingChildToId(null)} className="h-8 py-1 px-3 text-xs">
              Cancel
            </Button>
          </div>
        )}

        {/* Render children nodes */}
        {hasChildren && !isCollapsed && (
          <div className="space-y-2">
            {children.map(([childId]) => renderTreeNode(childId, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const rootNodes = Object.entries(nodes)
    .filter(([_, n]) => !n.parentId)
    .sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0));

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground bg-muted/10">
        Loading syllabus tree structure…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
            <Link to="/admin/documents">
              <ChevronLeft className="mr-1 h-4 w-4" /> Ingest List
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight line-clamp-1">
            {document?.title ?? "Syllabus Tree Editor"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Edit extracted syllabus outline and generate AI questions.
          </p>
        </div>

        <Button
          size="sm"
          onClick={handleTriggerGenerator}
          className="shadow-sm font-semibold self-start sm:self-center"
        >
          <Sparkles className="mr-2 h-4 w-4 text-amber-400 fill-current" /> AI Generate Questions
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Tree details */}
        <div className="md:col-span-2 space-y-3.5">
          {rootNodes.map(([id]) => renderTreeNode(id))}

          {rootNodes.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground border border-dashed rounded-lg bg-card shadow-xs">
              No syllabus tree nodes found. Add a unit below or re-parse document.
            </div>
          )}

          {/* Add unit form */}
          <div className="border border-dashed rounded-xl p-4 bg-muted/10 flex items-center gap-3">
            <Input
              placeholder="e.g. Unit 3: Cyber Security Dynamics"
              value={newUnitTitle}
              onChange={(e) => setNewUnitTitle(e.target.value)}
              className="h-9 text-xs"
              onKeyDown={(e) => e.key === "Enter" && handleAddUnit()}
            />
            <Button size="sm" onClick={handleAddUnit}>
              <Plus className="mr-1.5 h-4 w-4" /> Add Unit
            </Button>
          </div>
        </div>

        {/* Right Info panels */}
        <Card className="shadow-sm self-start">
          <CardHeader>
            <CardTitle className="text-sm font-bold">
              Selected Nodes ({selectedNodeIds.length})
            </CardTitle>
            <CardDescription className="text-xs">
              These items will restrict question context boundaries in the AI engine.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {selectedNodeIds.map((id) => {
                const node = nodes[id];
                if (!node) return null;
                return (
                  <Badge
                    key={id}
                    variant="secondary"
                    className="flex items-center justify-between text-[10px] w-full py-1"
                  >
                    <span className="truncate pr-2 font-medium">{node.title}</span>
                    <button
                      type="button"
                      onClick={() => toggleSelectNode(id, false)}
                      className="hover:text-destructive shrink-0"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
              {selectedNodeIds.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-4">
                  No nodes selected. Checkboxes on the left.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
