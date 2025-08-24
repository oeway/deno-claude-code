import { Handlers } from "$fresh/server.ts";
import { manager } from "../../../lib/manager.ts";

export const handler: Handlers = {
  async GET(_req, ctx) {
    const { id } = ctx.params;
    const agent = manager.getAgent(id);
    if (!agent) {
      return new Response("Agent not found", { status: 404 });
    }
    
    const conversation = agent.getConversation();
    const sessionId = agent.getSessionId();
    
    return Response.json({ 
      conversation,
      sessionId,
      agentId: id
    });
  },
  
  async DELETE(_req, ctx) {
    const { id } = ctx.params;
    const success = await manager.removeAgent(id);
    return Response.json({ success });
  },
};