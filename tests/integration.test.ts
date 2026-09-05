import test from "node:test";
import assert from "node:assert/strict";
import * as path from "node:path";
import { ToolRunner } from "../src/runner.js";
import { runCocotb } from "../src/tools/run.js";
import { runListTests } from "../src/tools/list.js";
import { generateCocotbMakefile } from "../src/tools/generate.js";
import { getCocotbToolchainInfo } from "../src/tools/toolchain.js";

const runner = new ToolRunner();
const fixturesDir = path.resolve("fixtures");

test("Integration: cocotb_toolchain_info probes container Cocotb and Python", async () => {
  const info = await getCocotbToolchainInfo(runner);
  assert.equal(info.runtime, "podman");
  assert.ok(info.cocotbVersion.includes("2."), `Expected Cocotb 2.x, got: ${info.cocotbVersion}`);
  assert.ok(info.pythonVersion.includes("3.12"), `Expected Python 3.12, got: ${info.pythonVersion}`);
  assert.ok(info.simulator.includes("iverilog"));
});

test("Integration: cocotb_list_tests discovers tests in test_dff.py", async () => {
  const res = await runListTests("test_dff.py", fixturesDir);
  assert.equal(res.totalTests, 3);
  assert.ok(res.tests.some((t) => t.name === "test_dff_reset"));
  assert.ok(res.tests.some((t) => t.name === "test_dff_toggle"));
});

test("Integration: cocotb_generate_runner produces valid Makefile", () => {
  const makefile = generateCocotbMakefile({
    verilogSources: ["dff.v"],
    toplevel: "dff",
    pythonModule: "test_dff",
    simulator: "icarus",
  });

  assert.ok(makefile.includes("TOPLEVEL = dff"));
  assert.ok(makefile.includes("MODULE = test_dff"));
  assert.ok(makefile.includes("Makefile.sim"));
});

test("Integration: cocotb_run compiles and executes test_dff against dff.v", async () => {
  const res = await runCocotb(runner, {
    verilogSources: ["dff.v"],
    toplevel: "dff",
    pythonModule: "test_dff",
    cwd: fixturesDir,
    timeoutMs: 40000,
  });

  assert.ok(res.totalTests >= 3, `Expected at least 3 tests, got ${res.totalTests}`);
  assert.ok(res.passedTests >= 2, `Expected at least 2 passing tests, got ${res.passedTests}`);
  assert.equal(res.failedTests, 1, `Expected 1 failing test, got ${res.failedTests}`);

  const failingTest = res.tests.find((t) => t.status === "fail");
  assert.ok(failingTest, "Should capture failing test");
  assert.equal(failingTest.name, "test_dff_failing_assert");
  assert.ok(failingTest.traceback?.includes("INTENTIONAL_ASSERTION_FAILURE"));
});
