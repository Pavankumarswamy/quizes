import { createServerFn } from "@tanstack/react-start";
import { getFirebaseDb } from "@/lib/firebase";
import { ref, update, set, get, push, serverTimestamp } from "firebase/database";

type ParseParams = {
  docId: string;
};

export const parsePdfAndChunk = createServerFn({ method: "POST" })
  .validator((d: ParseParams) => d)
  .handler(async ({ data }) => {
    const { docId } = data;
    const db = getFirebaseDb();

    try {
      await update(ref(db, `documents/${docId}`), {
        status: "running", // Set status to running first
      });

      await new Promise((r) => setTimeout(r, 2000));

      const mockNodes = {
        node_1: {
          title: "Unit 1: Core Fundamentals & Principles",
          kind: "unit",
          parentId: null,
          order: 1,
        },
        node_2: {
          title: "Topic 1.1: Introduction to System Architecture",
          kind: "topic",
          parentId: "node_1",
          order: 1,
          chunkIds: ["chunk_1", "chunk_2"],
        },
        node_3: {
          title: "Topic 1.2: Computational Methods & Limits",
          kind: "topic",
          parentId: "node_1",
          order: 2,
          chunkIds: ["chunk_3"],
        },
        node_4: {
          title: "Unit 2: Applied Methodologies & Design",
          kind: "unit",
          parentId: null,
          order: 2,
        },
        node_5: {
          title: "Topic 2.1: Distributed Storage Implementations",
          kind: "topic",
          parentId: "node_4",
          order: 1,
          chunkIds: ["chunk_4", "chunk_5"],
        },
      };

      const mockChunks = {
        chunk_1: {
          text: "System architecture represents the conceptual model that defines the structure, behavior, and more views of a system. An architecture description is a formal description and representation of a system, organized in a way that supports reasoning about the structural properties and behaviors of the system.",
          page: 1,
          nodeIds: ["node_2"],
        },
        chunk_2: {
          text: "In computer systems, architecture includes elements like instruction set design, CPU scheduling, memory address maps, bus interfaces, and storage layout controllers. Modern systems prioritize scalability, modular partitioning, and fault isolation mechanisms.",
          page: 2,
          nodeIds: ["node_2"],
        },
        chunk_3: {
          text: "Computational models explore the limits of what computers can solve efficiently. Topics include automata theory, formal languages, Turing machines, P vs NP complexity classes, and resource-bounded reductions.",
          page: 4,
          nodeIds: ["node_3"],
        },
        chunk_4: {
          text: "Distributed storage systems partition database loads across multiple nodes. Common strategies include horizontal sharding, consistent hashing rings, leader-follower replication logs, and masterless quorum designs.",
          page: 7,
          nodeIds: ["node_5"],
        },
        chunk_5: {
          text: "Consistency trade-offs in sharded environments are analyzed using the CAP theorem: Consistency, Availability, and Partition tolerance. Systems choose between strict linearizability or eventual replication convergence.",
          page: 9,
          nodeIds: ["node_5"],
        },
      };

      await set(ref(db, `syllabusTrees/${docId}/nodes`), mockNodes);
      await set(ref(db, `docChunks/${docId}`), mockChunks);

      await update(ref(db, `documents/${docId}`), {
        status: "parsed",
        pages: 10,
      });

      return { success: true };
    } catch (err: unknown) {
      console.error(err);
      await update(ref(db, `documents/${docId}`), {
        status: "failed",
      });
      return { success: false, error: err instanceof Error ? err.message : "Parsing failed" };
    }
  });

type GenerateParams = {
  jobId: string;
};

type JobData = {
  docId: string;
  nodeIds: string[];
  counts: {
    mcq: number;
    multi: number;
    fill: number;
    tf: number;
    match: number;
    coding: number;
  };
  difficulty: "easy" | "medium" | "hard" | "mixed";
  createdBy: string;
};

export const generateAiQuestions = createServerFn({ method: "POST" })
  .validator((d: GenerateParams) => d)
  .handler(async ({ data }) => {
    const { jobId } = data;
    const db = getFirebaseDb();

    try {
      // 1. Update job to running
      await update(ref(db, `generationJobs/${jobId}`), {
        status: "running",
      });

      // Fetch Job Parameters
      const jobSnap = await get(ref(db, `generationJobs/${jobId}`));
      if (!jobSnap.exists()) throw new Error("Job parameters not found");
      const job = jobSnap.val() as JobData;

      // Simulate AI generation wait time
      await new Promise((r) => setTimeout(r, 4000));

      // Fetch Categories to assign a valid category if one exists
      const catSnap = await get(ref(db, "categories"));
      let defaultCatId = "";
      if (catSnap.exists()) {
        defaultCatId = Object.keys(catSnap.val() as object)[0] || "";
      }

      let producedCount = 0;

      // 2. Generate and check duplicates for each requested type
      const counts = job.counts;
      const difficulty = job.difficulty === "mixed" ? "medium" : job.difficulty;

      // MCQs
      for (let i = 0; i < (counts.mcq || 0); i++) {
        const qRef = push(ref(db, "questionBank"));
        await set(qRef, {
          type: "mcq",
          text: `AI MCQ Question ${producedCount + 1}: What core trade-off is analyzed by the CAP theorem in distributed computing databases?`,
          options: [
            { id: "a", text: "Consistency, Availability, and Partition Tolerance", correct: true },
            { id: "b", text: "Concurrency, Accuracy, and Performance", correct: false },
            { id: "c", text: "Caching, Algorithms, and Ports", correct: false },
            { id: "d", text: "Compilation, Arrays, and Pointers", correct: false },
          ],
          answer: "a",
          explanation:
            "The CAP theorem states that a distributed data store can simultaneously provide at most two of three guarantees: Consistency, Availability, and Partition tolerance.",
          categoryId: defaultCatId,
          subcategoryId: "",
          difficulty,
          marks: 1,
          negativeMarks: 0.25,
          source: "ai",
          status: "draft",
          embedding: [0.1, -0.2, 0.45, 0.88], // Mock question vector
          createdBy: "ai-generator",
          createdAt: serverTimestamp(),
        });
        producedCount++;
      }

      // Multi-Selects
      for (let i = 0; i < (counts.multi || 0); i++) {
        const qRef = push(ref(db, "questionBank"));
        await set(qRef, {
          type: "multi",
          text: `AI Multi-Select Question ${producedCount + 1}: Which of the following guarantees are analyzed by the CAP Theorem?`,
          options: [
            { id: "a", text: "Consistency", correct: true },
            { id: "b", text: "Availability", correct: true },
            { id: "c", text: "Partition Tolerance", correct: true },
            { id: "d", text: "Performance Speed", correct: false },
          ],
          answer: ["a", "b", "c"],
          explanation:
            "CAP theorem outlines consistency, availability, and partition tolerance trade-offs.",
          categoryId: defaultCatId,
          subcategoryId: "",
          difficulty,
          marks: 2,
          negativeMarks: 0,
          source: "ai",
          status: "draft",
          embedding: [0.12, -0.25, 0.49, 0.81],
          createdBy: "ai-generator",
          createdAt: serverTimestamp(),
        });
        producedCount++;
      }

      // Fill in Blanks
      for (let i = 0; i < (counts.fill || 0); i++) {
        const qRef = push(ref(db, "questionBank"));
        await set(qRef, {
          type: "fill",
          text: `AI Fill-in-Blank ${producedCount + 1}: Modern systems explore scaling using horizontal ___ to partition database records.`,
          answer: "sharding",
          explanation:
            "Horizontal sharding partitions database records across multiple database server nodes.",
          categoryId: defaultCatId,
          subcategoryId: "",
          difficulty,
          marks: 1,
          negativeMarks: 0,
          source: "ai",
          status: "draft",
          embedding: [0.2, -0.3, 0.4, 0.9],
          createdBy: "ai-generator",
          createdAt: serverTimestamp(),
        });
        producedCount++;
      }

      // True/False
      for (let i = 0; i < (counts.tf || 0); i++) {
        const qRef = push(ref(db, "questionBank"));
        await set(qRef, {
          type: "tf",
          text: `AI True/False Statement ${producedCount + 1}: The CAP theorem asserts that distributed stores can provide Consistency, Availability and Partition tolerance simultaneously under partition failures.`,
          answer: "false",
          explanation:
            "No, distributed systems cannot guarantee all three simultaneously under network partitions.",
          categoryId: defaultCatId,
          subcategoryId: "",
          difficulty,
          marks: 1,
          negativeMarks: 0.5,
          source: "ai",
          status: "draft",
          embedding: [0.22, -0.19, 0.41, 0.89],
          createdBy: "ai-generator",
          createdAt: serverTimestamp(),
        });
        producedCount++;
      }

      // Matching Columns
      for (let i = 0; i < (counts.match || 0); i++) {
        const qRef = push(ref(db, "questionBank"));
        await set(qRef, {
          type: "match",
          text: `AI Column Match ${producedCount + 1}: Match computational systems with their corresponding concepts:`,
          matchLeft: [
            { id: "1", text: "CAP Theorem" },
            { id: "2", text: "Turing Machine" },
          ],
          matchRight: [
            { id: "a", text: "Partition Guarantees" },
            { id: "b", text: "Complexity Limits" },
          ],
          answer: { "1": "a", "2": "b" },
          explanation:
            "CAP evaluates partition tolerance, while Turing machines examine computational limits.",
          categoryId: defaultCatId,
          subcategoryId: "",
          difficulty,
          marks: 2,
          negativeMarks: 0,
          source: "ai",
          status: "draft",
          embedding: [0.3, -0.21, 0.5, 0.77],
          createdBy: "ai-generator",
          createdAt: serverTimestamp(),
        });
        producedCount++;
      }

      // Coding Stubs
      for (let i = 0; i < (counts.coding || 0); i++) {
        const qRef = push(ref(db, "questionBank"));
        await set(qRef, {
          type: "coding",
          text: `AI Coding Challenge ${producedCount + 1}: Write a function fibonacci(n) that returns the nth fibonacci number.`,
          codingLanguage: "javascript",
          codingTemplate: "function fibonacci(n) {\n  // Write solution here\n}",
          codingTests:
            "assert(fibonacci(1) === 1);\nassert(fibonacci(2) === 1);\nassert(fibonacci(5) === 5);",
          answer: "template",
          explanation: "Fibonacci numbers follow f(n) = f(n-1) + f(n-2) with base cases 1, 1.",
          categoryId: defaultCatId,
          subcategoryId: "",
          difficulty,
          marks: 5,
          negativeMarks: 0,
          source: "ai",
          status: "draft",
          embedding: [0.05, -0.09, 0.6, 0.6],
          createdBy: "ai-generator",
          createdAt: serverTimestamp(),
        });
        producedCount++;
      }

      // 3. Mark job as complete
      await update(ref(db, `generationJobs/${jobId}`), {
        status: "done",
        producedCount,
      });

      return { success: true, count: producedCount };
    } catch (err: unknown) {
      console.error(err);
      await update(ref(db, `generationJobs/${jobId}`), {
        status: "failed",
        error: err instanceof Error ? err.message : "AI Generation failed",
      });
      return { success: false, error: err instanceof Error ? err.message : "AI Generation failed" };
    }
  });
