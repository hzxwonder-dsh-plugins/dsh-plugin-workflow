import { mkdir, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  checkData,
  evaluateCondition,
  fail,
  mapInputs,
  validateDefinition,
} from "./definition.js";
import { uid, hash } from "./store.js";

const done = new Set(["completed", "skipped"]);
export class Engine {
  constructor(store, adapter, directory) {
    this.store = store;
    this.adapter = adapter;
    this.directory = directory;
    this.active = new Map();
  }
  async prepare(snapshot, parent, rootRoute, signal, chain = []) {
    const def = snapshot.definition;
    validateDefinition(def);
    if (chain.includes(def.id) || chain.length > 8)
      fail("RECURSIVE_WORKFLOW", def.id);
    const prepared = {
      definition: def,
      revision: snapshot.revision,
      hash: snapshot.hash,
      routes: {},
      skills: {},
      children: {},
    };
    for (const node of def.nodes) {
      if (node.kind === "agent") {
        prepared.routes[node.id] = await this.adapter.route(
          node,
          rootRoute,
          signal,
        );
        prepared.skills[node.id] = await this.adapter.skills(
          node.skills ?? [],
          parent,
          signal,
        );
      }
      if (node.workflow) {
        const child = this.store.get(
          "revision",
          `${node.workflow.id}:${node.workflow.revision}`,
        );
        if (!child) fail("REVISION_NOT_FOUND", node.workflow.id);
        prepared.children[node.id] = await this.prepare(
          child,
          parent,
          rootRoute,
          signal,
          [...chain, def.id],
        );
      }
    }
    return prepared;
  }
  async start({
    workflowId,
    revision,
    input,
    parent,
    signal,
    rootRoute,
    unattended,
    runId,
  }) {
    const snapshot = this.store.get("revision", `${workflowId}:${revision}`);
    if (!snapshot) fail("REVISION_NOT_FOUND");
    const options = rootRoute ?? this.adapter.rootRoute(parent);
    const prepared = await this.prepare(snapshot, parent, options, signal);
    checkData(prepared.definition.inputSchema ?? {}, input);
    const run = {
      id: runId ?? uid("run"),
      workflowId,
      revision,
      sessionId: parent.session.id,
      prepared,
      rootRoute: options,
      input,
      inputHash: hash(input),
      unattended: unattended ?? null,
      status: "queued",
      outputs: {},
      nodes: {},
      createdAt: Date.now(),
      calls: 0,
    };
    if (this.store.get("run", run.id)) fail("RUN_EXISTS");
    this.store.updateRun(run, "run.queued");
    return this.drive(run, parent, signal);
  }
  async resume(id, parent, signal, response) {
    const run = this.store.get("run", id);
    if (!run || this.active.has(id)) fail("RUN_NOT_RESUMABLE");
    if (
      ![
        "paused",
        "failed",
        "needs_attention",
        "waiting_approval",
        "cancelled",
      ].includes(run.status)
    )
      fail("RUN_NOT_RESUMABLE");
    for (const [key, state] of Object.entries(run.nodes)) {
      if (state.status === "waiting_approval") {
        if (response === undefined) fail("APPROVAL_RESPONSE_REQUIRED", key);
        if (response === false) {
          run.status = "cancelled";
          return this.store.updateRun(run, "run.cancelled");
        }
        if (state.permissionGate) {
          state.status = "pending";
          run.approvedTools ??= [];
          run.approvedTools.push(key);
        } else {
          state.status = "completed";
          state.output = { approved: true, response };
          run.outputs[key] = state.output;
        }
      } else if (!done.has(state.status)) {
        if (state.effects === "write" && response !== true)
          fail("EFFECT_RECONCILIATION_REQUIRED", key);
        state.status = "pending";
      }
    }
    return this.drive(run, parent, signal);
  }
  async drive(run, parent, signal) {
    const controller = new AbortController();
    const timeout = AbortSignal.timeout(
      (run.prepared.definition.limits?.timeoutSeconds ?? 3600) * 1000,
    );
    const combined = AbortSignal.any([
      controller.signal,
      timeout,
      ...(signal ? [signal] : []),
    ]);
    this.active.set(run.id, controller);
    run.status = "running";
    run.startedAt ??= Date.now();
    run.error = null;
    this.store.updateRun(run, "run.started");
    try {
      await this.executeGraph(
        run.prepared,
        run.input,
        run,
        parent,
        combined,
        "",
      );
      if (Object.values(run.nodes).some((n) => n.status === "waiting_approval"))
        run.status = "waiting_approval";
      else if (controller.signal.reason?.code === "PAUSED")
        run.status = "paused";
      else {
        run.status = "completed";
        run.result = run.prepared.definition.outputs
          ? mapInputs(run.prepared.definition.outputs, run.input, run.outputs)
          : run.outputs;
      }
    } catch (error) {
      const reason = combined.aborted ? combined.reason : error;
      run.status =
        reason?.code === "PAUSED"
          ? "paused"
          : combined.aborted && !timeout.aborted
            ? "cancelled"
            : error.code === "APPROVAL_REQUIRED"
              ? "waiting_approval"
              : "failed";
      run.error = String(reason?.message ?? reason).slice(0, 3000);
    } finally {
      run.endedAt = Date.now();
      this.store.updateRun(run, `run.${run.status}`);
      this.active.delete(run.id);
    }
    return run;
  }
  async executeGraph(prepared, input, run, parent, signal, prefix) {
    const def = prepared.definition;
    checkData(def.inputSchema ?? {}, input);
    const local = {};
    for (const n of def.nodes)
      if (run.nodes[prefix + n.id]?.status === "completed")
        local[n.id] = run.nodes[prefix + n.id].output;
    const pending = new Set(
      def.nodes
        .filter((n) => !done.has(run.nodes[prefix + n.id]?.status))
        .map((n) => n.id),
    );
    while (pending.size) {
      signal.throwIfAborted();
      const ready = def.nodes.filter(
        (n) =>
          pending.has(n.id) &&
          def.edges
            .filter((e) => e.to === n.id)
            .every((e) => done.has(run.nodes[prefix + e.from]?.status)),
      );
      if (!ready.length) {
        if (
          Object.values(run.nodes).some((n) => n.status === "waiting_approval")
        )
          return local;
        fail("GRAPH_BLOCKED");
      }
      const batch = ready.slice(0, def.limits?.concurrency ?? 2);
      const results = await Promise.allSettled(
        batch.map(async (node) => {
          const key = prefix + node.id;
          const incoming = def.edges.filter((e) => e.to === node.id);
          const activeEdges = incoming.filter(
            (e) =>
              run.nodes[prefix + e.from]?.status === "completed" &&
              (!e.on ||
                e.on === "success" ||
                String(local[e.from]?.condition) === e.on),
          );
          if (incoming.length && activeEdges.length === 0) {
            run.nodes[key] = { status: "skipped" };
            this.store.updateRun(run, "node.skipped", { nodeId: key });
            return;
          }
          if (run.nodes[key]?.status === "waiting_approval") return;
          const mapped = mapInputs(node.input, input, local);
          const output = await this.executeNode(
            node,
            mapped,
            prepared,
            run,
            parent,
            signal,
            key,
          );
          if (run.nodes[key].status === "completed") {
            local[node.id] = output;
            run.outputs[key] = output;
          }
        }),
      );
      batch.forEach((n) => pending.delete(n.id));
      const rejected = results.find((r) => r.status === "rejected");
      if (rejected) throw rejected.reason;
      if (Object.values(run.nodes).some((n) => n.status === "waiting_approval"))
        return local;
    }
    return def.outputs ? mapInputs(def.outputs, input, local) : local;
  }
  async executeNode(node, input, prepared, run, parent, signal, key) {
    const old = run.nodes[key];
    const attempts = old?.attempts ?? [];
    const state = (run.nodes[key] = {
      status: "running",
      input,
      effects:
        node.kind === "tool" || node.tools?.length
          ? "write"
          : (node.effects ?? "read-only"),
      attempts,
    });
    if (node.kind === "approval") {
      state.status = "waiting_approval";
      this.store.updateRun(run, "node.waiting_approval", { nodeId: key });
      return;
    }
    const allowed = run.unattended?.tools ?? [];
    if (
      run.unattended &&
      !run.approvedTools?.includes(key) &&
      ((node.kind === "tool" && !allowed.includes(node.tool)) ||
        node.tools?.some((t) => !allowed.includes(t)))
    ) {
      state.status = "waiting_approval";
      state.permissionGate = true;
      this.store.updateRun(run, "node.waiting_approval", { nodeId: key });
      return;
    }
    const maximum = state.effects === "write" ? 1 : (node.maxAttempts ?? 1);
    for (let attempt = 0; attempt < maximum; attempt++) {
      signal.throwIfAborted();
      if (++run.calls > (run.prepared.definition.limits?.maxNodeCalls ?? 100))
        fail("CALL_BUDGET");
      const record = {
        index: attempts.length + 1,
        startedAt: Date.now(),
        route: prepared.routes[node.id] ?? null,
      };
      attempts.push(record);
      this.store.updateRun(run, "node.started", {
        nodeId: key,
        attempt: record.index,
      });
      const deadline = AbortSignal.any([
        signal,
        AbortSignal.timeout((node.timeoutSeconds ?? 600) * 1000),
      ]);
      try {
        let output;
        if (node.kind === "agent")
          output = await this.adapter.agent(
            node,
            input,
            prepared.routes[node.id],
            prepared.skills[node.id],
            parent,
            deadline,
          );
        else if (node.kind === "tool")
          output = await this.adapter.tool(node.tool, input, parent, deadline);
        else if (node.kind === "condition")
          output = { condition: evaluateCondition(node.condition, input) };
        else if (node.kind === "artifact") {
          const folder = join(this.directory, run.id);
          await mkdir(folder, { recursive: true, mode: 0o700 });
          const extension =
            node.format === "application/json"
              ? "json"
              : node.format === "text/plain"
                ? "txt"
                : "md";
          const path = join(
            folder,
            `${key.replace(/[^a-zA-Z0-9_-]/g, "_")}.${extension}`,
          );
          const content =
            typeof input.content === "string"
              ? input.content
              : JSON.stringify(input.content ?? input, null, 2);
          await writeFile(path, content, { mode: 0o600 });
          await stat(path);
          const artifact = {
            id: uid("artifact"),
            runId: run.id,
            path,
            name: `${node.name}.${extension}`,
            mediaType: node.format ?? "text/markdown",
            bytes: Buffer.byteLength(content),
          };
          this.store.put("artifact", artifact.id, artifact);
          output = { artifact: artifact.id, text: content };
        } else if (node.kind === "subworkflow")
          output = await this.executeGraph(
            prepared.children[node.id],
            input,
            run,
            parent,
            deadline,
            `${key}/`,
          );
        else if (node.kind === "loop") {
          if (!Array.isArray(input.items) || input.items.length > node.maxItems)
            fail("LOOP_INPUT_LIMIT", key);
          const values = [];
          for (let i = 0; i < input.items.length; i++)
            values.push(
              await this.executeGraph(
                prepared.children[node.id],
                { item: input.items[i], index: i, ...input.context },
                run,
                parent,
                deadline,
                `${key}/${i}/`,
              ),
            );
          output = { items: values };
        } else output = input;
        deadline.throwIfAborted();
        if (
          Object.entries(run.nodes).some(
            ([id, s]) =>
              id.startsWith(`${key}/`) && s.status === "waiting_approval",
          )
        ) {
          state.status = "pending";
          return;
        }
        if (node.outputSchema)
          checkData(node.outputSchema, output, "OUTPUT_SCHEMA");
        record.endedAt = Date.now();
        record.status = "completed";
        state.output = output;
        state.status = "completed";
        this.store.updateRun(run, "node.completed", { nodeId: key });
        return output;
      } catch (error) {
        record.status = "failed";
        record.endedAt = Date.now();
        record.error = String(error.message).slice(0, 2000);
        state.status = "failed";
        this.store.updateRun(run, "node.failed", {
          nodeId: key,
          error: record.error,
        });
        const transient = /429|503|502|ECONNRESET|ETIMEDOUT|RATE_LIMIT/.test(
          String(error.message),
        );
        if (deadline.aborted || !transient || attempt + 1 >= maximum)
          throw error;
        state.status = "retrying";
        await delay(Math.min(1000 * 2 ** attempt, 8000), undefined, { signal });
      }
    }
  }
  cancel(id, pause = false) {
    const c = this.active.get(id);
    if (!c) fail("RUN_NOT_ACTIVE");
    c.abort(
      Object.assign(new Error(pause ? "Paused" : "Cancelled"), {
        code: pause ? "PAUSED" : "CANCELLED",
      }),
    );
  }
  recover() {
    for (const run of this.store.list("run"))
      if (["queued", "running"].includes(run.status)) {
        run.status = "needs_attention";
        run.error = "Host restarted; review interrupted nodes before resuming.";
        this.store.updateRun(run, "run.interrupted");
      }
  }
  async close() {
    for (const c of this.active.values()) c.abort(new Error("Host stopped"));
    while (this.active.size) await delay(25);
  }
}
