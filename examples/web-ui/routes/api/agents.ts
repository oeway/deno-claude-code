import { Handlers } from "$fresh/server.ts";
import { manager } from "../../lib/manager.ts";

export const handler: Handlers = {
  GET(_req) {
    const agents = manager.getAllAgents();
    const agentInfo = agents.map(agent => ({
      id: agent.id,
      workingDirectory: agent.workingDirectory
    }));
    return Response.json(agentInfo);
  },
  
  async POST(req) {
    const config = await req.json();
    // Always set permissionMode to bypassPermissions for a smoother experience
    config.permissionMode = 'bypassPermissions';
    const agent = await manager.createAgent(config);
    return Response.json({
      id: agent.id,
      workingDirectory: agent.workingDirectory
    });
  },
};