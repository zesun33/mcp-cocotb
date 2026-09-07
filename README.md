# @zesun33/mcp-cocotb

> Model Context Protocol (MCP) server for Python-based [Cocotb](https://www.cocotb.org/) co-simulation hardware testbenches.

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![CI](https://github.com/zesun33/mcp-cocotb/actions/workflows/ci.yml/badge.svg)](https://github.com/zesun33/mcp-cocotb/actions/workflows/ci.yml)
[![Protocol: MCP](https://img.shields.io/badge/protocol-MCP_stdio-blueviolet)](https://modelcontextprotocol.io)
[![Runtime: Rootless Podman](https://img.shields.io/badge/runtime-rootless_podman-brightgreen)](#execution-runtime)

`mcp-cocotb` equips AI coding agents and IDEs (**Cursor**, **Windsurf**, **GitHub Copilot / OpenAI Codex**, **Claude Code**, **Google Antigravity**, **OpenCode**, **Cline**) with structured tools to discover, generate, and run asynchronous Python testbenches against Verilog/SystemVerilog designs. By wrapping the complexity of simulator VPI compilation, Makefile orchestration, and JUnit XML parsing into deterministic JSON contracts, agents can execute closed-loop verification without drowning in simulator logs.

---

## ⚡ Quick Tour: See It in Action

### Why AI Agents Need `mcp-cocotb`
| Without `mcp-cocotb` (Raw Shell / Make) | With `mcp-cocotb` (Structured MCP) |
| :--- | :--- |
| Handcrafts brittle Makefiles with obscure `cocotb-config` paths | **1-Call Generation & Execution** (`cocotb_run`) |
| Parses hundreds of lines of mixed C/VPI/Python stdout | Structured JSON with **test counts, pass/fail, duration** |
| Assertion failures lost in noisy simulator terminal scrollback | Direct **Python exception traceback & line numbers** |
| Simulator hangs on coroutine deadlock or infinite clock loop | **Automated timeout kill-switch** (`timeout_ms`) |
| Requires complex local Python 3.12 + C++ compiler toolchains | **Zero host configuration** (runs via isolated rootless Podman) |

### Real Agent Scenarios in 60 Seconds

#### 1. Probing the Environment (Zero-Config Verification)
```json
// Tool Call: cocotb_toolchain_info
{
  "runtime": "podman",
  "image": "ghcr.io/zesun33/verilog",
  "cocotbVersion": "2.1.0",
  "pythonVersion": "Python 3.12.3",
  "simulator": "iverilog (Icarus Verilog)"
}
```

#### 2. Static Test Discovery (Inspect Test Matrix Without Running)
```json
// Tool Call: cocotb_list_tests {"test_file": "test_dff.py"}
{
  "file": "test_dff.py",
  "totalTests": 3,
  "tests": [
    { "name": "test_dff_reset", "doc": "Verify DFF reset behavior." },
    { "name": "test_dff_toggle", "doc": "Verify DFF data propagation across clock edges." },
    { "name": "test_dff_failing_assert", "doc": "Negative test fixture for assertion failure handling." }
  ]
}
```

#### 3. Automated Co-Simulation Runner (Passing Suite)
```json
// Tool Call: cocotb_run {"verilog_sources": ["dff.v"], "toplevel": "dff", "python_module": "test_dff"}
{
  "success": false,
  "totalTests": 3,
  "passedTests": 2,
  "failedTests": 1,
  "durationSeconds": 0.04,
  "tests": [
    { "name": "test_dff_reset", "classname": "test_dff", "time": 0.012, "status": "pass" },
    { "name": "test_dff_toggle", "classname": "test_dff", "time": 0.018, "status": "pass" },
    {
      "name": "test_dff_failing_assert",
      "classname": "test_dff",
      "time": 0.010,
      "status": "fail",
      "failureMessage": "assert False, 'INTENTIONAL_ASSERTION_FAILURE'",
      "traceback": "Traceback (most recent call last):\n  File \"test_dff.py\", line 45, in test_dff_failing_assert\n    assert False, 'INTENTIONAL_ASSERTION_FAILURE'\nAssertionError: INTENTIONAL_ASSERTION_FAILURE"
    }
  ]
}
```

#### 4. Instant Agent Self-Repair Loop
Because `mcp-cocotb` captures the exact Python failure traceback (`AssertionError: INTENTIONAL_ASSERTION_FAILURE` at `line 45`), the LLM agent immediately knows what line and condition failed and can self-correct the RTL or testbench in a single turn without human intervention.

---

## Tools Exposed

| Tool | Parameters | Engine | Description |
| :--- | :--- | :--- | :--- |
| `cocotb_run` | `verilog_sources: string[]`, `toplevel: string`, `python_module: string`, `cwd?: string`, `timeout_ms?: number`, `simulator?: "icarus" \| "verilator"`, `dump_waves?: boolean` | `cocotb` + `iverilog`/`verilator` | Compiles DUT, executes the Python testbench, and returns parsed JUnit results with tracebacks plus `simulator` echo and collected `waveFiles` (`WAVES=1` dumps). `simulator: "verilator"` needs Verilator >= 5.036 (image ships 5.020, so it fails fast with guidance) and builds with `--timing` for Clock/Timer tests. |
| `cocotb_list_tests` | `test_file: string`, `cwd?: string` | AST Scanner | Fast static parser extracting all `@cocotb.test()` coroutines and docstrings from a test file without running simulation. |
| `cocotb_generate_runner` | `verilog_sources: string[]`, `toplevel: string`, `python_module: string`, `simulator?: string` | Generator | Generates a reproducible Cocotb `Makefile` (adds `COMPILE_ARGS += --timing` for Verilator Clock/Timer tests). |
| `cocotb_toolchain_info` | *none* | Probe | Returns active container/host runtime and versions of Cocotb, Python 3, and simulator engines. |

---

## Execution Runtime

`mcp-cocotb` runs inside the [`zesun33/verilog`](https://github.com/zesun33/eda-docker-images) rootless Podman image so tools are identical on any Linux host.

**Public install (recommended — anyone can pull):**
```bash
podman pull ghcr.io/zesun33/verilog:latest
export MCP_COCOTB_IMAGE=ghcr.io/zesun33/verilog
```

Local builds from `eda-docker-images` still work as `localhost/zesun33/verilog` (the historical default). Override anytime with `MCP_COCOTB_IMAGE`.

- Container mount: `-v <workspace>:/workspace:Z -w /workspace`
- Podman storage option: `--storage-opt overlay.ignore_chown_errors=true`

To force host binaries instead of container execution:
```bash
export MCP_COCOTB_RUNTIME=host
```


---

## Universal Client & AI IDE Setup

Because `mcp-cocotb` implements the standard [Model Context Protocol (MCP)](https://modelcontextprotocol.io), it connects seamlessly to any MCP-compliant AI IDE or agent interface:

| Environment | Supported Tools | Setup Location |
| :--- | :--- | :--- |
| **AI IDEs** | Cursor, Windsurf, Google Antigravity, Zed | `.cursor/mcp.json` or `.windsurf/mcp.json` |
| **Extensions** | GitHub Copilot / OpenAI Codex, Cline, Roo Code | VS Code MCP extension settings |
| **CLI Agents** | Claude Code, OpenCode, Goose, Antigravity CLI (`agy`) | Global MCP configuration or CLI flags |
| **Desktop** | Claude Desktop | `claude_desktop_config.json` |

### 1. Cursor / Windsurf / Antigravity IDE
Add to your project's `.cursor/mcp.json` or `.windsurf/mcp.json`:
```json
{
  "mcpServers": {
    "cocotb": {
      "command": "node",
      "args": ["/path/to/personal-projects/mcp-cocotb/dist/index.js"]
    }
  }
}
```

### 2. VS Code (GitHub Copilot / OpenAI Codex / Cline)
Add to your VS Code MCP settings or user configuration:
```json
{
  "mcpServers": {
    "cocotb": {
      "command": "node",
      "args": ["/path/to/personal-projects/mcp-cocotb/dist/index.js"]
    }
  }
}
```

### 3. Claude Desktop & Claude Code
Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "cocotb": {
      "command": "node",
      "args": ["/path/to/personal-projects/mcp-cocotb/dist/index.js"]
    }
  }
}
```

---

## Verification & Testing

Run the full 6-gate verification suite:
```bash
# Full verification (with Podman container execution)
./scripts/verify.sh

# Fast / CI verification (headless environments)
./scripts/verify.sh --quick
```

Run specific test tiers:
```bash
npm run test:unit       # Fast unit tests (parsers & AST discovery)
npm test                # Full test suite (including live container simulation)
```
