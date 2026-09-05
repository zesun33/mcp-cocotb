import * as fs from "node:fs/promises";
import * as path from "node:path";
import { discoverCocotbTests } from "../parsers/discovery.js";
import { DiscoveryResult } from "../parsers/types.js";

export async function runListTests(
  testFile: string,
  cwd?: string
): Promise<DiscoveryResult> {
  const resolvedDir = cwd ? path.resolve(cwd) : process.cwd();
  const filePath = path.isAbsolute(testFile) ? testFile : path.join(resolvedDir, testFile);

  try {
    const content = await fs.readFile(filePath, "utf-8");
    return discoverCocotbTests(filePath, content);
  } catch (err: unknown) {
    return {
      file: filePath,
      moduleName: path.basename(testFile, ".py"),
      totalTests: 0,
      tests: [],
    };
  }
}
