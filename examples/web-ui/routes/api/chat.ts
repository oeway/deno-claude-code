import { Handlers } from "$fresh/server.ts";
import { manager } from "../../lib/manager.ts";

const activeRequests = new Map();

export const handler: Handlers = {
  async POST(req) {
    const { agentId, message } = await req.json();
    
    const abortController = new AbortController();
    activeRequests.set(agentId, abortController);
    
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        try {
          const agent = manager.getAgent(agentId);
          if (!agent) throw new Error("Agent not found");
          
          for await (const response of agent.execute(message)) {
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