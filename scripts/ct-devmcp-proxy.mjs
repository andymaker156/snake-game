#!/usr/bin/env node

const REMOTE_URL = process.env.CT_DEVMCP_URL || "https://devmcp.ct839.com/mcp";
const PROTOCOL_VERSION = "2025-06-18";

let input = Buffer.alloc(0);
let remoteId = 1;

process.stdin.on("data", (chunk) => {
  input = Buffer.concat([input, chunk]);
  readMessages().catch((error) => {
    writeError(null, -32603, error.message);
  });
});

process.stdin.on("end", () => {
  process.exit(0);
});

async function readMessages() {
  while (true) {
    const headerEnd = input.indexOf("\r\n\r\n");
    if (headerEnd === -1) return;

    const header = input.subarray(0, headerEnd).toString("utf8");
    const match = header.match(/content-length:\s*(\d+)/i);
    if (!match) {
      input = input.subarray(headerEnd + 4);
      continue;
    }

    const length = Number(match[1]);
    const messageStart = headerEnd + 4;
    const messageEnd = messageStart + length;
    if (input.length < messageEnd) return;

    const raw = input.subarray(messageStart, messageEnd).toString("utf8");
    input = input.subarray(messageEnd);

    let message;
    try {
      message = JSON.parse(raw);
    } catch (error) {
      writeError(null, -32700, `Parse error: ${error.message}`);
      continue;
    }

    await handleMessage(message);
  }
}

async function handleMessage(message) {
  const { id, method, params } = message;

  if (method === "initialize") {
    writeResult(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {
        tools: {
          listChanged: true,
        },
      },
      serverInfo: {
        name: "ct-devmcp-compat-proxy",
        version: "1.0.0",
      },
    });
    return;
  }

  if (method === "notifications/initialized") {
    return;
  }

  if (method === "tools/list") {
    const response = await callRemote("tools/list", {});
    const tools = response?.result?.tools ?? [];
    writeResult(id, {
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema ?? {
          type: "object",
          properties: {},
        },
      })),
    });
    return;
  }

  if (method === "tools/call") {
    const response = await callRemote("tools/call", {
      name: params?.name,
      arguments: params?.arguments ?? {},
    });

    if (response?.error) {
      writeError(id, response.error.code ?? -32603, response.error.message ?? "Remote MCP error", response.error.data);
      return;
    }

    writeResult(id, response?.result ?? { content: [] });
    return;
  }

  if (method === "resources/list" || method === "resources/templates/list" || method === "prompts/list") {
    writeResult(id, emptyListResult(method));
    return;
  }

  if (typeof id !== "undefined") {
    writeError(id, -32601, `Method not found: ${method}`);
  }
}

async function callRemote(method, params) {
  const response = await fetch(REMOTE_URL, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: remoteId++,
      method,
      params,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Remote ${method} failed with HTTP ${response.status}: ${text.slice(0, 500)}`);
  }

  return parseRemoteResponse(text);
}

function parseRemoteResponse(text) {
  const dataLine = text
    .split(/\r?\n/)
    .find((line) => line.trimStart().startsWith("data:"));

  const jsonText = dataLine ? dataLine.replace(/^\s*data:\s*/, "") : text;
  return JSON.parse(jsonText);
}

function emptyListResult(method) {
  if (method === "resources/list") return { resources: [] };
  if (method === "resources/templates/list") return { resourceTemplates: [] };
  return { prompts: [] };
}

function writeResult(id, result) {
  writeMessage({
    jsonrpc: "2.0",
    id,
    result,
  });
}

function writeError(id, code, message, data) {
  writeMessage({
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      ...(typeof data === "undefined" ? {} : { data }),
    },
  });
}

function writeMessage(message) {
  const json = JSON.stringify(message);
  const length = Buffer.byteLength(json, "utf8");
  process.stdout.write(`Content-Length: ${length}\r\n\r\n${json}`);
}
