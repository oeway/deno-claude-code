import { Handlers } from "$fresh/server.ts";
import type { PermissionResponse } from "../../../../src/types.ts";

// Import the callbacks map from chat.ts
// We'll need to export it from there
declare global {
  var permissionCallbacks: Map<string, (response: PermissionResponse) => void>;
}

export const handler: Handlers = {
  async POST(req) {
    try {
      const response: PermissionResponse = await req.json();
      
      // Get the callback for this permission request
      const callback = globalThis.permissionCallbacks?.get(response.requestId);
      
      if (callback) {
        // Trigger the callback with the user's response
        callback(response);
        
        return Response.json({ success: true });
      } else {
        return Response.json(
          { error: "Permission request not found or already processed" },
          { status: 404 }
        );
      }
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Invalid request" },
        { status: 400 }
      );
    }
  },
};