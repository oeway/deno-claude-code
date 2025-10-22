import { Handlers } from "$fresh/server.ts";
import { manager } from "../../lib/manager.ts";
import type { PermissionRequest, PermissionResponse } from "../../../../src/types.ts";

const activeRequests = new Map();
const permissionCallbacks = new Map<string, (response: PermissionResponse) => void>();

// Make permissionCallbacks globally accessible for permission-response.ts
(globalThis as any).permissionCallbacks = permissionCallbacks;

export const handler: Handlers = {
  async POST(req) {
    const { agentId, message, sessionId, allowedTools } = await req.json();
    
    const abortController = new AbortController();
    activeRequests.set(agentId, abortController);
    
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        try {
          const agent = manager.getAgent(agentId);
          if (!agent) {
            console.error(`Agent ${agentId} not found. Available agents:`, manager.getAllAgents().map(a => a.id));
            throw new Error("Agent not found");
          }
          
          // Permission callback that sends request to frontend and waits for response
          const permissionCallback = async (request: PermissionRequest): Promise<PermissionResponse> => {
            // Send permission request to frontend
            const sseData = `data: ${JSON.stringify({
              type: "permission_request",
              permissionRequest: request
            })}\n\n`;
            controller.enqueue(encoder.encode(sseData));
            
            // Wait for response from frontend
            return new Promise((resolve) => {
              permissionCallbacks.set(request.id, (response) => {
                permissionCallbacks.delete(request.id);
                resolve(response);
              });
            });
          };
          
          // Pass allowedTools to the execute method
          const options = allowedTools ? { allowedTools } : undefined;
          for await (const response of agent.execute(message, sessionId, permissionCallback, options)) {
            if (abortController.signal.aborted) break;
            
            const sseData = `data: ${JSON.stringify(response)}\n\n`;
            controller.enqueue(encoder.encode(sseData));
          }
          
          if (!abortController.signal.aborted) {
            controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
          }
        } catch (error) {
          const errorMsg = `data: ${JSON.stringify({
            type: "error",
            error: error instanceof Error ? error.message : String(error)
          })}\n\n`;
          controller.enqueue(encoder.encode(errorMsg));
        } finally {
          activeRequests.delete(agentId);
          // Clean up any pending permission callbacks
          for (const [id, callback] of permissionCallbacks.entries()) {
            if (id.startsWith(agentId)) {
              permissionCallbacks.delete(id);
            }
          }
          controller.close();
        }
      }
    });
    
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });
  },
};