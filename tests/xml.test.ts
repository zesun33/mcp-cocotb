import test from "node:test";
import assert from "node:assert/strict";
import { parseCocotbXml } from "../src/parsers/xml.js";

test("parseCocotbXml parses passing Cocotb JUnit report", () => {
  const xml = `
<testsuites name="results">
  <testsuite name="all" package="all">
    <property name="random_seed" value="1725530000"/>
    <testcase classname="test_dff" name="test_dff_reset" time="0.005" sim_time_ns="20.0" ratio_time="4000.0" />
    <testcase classname="test_dff" name="test_dff_toggle" time="0.008" sim_time_ns="35.0" ratio_time="4375.0" />
  </testsuite>
</testsuites>
`;

  const res = parseCocotbXml(xml);
  assert.equal(res.success, true);
  assert.equal(res.totalTests, 2);
  assert.equal(res.passedTests, 2);
  assert.equal(res.failedTests, 0);
  assert.equal(res.tests[0].name, "test_dff_reset");
  assert.equal(res.tests[0].status, "pass");
  assert.equal(res.tests[1].name, "test_dff_toggle");
  assert.equal(res.tests[1].status, "pass");
});

test("parseCocotbXml parses failing assertions with tracebacks", () => {
  const xml = `
<testsuites name="results">
  <testsuite name="all" package="all">
    <testcase classname="test_dff" name="test_dff_reset" time="0.005" sim_time_ns="20.0" />
    <testcase classname="test_dff" name="test_dff_failing" time="0.003" sim_time_ns="20.0">
      <failure message="assert 0 == 1" type="AssertionError">
Traceback (most recent call last):
  File "/workspace/test_dff.py", line 42, in test_dff_failing
    assert dut.q.value == 1
AssertionError: assert 0 == 1
      </failure>
    </testcase>
  </testsuite>
</testsuites>
`;

  const res = parseCocotbXml(xml);
  assert.equal(res.success, false);
  assert.equal(res.totalTests, 2);
  assert.equal(res.passedTests, 1);
  assert.equal(res.failedTests, 1);

  const failed = res.tests.find((t) => t.status === "fail");
  assert.ok(failed, "Failed test must be present");
  assert.equal(failed.name, "test_dff_failing");
  assert.equal(failed.failureType, "AssertionError");
  assert.ok(failed.traceback?.includes("AssertionError: assert 0 == 1"));
});
