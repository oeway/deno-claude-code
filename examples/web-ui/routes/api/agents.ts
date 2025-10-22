import { Handlers } from "$fresh/server.ts";
import { manager } from "../../lib/manager.ts";

export const handler: Handlers = {
  async GET(_req) {
    const agents = manager.getAllAgents();
    const agentInfo = await Promise.all(agents.map(agent => agent.getInfo()));
    return Response.json(agentInfo);
  },
  
  async POST(req) {
    const config = await req.json();
    // Use the permission mode from the request (defaults to 'default' if not specified)
    if (!config.permissionMode) {
      config.permissionMode = 'default';
    }
    const agent = await manager.createAgent(config);
    // Get the full agent info
    const agentInfo = await agent.getInfo();
    return Response.json(agentInfo);
  },
};