import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { discoverCocotbTests } from "../src/parsers/discovery.js";

test("discoverCocotbTests identifies all @cocotb.test functions and docstrings", () => {
  const fixturePath = path.resolve("fixtures", "test_dff.py");
  const content = fs.readFileSync(fixturePath, "utf-8");

  const res = discoverCocotbTests(fixturePath, content);
  assert.equal(res.totalTests, 3);
  assert.equal(res.moduleName, "test_dff");

  const names = res.tests.map((t) => t.name);
  assert.deepEqual(names, ["test_dff_reset", "test_dff_toggle", "test_dff_failing_assert"]);

  assert.ok(res.tests[0].docstring?.includes("Test that reset initializes output"));
});
