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

const SUPPORTED_SIMS = ["icarus", "verilator"] as const;
const MIN_VERILATOR = [5, 36] as const;

function parseVerilatorVersion(out: string): [number, number] | null {
  const m = out.match(/Verilator\s+(\d+)\.(\d+)/);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10)];
}

async function collectWaveFiles(dir: string): Promise<string[]> {
  const found: string[] = [];
  const scan = async (d: string) => {
    let entries: string[] = [];
    try {
      entries = await fs.readdir(d);
    } catch {
      return;
    }
    for (const e of entries) {
      if (/\.(fst|vcd|fst\.hier)$/i.test(e)) found.push(path.relative(dir, path.join(d, e)));
    }
  };
  await scan(dir);
  await scan(path.join(dir, "sim_build"));
  return [...new Set(found)].sort();
}

export async function runCocotb(
  runner: ToolRunner,
  options: RunCocotbOptions
): Promise<CocotbRunResult> {
  const resolvedDir = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const sim = options.simulator || "icarus";

  if (!(SUPPORTED_SIMS as readonly string[]).includes(sim)) {
    return {
      success: false,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      durationSeconds: 0,
      simulator: sim,
      waveFiles: [],
      tests: [],
      rawStdout: "",
      rawStderr: "",
      errors: [`Unsupported simulator "${sim}". Supported: ${(SUPPORTED_SIMS as readonly string[]).join(", ")}.`],
    };
  }

  // cocotb 2.x requires Verilator >= 5.036; fail fast with guidance
  // instead of a cryptic missing-results.xml after a long build.
  if (sim === "verilator") {
    const ver = await runner.execute("verilator", ["--version"], { cwd: resolvedDir });
    const parsed = parseVerilatorVersion(`${ver.stdout}\n${ver.stderr}`);
    if (!parsed || parsed[0] < MIN_VERILATOR[0] || (parsed[0] === MIN_VERILATOR[0] && parsed[1] < MIN_VERILATOR[1])) {
      const have = parsed ? `${parsed[0]}.${parsed[1].toString().padStart(3, "0")}` : "unknown";
      return {
        success: false,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        durationSeconds: 0,
        simulator: sim,
        waveFiles: [],
        tests: [],
        rawStdout: ver.stdout,
        rawStderr: ver.stderr,
        errors: [
          `SIM=verilator needs Verilator >= 5.036 (cocotb 2.x requirement), found ${have}. Use simulator "icarus", or upgrade Verilator in the container image (no apt upgrade path on Ubuntu 24.04; build from source).`,
        ],
      };
    }
  }
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
      SIM: sim,
      TOPLEVEL_LANG: "verilog",
      MODULE: options.pythonModule,
      TOPLEVEL: options.toplevel,
    };

    // WAVES=1 makes the stock cocotb makefiles dump FST/VCD (sim_build/).
    if (options.dumpWaves) {
      env["WAVES"] = "1";
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

    const waveFiles = await collectWaveFiles(resolvedDir);

    if (!xmlContent) {
      return {
        success: false,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        durationSeconds: 0,
        simulator: sim,
        waveFiles,
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
    result.simulator = sim;
    result.waveFiles = waveFiles;
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
