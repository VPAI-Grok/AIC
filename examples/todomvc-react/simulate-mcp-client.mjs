import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mcpServerPath = path.resolve(__dirname, '../../packages/mcp-server/dist/mcp-server/src/index.js');

const mcpProcess = spawn(process.execPath, [mcpServerPath], {
  stdio: ['pipe', 'pipe', 'inherit']
});

let messageId = 1;

function sendRequest(method, params) {
  const req = {
    jsonrpc: '2.0',
    id: messageId++,
    method,
    params
  };
  mcpProcess.stdin.write(JSON.stringify(req) + '\n');
}

let responseBuffer = '';

mcpProcess.stdout.on('data', (data) => {
  responseBuffer += data.toString();
  
  // MCP messages are newline delimited JSON
  const lines = responseBuffer.split('\n');
  responseBuffer = lines.pop(); // Keep the last incomplete line
  
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const response = JSON.parse(line);
      if (response.id === 2) {
        console.log('\n--- MCP Result ---');
        console.log(JSON.stringify(response.result, null, 2));
        mcpProcess.kill();
        process.exit(0);
      } else {
        console.log('\n--- MCP Server Response ---');
        console.log(`Response received for id: ${response.id}`);
        console.log('---------------------------\n');
      }
    } catch (e) {
      console.error('Failed to parse response:', line, e);
    }
  }
});

console.log('Simulating MCP Client connection to TodoMVC...');

// 1. Ask for tools
sendRequest('tools/list', {});

// 2. Query the elements tool for TodoMVC
setTimeout(() => {
  const callArgs = {
    name: 'list_aic_elements',
    arguments: {
      base_url: 'http://localhost:5173',
      actionable_only: true
    }
  };
  console.log('Sending args:', callArgs);
  sendRequest('tools/call', callArgs);
}, 1000);
