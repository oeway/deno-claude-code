/** @jsx h */
import { h, Fragment } from "preact";
import { Head } from "$fresh/runtime.ts";

export default function Home() {
  return (
    <Fragment>
      <Head>
        <title>Claude Code Web UI</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css" rel="stylesheet" />
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-javascript.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-typescript.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-python.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-css.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-json.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-bash.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-yaml.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-markdown.min.js"></script>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in { animation: fade-in 0.3s ease-out; }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          .animate-spin { animation: spin 1s linear infinite; }
          .message-content pre {
            background: #f8fafc;
            padding: 0.75rem;
            border-radius: 0.375rem;
            overflow-x: auto;
            font-size: 0.75rem;
            line-height: 1rem;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          }
          .message-content code {
            background: #e2e8f0;
            padding: 0.125rem 0.25rem;
            border-radius: 0.25rem;
            font-size: 0.875em;
          }
        ` }} />
      </Head>
      <div class="bg-gray-50 h-screen overflow-hidden">
        <div class="flex h-full">
          {/* Sidebar */}
          <div class="w-80 bg-gradient-to-b from-gray-900 to-gray-800 text-white shadow-2xl flex flex-col">
            <div class="p-6 border-b border-gray-700">
              <div class="flex items-center justify-between mb-6">
                <h1 class="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Claude Agents
                </h1>
              </div>
              <button id="newAgentBtn" class="w-full px-4 py-2.5 bg-white/20 backdrop-blur text-white rounded-lg hover:bg-white/30 transition-all duration-200 flex items-center justify-center space-x-2">
                <span>New Agent</span>
              </button>
            </div>
            <div class="flex-1 overflow-y-auto p-4">
              <div id="agentList" class="space-y-3"></div>
            </div>
          </div>

          {/* Main Chat Area */}
          <div class="flex-1 flex flex-col bg-white">
            {/* Header */}
            <div class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
              <div>
                <h2 id="agentName" class="text-xl font-semibold text-gray-800">Select an Agent</h2>
                <p id="agentStatus" class="text-sm text-gray-500">No agent selected</p>
              </div>
            </div>

            {/* Messages Area */}
            <div class="flex-1 overflow-y-auto bg-gray-50 p-6">
              <div id="messages" class="space-y-4 max-w-4xl mx-auto"></div>
            </div>

            {/* Input Area */}
            <div class="bg-white border-t border-gray-200 px-6 py-4">
              <div class="max-w-4xl mx-auto">
                <div class="flex space-x-3">
                  <input 
                    type="text" 
                    id="messageInput" 
                    placeholder="Type your message..." 
                    class="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                  <button 
                    id="sendButton" 
                    class="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center space-x-2 shadow-md"
                  >
                    Send
                  </button>
                  <button 
                    id="stopButton" 
                    class="hidden px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all duration-200 flex items-center space-x-2 shadow-md"
                  >
                    Stop
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Config Modal */}
        <div id="configModal" class="fixed inset-0 bg-black bg-opacity-50 hidden flex items-center justify-center z-50">
          <div class="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg">
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-xl font-semibold text-gray-800">Agent Configuration</h3>
              <button id="closeModalBtn" class="p-1 hover:bg-gray-100 rounded-lg transition-colors">×</button>
            </div>
            
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Working Directory</label>
                <input 
                  type="text" 
                  id="configWorkDir" 
                  value="./agent-workspaces" 
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div class="flex justify-end space-x-3 mt-6">
              <button id="cancelBtn" class="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-200">
                Cancel
              </button>
              <button id="createBtn" class="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200">
                Create Agent
              </button>
            </div>
          </div>
        </div>

        <script src="/app.js?v=${Date.now()}"></script>
      </div>
    </Fragment>
  );
}