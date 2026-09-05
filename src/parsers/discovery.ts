import * as path from "node:path";
import { DiscoveredTest, DiscoveryResult } from "./types.js";

export function discoverCocotbTests(filePath: string, fileContent: string): DiscoveryResult {
  const tests: DiscoveredTest[] = [];
  const lines = fileContent.split("\n");
  const moduleName = path.basename(filePath, ".py");

  let waitingForFunc = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith("@cocotb.test")) {
      waitingForFunc = true;
      continue;
    }

    if (waitingForFunc) {
      const funcMatch = line.match(/^async\s+def\s+([a-zA-Z0-9_]+)\s*\(/);
      if (funcMatch) {
        const testName = funcMatch[1];
        const lineNum = i + 1;

        // Check for immediate docstring on following lines
        let docstring: string | undefined;
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          if (nextLine.startsWith('"""') || nextLine.startsWith("'''")) {
            docstring = nextLine.replace(/^['"]{3}/, "").replace(/['"]{3}$/, "").trim();
          }
        }

        tests.push({
          name: testName,
          line: lineNum,
          docstring: docstring || undefined,
        });

        waitingForFunc = false;
      } else if (!line.startsWith("@") && line.length > 0) {
        // Interrupted by non-decorator line
        waitingForFunc = false;
      }
    }
  }

  return {
    file: filePath,
    moduleName,
    totalTests: tests.length,
    tests,
  };
}
