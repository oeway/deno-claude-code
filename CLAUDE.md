Project Instructions – Claude Code in Dino Sandbox
Goal

We want to run claude code (npm package: "@anthropic-ai/claude-code") inside the Dino sandbox. For reference, you can look at the existing claude-code-webui folder (which is not part of the project). We won’t reuse it directly, but you can study how it imports claude code as a library and use that as inspiration.

Step 1 – Minimal Agent Implementation

Create a sandbox claude code agent.

Each agent should:

Have a unique ID.

Be assigned a working directory, isolated by Dino’s sandbox feature.

Only have access to its assigned folder.

Step 2 – Manager Implementation

Build a manager to handle agents.

The manager should be able to:

Launch a new agent (create_agent).

Interact with an agent (send commands, query state, etc.).

Manage the lifetime of each agent (start, stop, cleanup).

Step 3 – Integration

Start by running a single agent standalone.

Next, merge it with the manager so that the manager is responsible for launching and managing it.

Extend the manager to handle multiple agents in the future.

Step 4 – Testing

After each development step, write a test using Dino to confirm everything works:

Test launching a single agent.

Test manager creation and agent lifecycle.

Test agent isolation (ensuring it only accesses its assigned folder).


## Important guidance

You should not modify the folder claude-code-webui, that exists only for your reference and will be removed later, create files and project under the root folder.