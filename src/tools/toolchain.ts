import { ToolRunner } from "../runner.js";
import { CocotbToolchainInfo } from "../parsers/types.js";

export async function getCocotbToolchainInfo(runner: ToolRunner): Promise<CocotbToolchainInfo> {
  const cocotbRes = await runner.execute("cocotb-config", ["--version"]);
  const pyRes = await runner.execute("python3", ["--version"]);
  const simRes = await runner.execute("iverilog", ["-V"]);

  return {
    runtime: runner.getRuntime(),
    image: runner.getRuntime() !== "host" ? runner.getImageName() : undefined,
    cocotbVersion: cocotbRes.stdout.trim() || "Unknown",
    pythonVersion: pyRes.stdout.trim() || "Unknown",
    simulator: simRes.exitCode === 0 ? "iverilog (Icarus Verilog)" : "Not found",
  };
}
