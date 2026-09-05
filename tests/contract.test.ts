import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

test("MCP server registers required Cocotb tools", async () => {
  const server = createServer();

  const handler = (server as any)._requestHandlers.get(ListToolsRequestSchema.shape.method.value);
  assert.ok(handler, "ListTools handler must be registered");

  const response = await handler({ method: "tools/list" });
  assert.ok(response.tools, "Tools list must be returned");

  const toolNames = response.tools.map((t: any) => t.name);
  assert.ok(toolNames.includes("cocotb_run"), "cocotb_run must be present");
  assert.ok(toolNames.includes("cocotb_list_tests"), "cocotb_list_tests must be present");
  assert.ok(toolNames.includes("cocotb_generate_runner"), "cocotb_generate_runner must be present");
  assert.ok(toolNames.includes("cocotb_toolchain_info"), "cocotb_toolchain_info must be present");

  for (const tool of response.tools) {
    assert.equal(tool.inputSchema.type, "object");
    assert.ok(tool.description && tool.description.length > 10);
  }
});
