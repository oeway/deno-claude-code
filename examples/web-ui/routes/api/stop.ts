import { Handlers } from "$fresh/server.ts";
import { manager } from "../../lib/manager.ts";

export const handler: Handlers = {
  async POST(req) {
    const { agentId } = await req.json();
    const success = manager.stopAgent(agentId);
    return Response.json({ success });
  },
};