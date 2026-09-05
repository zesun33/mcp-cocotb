import * as fs from "node:fs/promises";
import * as path from "node:path";
import { ToolRunner } from "../runner.js";
import { parseCocotbXml } from "../parsers/xml.js";
import { generateCocotbMakefile } from "./generate.js";
import { CocotbRunResult } from "../parsers/types.js";

export interface RunCocotbOptions {
  verilogSources: string[];
  toplevel: string;
  pythonModule: string;
  cwd?: string;
  timeoutMs?: number;
  simulator?: string;
  dumpWaves?: boolean;
}

export async function runCocotb(
  runner: ToolRunner,
  options: RunCocotbOptions
): Promise<CocotbRunResult> {
  const resolvedDir = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const makefileName = `.Makefile.cocotb.${Date.now()}`;
  const makefilePath = path.join(resolvedDir, makefileName);

  const makefileContent = generateCocotbMakefile({
    verilogSources: options.verilogSources,
    toplevel: options.toplevel,
    pythonModule: options.pythonModule,
    simulator: options.simulator || "icarus",
  });

  try {
    // 1. Write temporary makefile
    await fs.writeFile(makefilePath, makefileContent, "utf-8");

    // 2. Execute make inside container
    const env: Record<string, string> = {
      SIM: options.simulator || "icarus",
      TOPLEVEL_LANG: "verilog",
      MODULE: options.pythonModule,
      TOPLEVEL: options.toplevel,
    };

    if (options.dumpWaves) {
      env["COCOTB_RESOLVE_X"] = "ZEROS";
    }

    const execRes = await runner.execute(
      "make",
      ["-f", makefileName],
      {
        cwd: resolvedDir,
        timeoutMs: options.timeoutMs || 30000,
        env,
      }
    );

    // 3. Look for results.xml in cwd or sim_build/
    let xmlContent = "";
    let xmlPathFound = "";

    const candidatePaths = [
      path.join(resolvedDir, "results.xml"),
      path.join(resolvedDir, "sim_build", "results.xml"),
    ];

    for (const p of candidatePaths) {
      try {
        xmlContent = await fs.readFile(p, "utf-8");
        xmlPathFound = p;
        break;
      } catch {
        // Continue searching
      }
    }

    if (!xmlContent) {
      return {
        success: false,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        durationSeconds: 0,
        tests: [],
        rawStdout: execRes.stdout,
        rawStderr: execRes.stderr,
        errors: [
          execRes.timedOut
            ? `Cocotb run timed out after ${options.timeoutMs || 30000}ms.`
            : `Simulation failed: results.xml not generated. Exit code: ${execRes.exitCode}`,
        ],
      };
    }

    const result = parseCocotbXml(xmlContent, execRes.stdout, execRes.stderr);
    result.resultsXmlPath = xmlPathFound;
    return result;
  } finally {
    // Cleanup temporary makefile
    try {
      await fs.unlink(makefilePath);
    } catch {
      // Ignore cleanup error
    }
  }
}
