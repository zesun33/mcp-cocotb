import { XMLParser } from "fast-xml-parser";
import { CocotbRunResult, TestCaseResult, TestStatus } from "./types.js";

export function parseCocotbXml(
  xmlContent: string,
  rawStdout: string = "",
  rawStderr: string = ""
): CocotbRunResult {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
  });

  let parsed: any;
  try {
    parsed = parser.parse(xmlContent);
  } catch (err: unknown) {
    return {
      success: false,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      durationSeconds: 0,
      tests: [],
      rawStdout,
      rawStderr,
      errors: [`XML Parse Error: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  const tests: TestCaseResult[] = [];
  let totalDuration = 0;

  // Locate testsuite or testsuites
  const suitesRoot = parsed?.testsuites?.testsuite ?? parsed?.testsuite;
  const suitesArray = Array.isArray(suitesRoot) ? suitesRoot : suitesRoot ? [suitesRoot] : [];

  for (const suite of suitesArray) {
    const casesRoot = suite?.testcase;
    const casesArray = Array.isArray(casesRoot) ? casesRoot : casesRoot ? [casesRoot] : [];

    for (const tc of casesArray) {
      const name = tc["@_name"] || "unknown_test";
      const classname = tc["@_classname"] || "unknown_module";
      const timeSeconds = parseFloat(tc["@_time"] || "0") || 0;
      totalDuration += timeSeconds;

      let status: TestStatus = "pass";
      let failureMessage: string | undefined;
      let failureType: string | undefined;
      let traceback: string | undefined;

      if (tc.failure) {
        status = "fail";
        failureMessage = tc.failure["@_message"];
        failureType = tc.failure["@_type"];
        traceback = typeof tc.failure === "string" ? tc.failure : tc.failure["#text"];
      } else if (tc.error) {
        status = "error";
        failureMessage = tc.error["@_message"];
        failureType = tc.error["@_type"];
        traceback = typeof tc.error === "string" ? tc.error : tc.error["#text"];
      } else if (tc.skipped) {
        status = "skip";
      }

      tests.push({
        name,
        classname,
        timeSeconds,
        status,
        failureMessage: failureMessage?.trim(),
        failureType: failureType?.trim(),
        traceback: traceback?.trim(),
      });
    }
  }

  const failedTests = tests.filter((t) => t.status === "fail" || t.status === "error").length;
  const passedTests = tests.filter((t) => t.status === "pass").length;

  const errors: string[] = [];
  for (const t of tests) {
    if (t.status === "fail" || t.status === "error") {
      const msg = t.failureMessage ? `: ${t.failureMessage}` : "";
      errors.push(`${t.name} (${t.classname})${msg}`);
    }
  }

  return {
    success: failedTests === 0 && tests.length > 0,
    totalTests: tests.length,
    passedTests,
    failedTests,
    durationSeconds: totalDuration,
    tests,
    rawStdout,
    rawStderr,
    errors,
  };
}
