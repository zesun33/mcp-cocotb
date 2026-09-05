import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { ToolRunner } from "./runner.js";
import { runCocotb } from "./tools/run.js";
import { runListTests } from "./tools/list.js";
import { generateCocotbMakefile } from "./tools/generate.js";
import { getCocotbToolchainInfo } from "./tools/toolchain.js";

export function createServer(runner: ToolRunner = new ToolRunner()): Server {
  const server = new Server(
    {
      name: "mcp-cocotb",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const tools: Tool[] = [
    {
      name: "cocotb_run",
      description:
        "Compiles a Verilog DUT, executes an asynchronous Python cocotb testbench, and parses results into structured JSON test reports with assertion tracebacks.",
      inputSchema: {
        type: "object",
        properties: {
          verilog_sources: {
            type: "array",
            items: { type: "string" },
            description: "List of Verilog/SystemVerilog source files for the DUT.",
          },
          toplevel: {
            type: "string",
            description: "Name of the top-level Verilog module.",
          },
          python_module: {
            type: "string",
            description: "Name of the Python test module (e.g. 'test_dff' for test_dff.py).",
          },
          cwd: {
            type: "string",
            description: "Working directory where the files reside.",
          },
          timeout_ms: {
            type: "number",
            description: "Maximum simulation timeout in milliseconds (default: 30000).",
          },
          simulator: {
            type: "string",
            enum: ["icarus", "verilator"],
            description: "Simulator engine to use (default: 'icarus').",
          },
          dump_waves: {
            type: "boolean",
            description: "Whether to record VCD waveforms.",
          },
        },
        required: ["verilog_sources", "toplevel", "python_module"],
      },
    },
    {
      name: "cocotb_list_tests",
      description:
        "Discovers all @cocotb.test() coroutines and their docstrings in a Python testbench file without executing simulation.",
      inputSchema: {
        type: "object",
        properties: {
          test_file: {
            type: "string",
            description: "Path to the Python testbench file (e.g. 'test_dff.py').",
          },
          cwd: {
            type: "string",
            description: "Optional working directory.",
          },
        },
        required: ["test_file"],
      },
    },
    {
      name: "cocotb_generate_runner",
      description:
        "Generates a deterministic, standard Cocotb simulation Makefile for a given Verilog DUT and Python test module.",
      inputSchema: {
        type: "object",
        properties: {
          verilog_sources: {
            type: "array",
            items: { type: "string" },
            description: "List of Verilog source files.",
          },
          toplevel: {
            type: "string",
            description: "Top-level Verilog module name.",
          },
          python_module: {
            type: "string",
            description: "Python test module name (without .py).",
          },
          simulator: {
            type: "string",
            description: "Simulator backend (default: 'icarus').",
          },
        },
        required: ["verilog_sources", "toplevel", "python_module"],
      },
    },
    {
      name: "cocotb_toolchain_info",
      description:
        "Returns active container or host execution runtime info and versions of Cocotb, Python, and simulator.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    try {
      switch (name) {
        case "cocotb_run": {
          const verilogSources = (args.verilog_sources as string[]) || [];
          const toplevel = args.toplevel as string;
          const pythonModule = args.python_module as string;
          const cwd = args.cwd as string | undefined;
          const timeoutMs = typeof args.timeout_ms === "number" ? args.timeout_ms : 30000;
          const simulator = (args.simulator as string) || "icarus";
          const dumpWaves = Boolean(args.dump_waves);

          const result = await runCocotb(runner, {
            verilogSources,
            toplevel,
            pythonModule,
            cwd,
            timeoutMs,
            simulator,
            dumpWaves,
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "cocotb_list_tests": {
          const testFile = args.test_file as string;
          const cwd = args.cwd as string | undefined;
          const result = await runListTests(testFile, cwd);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "cocotb_generate_runner": {
          const verilogSources = (args.verilog_sources as string[]) || [];
          const toplevel = args.toplevel as string;
          const pythonModule = args.python_module as string;
          const simulator = args.simulator as string | undefined;

          const makefile = generateCocotbMakefile({
            verilogSources,
            toplevel,
            pythonModule,
            simulator,
          });

          return {
            content: [
              {
                type: "text",
                text: makefile,
              },
            ],
          };
        }

        case "cocotb_toolchain_info": {
          const result = await getCocotbToolchainInfo(runner);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        default:
          return {
            content: [
              {
                type: "text",
                text: `Error: Unknown tool "${name}".`,
              },
            ],
            isError: true,
          };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [
          {
            type: "text",
            text: `Tool execution failed: ${message}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}
