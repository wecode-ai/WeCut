import assert from "node:assert/strict";
import test from "node:test";
import { runDockAction } from "./dockAction.js";

test("runDockAction freezes the dock, runs the action, then hides the window", async () => {
  const calls: string[] = [];

  const result = await runDockAction({
    action: async () => {
      calls.push("action");
      return "ok";
    },
    afterHide: () => {
      calls.push("release");
    },
    beforeAction: () => {
      calls.push("freeze");
    },
    hideWindow: async () => {
      calls.push("hide");
    },
    onResult: (value) => {
      calls.push(`result:${value}`);
    },
  });

  assert.equal(result, "ok");
  assert.deepEqual(calls, ["freeze", "action", "result:ok", "hide", "release"]);
});
