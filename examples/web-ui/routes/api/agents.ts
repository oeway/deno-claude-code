import { Handlers } from "$fresh/server.ts";
import { manager } from "../../lib/manager.ts";

export const handler: Handlers = {
  GET(_req) {
    const agents = manager.getAllAgents();
    const agentInfo = agents.map(agent => agent.getInfo());
    return Response.json(agentInfo);
  },
  
  async POST(req) {
    const config = await req.json();
    // Use the permission mode from the request (defaults to 'default' if not specified)
    if (!config.permissionMode) {
      config.permissionMode = 'default';
    }
    const agent = await manager.createAgent(config);
    return Response.json({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      workingDirectory: agent.workingDirectory,
      permissionMode: agent.permissionMode
    });
  },
};