import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { Store } from "../lib/store.js";
import { Engine } from "../lib/engine.js";
import { Scheduler, nextAt } from "../lib/scheduler.js";
import { blankTemplate, paperTemplate } from "../lib/templates.js";
import { validateDefinition, pointer } from "../lib/definition.js";
const parent = { session: { id: "session" } };
const adapter = {
  rootRoute: () => ({ provider: "test", model: "root" }),
  route: async (n) => ({
    provider: n.provider?.id ?? "test",
    model: n.model?.id ?? "root",
  }),
  skills: async () => [],
  agent: async (_n, input) => ({ text: input.material }),
  tool: async () => ({ done: true }),
};
async function fixture(t, custom = adapter) {
  const directory = await mkdtemp("/private/tmp/workflow-core-");
  const store = new Store(`${directory}/db.sqlite`);
  const engine = new Engine(store, custom, directory);
  t.after(async () => {
    await store.beforeClose?.();
    await engine.close();
    store.close();
    await rm(directory, { recursive: true, force: true });
  });
  return { store, engine, directory };
}
test("definition validates templates, rejects cycles and undeclared dependencies", () => {
  validateDefinition(paperTemplate());
  const d = blankTemplate("x");
  d.edges.push({ from: "output", to: "task" });
  assert.throws(() => validateDefinition(d), /CYCLE/);
  d.edges = [];
  assert.throws(() => validateDefinition(d), /INPUT_DEPENDENCY/);
  assert.throws(() => pointer({}, "/__proto__"), /MISSING_INPUT/);
});
test("revision CAS and session references preserve immutable versions", async (t) => {
  const { store } = await fixture(t);
  const d = blankTemplate("x");
  store.save(d);
  store.publish("x", 1);
  store.bind("s", "x", 1);
  d.name = "Changed";
  store.save(d, 1);
  assert.equal(store.get("revision", "x:1").definition.name, "新工作流");
  assert.equal(store.get("binding", "s").revision, 1);
  assert.throws(() => store.save(d, 1), /REVISION_CONFLICT/);
  assert.equal(store.list("reference").length, 1);
});
test("graph runs with frozen routing and durable artifact", async (t) => {
  const { store, engine } = await fixture(t);
  const d = blankTemplate("x");
  d.nodes[0].model = { mode: "explicit", id: "special" };
  store.save(d);
  const run = await engine.start({
    workflowId: "x",
    revision: 1,
    input: { text: "article" },
    parent,
  });
  assert.equal(run.status, "completed", run.error);
  assert.equal(run.prepared.routes.task.model, "special");
  assert.equal(store.list("artifact").length, 1);
  assert.equal(run.nodes.output.output.text, "article");
  assert(store.events(run.id).some((e) => e.type === "node.completed"));
});
test("schema mismatch fails downstream without producing artifact", async (t) => {
  const { store, engine } = await fixture(t);
  const d = blankTemplate("x");
  d.nodes[0].outputSchema = {
    type: "object",
    required: ["evidence"],
    properties: { evidence: { type: "array" } },
  };
  store.save(d);
  const run = await engine.start({
    workflowId: "x",
    revision: 1,
    input: { text: "article" },
    parent,
  });
  assert.equal(run.status, "failed");
  assert.match(run.error, /OUTPUT_SCHEMA/);
  assert.equal(store.list("artifact").length, 0);
});
test("approval resumes with completed checkpoints intact", async (t) => {
  let calls = 0;
  const { store, engine } = await fixture(t, {
    ...adapter,
    agent: async () => {
      calls++;
      return { text: "done" };
    },
  });
  const d = blankTemplate("x");
  d.nodes.push({ id: "gate", name: "Approve", kind: "approval" });
  d.edges = [
    { from: "task", to: "gate" },
    { from: "gate", to: "output" },
  ];
  store.save(d);
  let run = await engine.start({
    workflowId: "x",
    revision: 1,
    input: { text: "x" },
    parent,
  });
  assert.equal(run.status, "waiting_approval");
  run = await engine.resume(run.id, parent, undefined, true);
  assert.equal(run.status, "completed", run.error);
  assert.equal(calls, 1);
});
test("unattended tool permission is persisted and can be resumed explicitly", async (t) => {
  let calls = 0;
  const { store, engine } = await fixture(t, {
    ...adapter,
    tool: async () => {
      calls++;
      return { done: true };
    },
  });
  store.save({
    schemaVersion: "1.0",
    id: "x",
    name: "x",
    nodes: [{ id: "t", kind: "tool", name: "t", tool: "write", input: {} }],
    edges: [],
  });
  let run = await engine.start({
    workflowId: "x",
    revision: 1,
    input: {},
    parent,
    unattended: { tools: [] },
  });
  assert.equal(run.status, "waiting_approval");
  assert.equal(calls, 0);
  run = await engine.resume(run.id, parent, undefined, true);
  assert.equal(run.status, "completed");
  assert.equal(calls, 1);
});
test("condition skips inactive branch", async (t) => {
  const { store, engine } = await fixture(t);
  store.save({
    schemaVersion: "1.0",
    id: "x",
    name: "x",
    nodes: [
      { id: "c", name: "c", kind: "condition", condition: { "==": [1, 1] } },
      { id: "yes", name: "yes", kind: "input" },
      { id: "no", name: "no", kind: "input" },
    ],
    edges: [
      { from: "c", to: "yes", on: "true" },
      { from: "c", to: "no", on: "false" },
    ],
  });
  const run = await engine.start({
    workflowId: "x",
    revision: 1,
    input: {},
    parent,
  });
  assert.equal(run.status, "completed");
  assert.equal(run.nodes.no.status, "skipped");
  assert.equal(run.nodes.yes.status, "completed");
});
test("process ownership excludes a second live Host", async (t) => {
  const { store, directory } = await fixture(t);
  store.acquireHost();
  const other = new Store(`${directory}/db.sqlite`);
  assert.throws(() => other.acquireHost(), /HOST_ALREADY_RUNNING/);
  other.close();
});
test("scheduler validates IANA zone and DST gap/overlap semantics", () => {
  const plan = {
    kind: "cron",
    cron: "30 2 * * *",
    timezone: "America/New_York",
  };
  assert.equal(
    new Date(nextAt(plan, Date.parse("2026-03-08T05:00Z"))).toISOString(),
    "2026-03-09T06:30:00.000Z",
  );
  plan.cron = "30 1 * * *";
  assert.equal(
    new Date(nextAt(plan, Date.parse("2026-11-01T04:00Z"))).toISOString(),
    "2026-11-01T05:30:00.000Z",
  );
  assert.equal(
    new Date(nextAt(plan, Date.parse("2026-11-01T05:31Z"))).toISOString(),
    "2026-11-02T06:30:00.000Z",
  );
  assert.throws(() => nextAt({ ...plan, timezone: "Not/AZone" }));
});
test("scheduler claims once, queues latest overlap and dispatches after settlement", async (t) => {
  const { store } = await fixture(t);
  store.save(blankTemplate("x"));
  let now = 1000000;
  let finish;
  const fired = [];
  const scheduler = new Scheduler(
    store,
    async (o) => {
      fired.push(o);
      await new Promise((r) => {
        finish = r;
      });
      return { id: o.runId, status: "completed" };
    },
    { clock: () => now },
  );
  store.beforeClose = () => scheduler.close();
  const plan = scheduler.save({
    workflowId: "x",
    workflowRevision: 1,
    rootRoute: { provider: "test", model: "root" },
    cwd: "/tmp",
    input: { text: "x" },
    enabled: true,
    kind: "interval",
    seconds: 60,
    overlap: "latest",
    missed: "skip",
  });
  now += 60000;
  await scheduler.tick();
  await scheduler.tick();
  assert.equal(fired.length, 1);
  now += 60000;
  await scheduler.tick();
  assert.equal(fired.length, 1);
  finish();
  await Promise.all(scheduler.pending);
  await scheduler.tick();
  assert.equal(fired.length, 2);
  finish();
  await Promise.all(scheduler.pending);
  assert.equal(store.list("occurrence").length, 2);
  assert(store.get("schedule", plan.id).nextAt > now);
});
test("parallel approval preserves completed sibling without repeating its effects", async (t) => {
  let calls = 0;
  const { store, engine } = await fixture(t, {
    ...adapter,
    tool: async () => {
      calls++;
      return { done: true };
    },
  });
  store.save({
    schemaVersion: "1.0",
    id: "x",
    name: "x",
    nodes: [
      { id: "gate", kind: "approval", name: "gate" },
      { id: "write", kind: "tool", name: "write", tool: "write" },
    ],
    edges: [],
  });
  let run = await engine.start({
    workflowId: "x",
    revision: 1,
    input: {},
    parent,
  });
  assert.equal(run.status, "waiting_approval");
  assert.equal(run.nodes.write.status, "completed");
  run = await engine.resume(run.id, parent, undefined, true);
  assert.equal(run.status, "completed");
  assert.equal(calls, 1);
});
test("restart marks interrupted runs for inspection", async (t) => {
  const { store, engine } = await fixture(t);
  store.put("run", "interrupted", { id: "interrupted", status: "running" });
  engine.recover();
  assert.equal(store.get("run", "interrupted").status, "needs_attention");
});
