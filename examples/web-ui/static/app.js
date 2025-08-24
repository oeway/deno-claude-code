// Agent Management
let agents = [];
let currentAgentId = null;
let isExecuting = false;
let currentReader = null;
let messageIdCounter = 0;
let allMessages = [];

// Global function for toggling Write tool content
window.toggleWriteContent = function(id) {
  const previewContainer = document.getElementById(id + '_preview')?.parentElement?.parentElement;
  const fullContainer = document.getElementById(id + '_full')?.parentElement?.parentElement;
  const toggle = document.getElementById(id + '_toggle');
  const fade = document.getElementById(id + '_fade');
  
  if (!previewContainer || !fullContainer || !toggle) return;
  
  if (fullContainer.classList.contains('hidden')) {
    // Show full content
    previewContainer.style.display = 'none';
    fullContainer.classList.remove('hidden');
    toggle.innerHTML = '▲ Show less';
    if (fade) fade.style.display = 'none';
    
    // Highlight full content if not already done
    if (window.Prism) {
      const fullCode = document.getElementById(id + '_full');
      if (fullCode && !fullCode.classList.contains('prism-highlighted')) {
        Prism.highlightElement(fullCode);
        fullCode.classList.add('prism-highlighted');
      }
    }
  } else {
    // Show preview
    previewContainer.style.display = 'block';
    fullContainer.classList.add('hidden');
    const lineCount = toggle.dataset.lineCount || 'all';
    toggle.innerHTML = `▼ Show all ${lineCount} lines`;
    if (fade) fade.style.display = 'block';
  }
};

// DOM Elements - Initialize after DOM is loaded
let agentList, agentName, agentStatus, messages, messageInput;
let sendButton, stopButton, configModal, newAgentBtn;
let closeModalBtn, cancelBtn, createBtn;

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  // Initialize DOM elements
  agentList = document.getElementById('agentList');
  agentName = document.getElementById('agentName');
  agentStatus = document.getElementById('agentStatus');
  messages = document.getElementById('messages');
  messageInput = document.getElementById('messageInput');
  sendButton = document.getElementById('sendButton');
  stopButton = document.getElementById('stopButton');
  configModal = document.getElementById('configModal');
  newAgentBtn = document.getElementById('newAgentBtn');
  closeModalBtn = document.getElementById('closeModalBtn');
  cancelBtn = document.getElementById('cancelBtn');
  createBtn = document.getElementById('createBtn');

  // Add event listeners
  if (newAgentBtn) newAgentBtn.addEventListener('click', () => showConfigModal());
  if (closeModalBtn) closeModalBtn.addEventListener('click', () => closeConfigModal());
  if (cancelBtn) cancelBtn.addEventListener('click', () => closeConfigModal());
  if (createBtn) createBtn.addEventListener('click', () => createAgent());
  if (sendButton) sendButton.addEventListener('click', () => sendMessage());
  if (stopButton) stopButton.addEventListener('click', () => stopExecution());
  
  if (messageInput) {
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  // Load agents on page load
  loadAgents();
});

async function loadAgents() {
  try {
    console.log('Loading agents...');
    const response = await fetch('/api/agents');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    agents = await response.json();
    console.log('Loaded agents:', agents);
    renderAgentList();
    
    // Auto-select first agent if none selected
    if (!currentAgentId && agents.length > 0) {
      selectAgent(agents[0].id);
    }
  } catch (error) {
    console.error('Failed to load agents:', error);
    if (agentList) {
      agentList.innerHTML = '<div class="text-red-500 p-4">Failed to load agents</div>';
    }
  }
}

function renderAgentList() {
  if (!agentList) return;
  
  if (agents.length === 0) {
    agentList.innerHTML = '<div class="text-center text-gray-400 py-8">No agents yet. Click "New Agent" to create one.</div>';
  } else {
    agentList.innerHTML = agents.map(agent => {
      const bgClass = currentAgentId === agent.id ? 'bg-blue-50 border-2 border-blue-400' : 'bg-white border border-gray-200';
      return `<div class="agent-card p-4 rounded-lg cursor-pointer ${bgClass} hover:shadow-md transition-all" data-id="${agent.id}">
        <div class="font-semibold text-gray-500">Agent ${agent.id.split('-')[0]}</div>
        <div class="text-xs text-gray-500">${agent.workingDirectory}</div>
        <button class="delete-agent mt-2 text-xs text-red-600 hover:text-red-800" data-id="${agent.id}">Delete</button>
      </div>`;
    }).join('');
    
    // Add click handlers
    document.querySelectorAll('.agent-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (!e.target.classList.contains('delete-agent')) {
          selectAgent(card.dataset.id);
        }
      });
    });
    
    // Add delete handlers
    document.querySelectorAll('.delete-agent').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteAgent(btn.dataset.id);
      });
    });
  }
}

async function selectAgent(id) {
  currentAgentId = id;
  const agent = agents.find(a => a.id === id);
  
  if (!agent) {
    console.error('Agent not found:', id);
    return;
  }
  
  if (agentName) agentName.textContent = `Agent ${id.split('-')[0]}`;
  if (agentStatus) agentStatus.textContent = 'Ready to chat';
  
  // Try to restore conversation history
  try {
    const response = await fetch(`/api/agents/${id}`);
    if (response.ok) {
      const data = await response.json();
      
      if (data.conversation && data.conversation.length > 0) {
        // Restore conversation
        if (messages) {
          messages.innerHTML = '';
          allMessages = [];
          
          let assistantMessage = null;
          
          // Display each message from history
          for (const msg of data.conversation) {
            if (msg.type === 'user') {
              // User message
              addMessage('user', msg.data);
              assistantMessage = null;
            } else if (msg.type === 'agent' && msg.data) {
              // Claude response - render appropriately based on type
              const claudeData = msg.data;
              
              switch (claudeData.type) {
                case 'system':
                  if (claudeData.subtype === 'init') {
                    addRichMessage(renderSystemInit(claudeData));
                  } else {
                    addRichMessage(renderSystemMessage(claudeData));
                  }
                  break;
                  
                case 'assistant':
                  // Handle assistant messages with potentially multiple content items
                  if (claudeData.message?.content) {
                    if (Array.isArray(claudeData.message.content)) {
                      // Process each content item in the array
                      for (const contentItem of claudeData.message.content) {
                        if (contentItem.type === 'text' && contentItem.text) {
                          // Display text content
                          if (!assistantMessage) {
                            assistantMessage = addMessage('assistant', contentItem.text);
                          } else {
                            updateMessage(assistantMessage, contentItem.text);
                          }
                        } else if (contentItem.type === 'tool_use') {
                          // Display tool use inline as a rich message
                          addRichMessage(renderToolUse(contentItem));
                        }
                      }
                    } else if (typeof claudeData.message.content === 'string') {
                      // Handle string content
                      if (!assistantMessage) {
                        assistantMessage = addMessage('assistant', claudeData.message.content);
                      } else {
                        updateMessage(assistantMessage, claudeData.message.content);
                      }
                    }
                  } else if (claudeData.content) {
                    // Handle direct content field (fallback)
                    const text = Array.isArray(claudeData.content) 
                      ? claudeData.content.find(item => item.type === 'text')?.text || ''
                      : typeof claudeData.content === 'string' 
                        ? claudeData.content 
                        : '';
                    if (text) {
                      if (!assistantMessage) {
                        assistantMessage = addMessage('assistant', text);
                      } else {
                        updateMessage(assistantMessage, text);
                      }
                    }
                    // Process tool_use items if present in content array
                    if (Array.isArray(claudeData.content)) {
                      for (const item of claudeData.content) {
                        if (item.type === 'tool_use') {
                          addRichMessage(renderToolUse(item));
                        }
                      }
                    }
                  }
                  break;
                  
                case 'tool_use':
                  addRichMessage(renderToolUse(claudeData));
                  break;
                  
                case 'tool_result':
                  addRichMessage(renderToolResult(claudeData));
                  break;
                  
                case 'todos':
                  if (claudeData.todos) {
                    addRichMessage(renderTodos(claudeData.todos));
                  }
                  break;
                  
                case 'user_feedback':
                  addRichMessage(renderUserFeedback(claudeData));
                  break;
                  
                case 'user':
                  // Handle user type messages with tool results
                  addRichMessage(renderUserToolResult(claudeData));
                  break;
                  
                case 'error':
                  addRichMessage(renderError(claudeData));
                  break;
                  
                case 'result':
                  addRichMessage(renderResult(claudeData));
                  break;
                  
                default:
                  // Show any other message types as system messages
                  if (claudeData.type === 'user' && (claudeData.content || claudeData.role === 'user')) {
                    // Handle user messages that weren't caught above
                    addRichMessage(renderUserToolResult(claudeData));
                  } else if (claudeData.type) {
                    addRichMessage(renderSystemMessage(claudeData));
                  }
              }
            }
          }
        }
      } else {
        // No conversation history
        if (messages) {
          messages.innerHTML = '<div class="text-center text-gray-400 py-8">Start a conversation</div>';
          allMessages = [];
        }
      }
    }
  } catch (error) {
    console.error('Failed to restore conversation:', error);
    // Fallback to empty conversation
    if (messages) {
      messages.innerHTML = '<div class="text-center text-gray-400 py-8">Start a conversation</div>';
      allMessages = [];
    }
  }
  
  renderAgentList();
  
  // Enable input
  if (messageInput) messageInput.disabled = false;
  if (sendButton) sendButton.disabled = false;
}

async function deleteAgent(id) {
  if (!confirm('Delete this agent?')) return;
  
  try {
    const response = await fetch(`/api/agents/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete');
    
    await loadAgents();
    if (currentAgentId === id) {
      currentAgentId = null;
      if (agents.length > 0) {
        selectAgent(agents[0].id);
      }
    }
  } catch (error) {
    console.error('Failed to delete agent:', error);
    alert('Failed to delete agent');
  }
}

function showConfigModal() {
  if (configModal) configModal.classList.remove('hidden');
}

function closeConfigModal() {
  if (configModal) configModal.classList.add('hidden');
}

async function createAgent() {
  try {
    const workDir = document.getElementById('configWorkDir').value || '/tmp/agent-' + Date.now();
    const config = { workingDirectory: workDir };
    
    console.log('Creating agent with config:', config);
    
    const response = await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const agent = await response.json();
    console.log('Created agent:', agent);
    
    await loadAgents();
    selectAgent(agent.id);
    closeConfigModal();
  } catch (error) {
    console.error('Failed to create agent:', error);
    alert('Failed to create agent: ' + error.message);
  }
}

// Rich message rendering functions
function renderSystemInit(data) {
  const tools = data.tools || [];
  const mcpServers = data.mcp_servers || [];
  
  return `
    <div class="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200 shadow-sm">
      <div class="flex items-start space-x-3">
        <div class="flex-shrink-0">
          <div class="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
            <span class="text-purple-600">✨</span>
          </div>
        </div>
        <div class="flex-1">
          <div class="text-sm font-semibold text-purple-900 mb-2">Session Initialized</div>
          <div class="text-xs space-y-1">
            <div class="flex items-center space-x-2">
              <span class="text-purple-700">📍 Directory:</span>
              <code class="bg-white px-2 py-0.5 rounded">${escapeHtml(data.cwd || 'N/A')}</code>
            </div>
            <div class="flex items-center space-x-2">
              <span class="text-purple-700">🤖 Model:</span>
              <span class="font-medium">${escapeHtml(data.model || 'N/A')}</span>
            </div>
            <div class="flex items-center space-x-2">
              <span class="text-purple-700">🔧 Tools:</span>
              <span class="font-medium">${tools.length} available</span>
            </div>
            ${mcpServers.length > 0 ? `
              <div class="mt-2">
                <div class="text-purple-700 mb-1">🔌 MCP Servers:</div>
                <div class="flex flex-wrap gap-1">
                  ${mcpServers.map(s => `
                    <span class="inline-block px-2 py-1 bg-purple-100 rounded text-xs">
                      ${escapeHtml(s.name)} <span class="text-purple-600">(${escapeHtml(s.status)})</span>
                    </span>
                  `).join('')}
                </div>
              </div>
            ` : ''}
            <div class="text-gray-500 mt-2">Session ID: ${data.session_id?.substring(0, 8)}...</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderToolUse(data) {
  const toolName = data.tool_name || data.name || 'Unknown Tool';
  const toolIcon = getToolIcon(toolName);
  const isMcp = toolName.includes('mcp__');
  
  // Special rendering for TodoWrite tool
  if (toolName === 'TodoWrite' && data.input?.todos) {
    return `
      <div class="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-4 border-2 border-blue-300 shadow-sm">
        <div class="flex items-start space-x-3">
          <div class="flex-shrink-0">
            <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-lg">
              📋
            </div>
          </div>
          <div class="flex-1">
            <div class="flex items-center space-x-2 mb-3">
              <span class="text-sm font-bold text-blue-900">Tool Call:</span>
              <code class="font-mono text-xs bg-white px-2 py-1 rounded border">TodoWrite</code>
              ${data.tool_use_id ? `<span class="text-xs text-gray-500">#${data.tool_use_id.substring(0, 8)}</span>` : ''}
            </div>
            <div class="bg-white rounded-lg p-3 border border-gray-200">
              <div class="text-xs font-semibold text-gray-700 mb-2">Todo List Update:</div>
              <div class="space-y-2">
                ${data.input.todos.map(todo => {
                  const statusIcon = todo.status === 'completed' ? '✅' : 
                                   todo.status === 'in_progress' ? '⏳' : '⭕';
                  const statusClass = todo.status === 'completed' ? 'text-green-600 line-through' : 
                                    todo.status === 'in_progress' ? 'text-blue-600 font-semibold' : 
                                    'text-gray-600';
                  const displayText = todo.status === 'in_progress' && todo.activeForm ? todo.activeForm : todo.content;
                  return `
                    <div class="flex items-start space-x-2 text-xs">
                      <span class="text-sm mt-0.5">${statusIcon}</span>
                      <span class="${statusClass} flex-1">${escapeHtml(displayText)}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  // Special rendering for Write tool
  if (toolName === 'Write' && data.input?.file_path) {
    const filePath = data.input.file_path;
    const content = data.input.content || '';
    const fileName = filePath.split('/').pop();
    const extension = fileName.split('.').pop().toLowerCase();
    const uniqueId = 'write_' + Math.random().toString(36).substring(7);
    
    // Smart path display: show directory + filename, omit middle if too long
    const pathParts = filePath.split('/');
    let displayPath = filePath;
    if (pathParts.length > 3 && filePath.length > 50) {
      const firstPart = pathParts.slice(0, 2).join('/');
      const lastPart = pathParts.slice(-2).join('/');
      displayPath = firstPart + '/.../' + lastPart;
    }
    
    // Determine language for syntax highlighting
    const languageMap = {
      'js': 'javascript', 'ts': 'typescript', 'jsx': 'javascript', 'tsx': 'typescript',
      'html': 'markup', 'htm': 'markup', 'xml': 'markup',
      'css': 'css', 'scss': 'css', 'sass': 'css', 'less': 'css',
      'json': 'json', 'py': 'python', 'rb': 'ruby', 'java': 'java',
      'cpp': 'cpp', 'c': 'c', 'h': 'c', 'hpp': 'cpp',
      'md': 'markdown', 'yaml': 'yaml', 'yml': 'yaml',
      'sh': 'bash', 'bash': 'bash', 'zsh': 'bash'
    };
    const language = languageMap[extension] || 'plaintext';
    
    // Get file icon based on extension
    const fileIcon = extension === 'html' ? '📄' :
                    extension === 'css' || extension === 'scss' ? '🎨' :
                    extension === 'js' || extension === 'ts' ? '📜' :
                    extension === 'json' ? '📋' :
                    extension === 'md' ? '📝' :
                    extension === 'py' ? '🐍' :
                    '📄';
    
    // Calculate line count
    const lines = content.split('\n');
    const lineCount = lines.length;
    const previewLines = lines.slice(0, 5).join('\n');
    const hasMore = lineCount > 5;
    
    // Trigger Prism highlighting after DOM update
    setTimeout(() => {
      if (window.Prism) {
        const previewCode = document.getElementById(uniqueId + '_preview');
        const fullCode = document.getElementById(uniqueId + '_full');
        if (previewCode) Prism.highlightElement(previewCode);
        if (fullCode) Prism.highlightElement(fullCode);
      }
    }, 0);
    
    // Copy function
    window['copyWriteContent_' + uniqueId] = function() {
      navigator.clipboard.writeText(content).then(() => {
        const btn = document.getElementById(uniqueId + '_copy');
        const originalText = btn.innerHTML;
        btn.innerHTML = '✓';
        btn.classList.add('text-green-400');
        setTimeout(() => {
          btn.innerHTML = originalText;
          btn.classList.remove('text-green-400');
        }, 2000);
      });
    };
    
    return `
      <div class="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border-2 border-green-300 shadow-sm">
        <div class="flex items-start space-x-3">
          <div class="flex-shrink-0">
            <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-lg">
              ✏️
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center space-x-2 mb-3">
              <span class="text-sm font-bold text-green-900">Tool Call:</span>
              <code class="font-mono text-xs bg-white px-2 py-1 rounded border">Write</code>
              ${data.tool_use_id ? `<span class="text-xs text-gray-500">#${data.tool_use_id.substring(0, 8)}</span>` : ''}
            </div>
            <div class="bg-gray-900 rounded-lg overflow-hidden border border-gray-700 relative">
              <div class="bg-gray-800 px-3 py-2 flex items-center justify-between border-b border-gray-700">
                <div class="flex items-center space-x-2 min-w-0">
                  <span class="text-lg flex-shrink-0">${fileIcon}</span>
                  <code class="text-xs text-gray-300 font-mono truncate" title="${escapeHtml(filePath)}">${escapeHtml(displayPath)}</code>
                </div>
                <div class="flex items-center space-x-3 flex-shrink-0">
                  <button 
                    id="${uniqueId}_copy"
                    onclick="copyWriteContent_${uniqueId}()"
                    class="text-gray-400 hover:text-gray-200 transition-colors p-1"
                    title="Copy content"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                    </svg>
                  </button>
                  <span class="text-xs text-gray-400">${lineCount} lines</span>
                  <span class="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded">${language}</span>
                </div>
              </div>
              <div class="relative">
                <div class="overflow-hidden" style="max-height: ${hasMore ? '150px' : 'auto'};">
                  <pre class="text-xs p-3 overflow-x-auto" style="margin: 0; background: #2d2d2d;"><code id="${uniqueId}_preview" class="language-${language}">${escapeHtml(previewLines)}</code></pre>
                  ${hasMore ? `<div class="bg-gradient-to-t from-gray-900 to-transparent absolute bottom-0 left-0 right-0 h-12 pointer-events-none" id="${uniqueId}_fade"></div>` : ''}
                </div>
                ${hasMore ? `
                  <button onclick="toggleWriteContent('${uniqueId}')" id="${uniqueId}_toggle" data-line-count="${lineCount}" class="w-full bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white text-xs py-2 border-t border-gray-700 transition-colors">
                    ▼ Show all ${lineCount} lines
                  </button>
                  <div class="hidden">
                    <pre class="text-xs p-3 overflow-x-auto" style="margin: 0; background: #2d2d2d;"><code id="${uniqueId}_full" class="language-${language}">${escapeHtml(content)}</code></pre>
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  return `
    <div class="bg-gradient-to-r ${isMcp ? 'from-purple-50 to-indigo-50 border-purple-300' : 'from-blue-50 to-cyan-50 border-blue-300'} rounded-lg p-4 border-2 shadow-sm">
      <div class="flex items-start space-x-3">
        <div class="flex-shrink-0">
          <div class="w-10 h-10 ${isMcp ? 'bg-purple-100' : 'bg-blue-100'} rounded-full flex items-center justify-center text-lg">
            ${toolIcon}
          </div>
        </div>
        <div class="flex-1">
          <div class="flex items-center space-x-2 mb-2">
            <span class="text-sm font-bold ${isMcp ? 'text-purple-900' : 'text-blue-900'}">Tool Call:</span>
            <code class="font-mono text-xs bg-white px-2 py-1 rounded border">${escapeHtml(toolName)}</code>
            ${data.tool_use_id ? `<span class="text-xs text-gray-500">#${data.tool_use_id.substring(0, 8)}</span>` : ''}
          </div>
          ${data.input ? `
            <details class="group" open>
              <summary class="cursor-pointer text-xs text-gray-600 hover:text-gray-900 font-semibold">
                Parameters
              </summary>
              <pre class="text-xs mt-2 bg-white p-3 rounded border border-gray-200 overflow-x-auto"><code>${escapeHtml(JSON.stringify(data.input, null, 2))}</code></pre>
            </details>
          ` : '<div class="text-xs text-gray-500">No parameters</div>'}
        </div>
      </div>
    </div>
  `;
}

function renderToolResult(data) {
  const isError = data.is_error || false;
  const output = data.output || data.content || '';
  
  // Truncate very long outputs
  const displayOutput = output.length > 1000 ? output.substring(0, 1000) + '...\n[Output truncated]' : output;
  
  return `
    <div class="${isError ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'} rounded-lg p-3 border shadow-sm">
      <div class="flex items-start space-x-2">
        <div class="flex-shrink-0">
          <div class="w-6 h-6 ${isError ? 'bg-red-100' : 'bg-green-100'} rounded-full flex items-center justify-center">
            <span class="text-sm">${isError ? '❌' : '✅'}</span>
          </div>
        </div>
        <div class="flex-1">
          <div class="text-xs font-medium ${isError ? 'text-red-900' : 'text-green-900'} mb-1">
            Tool Result
          </div>
          ${displayOutput ? `
            <pre class="text-xs bg-white p-2 rounded border overflow-x-auto whitespace-pre-wrap"><code>${escapeHtml(displayOutput)}</code></pre>
          ` : '<div class="text-xs text-gray-500">No output</div>'}
          ${data.duration_ms ? `
            <div class="text-xs text-gray-600 mt-1">Duration: ${data.duration_ms}ms</div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

function renderTodos(todos) {
  if (!todos || todos.length === 0) return '';
  
  return `
    <div class="bg-white border-2 border-gray-200 rounded-lg p-4 shadow-sm">
      <div class="text-sm font-bold text-gray-900 mb-3 flex items-center">
        <span class="text-lg mr-2">📋</span>
        Todo List
      </div>
      <div class="space-y-2">
        ${todos.map(todo => {
          const statusIcon = todo.status === 'completed' ? '✅' : 
                           todo.status === 'in_progress' ? '⏳' : '⭕';
          const statusClass = todo.status === 'completed' ? 'text-green-600 line-through' : 
                            todo.status === 'in_progress' ? 'text-blue-600 font-semibold' : 
                            'text-gray-600';
          return `
            <div class="flex items-start space-x-2 text-sm">
              <span class="text-base">${statusIcon}</span>
              <span class="${statusClass}">${escapeHtml(todo.status === 'in_progress' && todo.activeForm ? todo.activeForm : todo.content)}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderUserFeedback(data) {
  return `
    <div class="bg-yellow-50 rounded-lg p-3 border border-yellow-200 shadow-sm">
      <div class="flex items-start space-x-2">
        <span class="text-yellow-600">💬</span>
        <div class="flex-1">
          <div class="text-sm font-medium text-yellow-900">User Feedback</div>
          <div class="text-xs text-yellow-700 mt-1">${escapeHtml(data.message || JSON.stringify(data))}</div>
        </div>
      </div>
    </div>
  `;
}

function renderUserToolResult(data) {
  // Handle various formats of user messages with tool results
  let content = null;
  
  // Check different possible structures
  if (data.message && data.message.content) {
    // Structure: { type: 'user', message: { content: [...] } }
    content = data.message.content;
  } else if (data.content) {
    // Structure: { type: 'user', content: [...] }
    content = data.content;
  } else if (data.role === 'user' && data.content) {
    // Structure: { role: 'user', content: [...] }
    content = data.content;
  }
  
  // Always show something for user messages
  const results = [];
  
  // Extract tool results from user messages
  if (content && Array.isArray(content)) {
    for (const item of content) {
      if (item.type === 'tool_result') {
        const isError = item.is_error || false;
        const itemContent = item.content || '';
        
        if (isError) {
          // Error message - show in red
          results.push(`
            <div class="bg-red-50 rounded-lg p-3 border border-red-200 shadow-sm mb-2">
              <div class="flex items-start space-x-2">
                <span class="text-red-600">⚠️</span>
                <div class="flex-1">
                  <div class="text-sm font-medium text-red-900">Error</div>
                  <div class="text-xs text-red-700 mt-1">${escapeHtml(itemContent)}</div>
                </div>
              </div>
            </div>
          `);
        } else if (itemContent.trim()) {
          // Regular tool result - show content as is
          const lines = itemContent.split('\n');
          const isLongOutput = lines.length > 10 || itemContent.length > 500;
          const displayContent = isLongOutput ? 
            lines.slice(0, 10).join('\n') + '\n[... truncated]' : 
            itemContent;
          
          results.push(`
            <div class="bg-gray-50 rounded-lg p-2.5 border border-gray-200 shadow-sm mb-2">
              <div class="flex items-start space-x-2">
                <span class="text-gray-500 text-xs">↩</span>
                <div class="flex-1">
                  <pre class="text-xs text-gray-600 whitespace-pre-wrap font-mono">${escapeHtml(displayContent)}</pre>
                </div>
              </div>
            </div>
          `);
        }
      }
    }
  }
  
  // Return results if we found any
  if (results.length > 0) {
    return results.join('');
  }
  
  // Fallback - show the content in a nice UI format
  // Check for content in various locations
  let fallbackContent = null;
  if (data.message && data.message.content) {
    fallbackContent = data.message.content;
  } else if (data.content) {
    fallbackContent = data.content;
  }
  
  if (fallbackContent) {
    // We have content but couldn't parse specific tool results
    let messageContent = '';
    if (Array.isArray(fallbackContent)) {
      // Extract text from content array
      const textParts = fallbackContent.map(item => {
        if (typeof item === 'string') return item;
        if (item.content) return item.content;
        if (item.text) return item.text;
        return '';
      }).filter(Boolean);
      messageContent = textParts.join('\n');
    } else if (typeof fallbackContent === 'string') {
      messageContent = fallbackContent;
    }
    
    if (messageContent) {
      return `
        <div class="bg-gray-50 rounded-lg p-3 border border-gray-300 shadow-sm">
          <div class="flex items-start space-x-2">
            <span class="text-gray-600">ℹ️</span>
            <div class="flex-1">
              <div class="text-xs font-medium text-gray-700 mb-1">System Feedback</div>
              <div class="text-xs text-gray-600">
                <pre class="whitespace-pre-wrap">${escapeHtml(messageContent)}</pre>
              </div>
            </div>
          </div>
        </div>
      `;
    }
  }
  
  // Don't show anything if we couldn't extract meaningful content
  return '';
}

function renderError(data) {
  return `
    <div class="bg-red-50 rounded-lg p-3 border border-red-200 shadow-sm">
      <div class="flex items-start space-x-2">
        <span class="text-red-600">⚠️</span>
        <div class="flex-1">
          <div class="text-sm font-medium text-red-900">Error</div>
          <div class="text-xs text-red-700 mt-1">${escapeHtml(data.error || data.message || 'Unknown error')}</div>
          ${data.stack ? `
            <details class="mt-2">
              <summary class="text-xs text-red-600 cursor-pointer">Stack trace</summary>
              <pre class="text-xs mt-1 bg-white p-2 rounded border text-red-600 overflow-x-auto">${escapeHtml(data.stack)}</pre>
            </details>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

function renderSystemMessage(data) {
  // Extract the actual message content
  let messageContent = '';
  if (data.message) {
    messageContent = typeof data.message === 'string' ? data.message : JSON.stringify(data.message, null, 2);
  } else if (data.content) {
    // Handle content field which might be an array
    if (Array.isArray(data.content)) {
      const textContent = data.content.find(c => c.type === 'text');
      messageContent = textContent ? textContent.text : JSON.stringify(data.content, null, 2);
    } else {
      messageContent = typeof data.content === 'string' ? data.content : JSON.stringify(data.content, null, 2);
    }
  } else if (typeof data === 'object') {
    // If there's other data, show it formatted
    const { type, subtype, ...otherData } = data;
    if (Object.keys(otherData).length > 0) {
      messageContent = JSON.stringify(otherData, null, 2);
    }
  }
  
  return `
    <div class="bg-blue-50 rounded-lg p-3 border border-blue-200 shadow-sm">
      <div class="flex items-start space-x-2">
        <span class="text-blue-600">ℹ️</span>
        <div class="flex-1">
          <div class="text-sm font-medium text-blue-900">System: ${escapeHtml(data.subtype || data.type)}</div>
          ${messageContent ? `<div class="text-xs text-blue-700 mt-1"><pre class="whitespace-pre-wrap">${escapeHtml(messageContent)}</pre></div>` : ''}
        </div>
      </div>
    </div>
  `;
}

function renderResult(data) {
  const isSuccess = !data.is_error;
  return `
    <div class="bg-gradient-to-r ${isSuccess ? 'from-green-50 to-emerald-50 border-green-300' : 'from-red-50 to-pink-50 border-red-300'} rounded-lg p-4 border-2 shadow-sm">
      <div class="flex items-start space-x-3">
        <div class="w-8 h-8 rounded-full flex items-center justify-center ${isSuccess ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}">
          ${isSuccess ? '✓' : '✗'}
        </div>
        <div class="flex-1">
          <div class="text-sm font-semibold ${isSuccess ? 'text-green-900' : 'text-red-900'} mb-2">
            Execution ${isSuccess ? 'Complete' : 'Failed'}
          </div>
          <div class="text-xs space-y-1">
            ${data.duration_ms ? `<div><span class="font-medium">Duration:</span> ${(data.duration_ms / 1000).toFixed(2)}s</div>` : ''}
            ${data.num_turns ? `<div><span class="font-medium">Turns:</span> ${data.num_turns}</div>` : ''}
            ${data.total_cost_usd ? `<div><span class="font-medium">Cost:</span> $${data.total_cost_usd.toFixed(4)}</div>` : ''}
            ${data.usage?.output_tokens ? `
              <div><span class="font-medium">Tokens:</span> ${data.usage.input_tokens || 0} in / ${data.usage.output_tokens} out</div>
            ` : ''}
          </div>
          ${data.result ? `
            <div class="mt-2 p-2 bg-white rounded border">
              <pre class="text-xs overflow-x-auto whitespace-pre-wrap">${escapeHtml(data.result)}</pre>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

function getToolIcon(toolName) {
  const icons = {
    'Task': '🎯',
    'Bash': '💻',
    'Read': '📖',
    'Write': '✍️',
    'Edit': '✏️',
    'MultiEdit': '📝',
    'Glob': '🔍',
    'Grep': '🔎',
    'LS': '📁',
    'TodoWrite': '📋',
    'WebSearch': '🌐',
    'WebFetch': '🌍',
    'NotebookEdit': '📓',
    'ExitPlanMode': '🚪',
    'BashOutput': '📊',
    'KillBash': '🛑'
  };
  
  if (toolName.includes('mcp__')) return '🔌';
  return icons[toolName] || '🔧';
}

function createSpinner() {
  return `
    <div class="flex items-center space-x-2 text-gray-500 p-4">
      <div class="animate-spin h-4 w-4 border-2 border-gray-400 rounded-full border-t-transparent"></div>
      <span class="text-sm">Thinking...</span>
    </div>
  `;
}

async function sendMessage() {
  if (!currentAgentId) {
    alert('Please select or create an agent first');
    return;
  }
  
  if (!messageInput || !messageInput.value.trim() || isExecuting) return;
  
  const message = messageInput.value.trim();
  messageInput.value = '';
  isExecuting = true;
  
  if (sendButton) sendButton.classList.add('hidden');
  if (stopButton) stopButton.classList.remove('hidden');
  if (agentStatus) agentStatus.textContent = 'Thinking...';
  
  // Clear "no agent" message if present
  const noAgentMsg = messages.querySelector('.text-gray-400');
  if (noAgentMsg) {
    messages.innerHTML = '';
    allMessages = [];
  }
  
  // Add user message
  addMessage('user', message);
  
  // Always add spinner for new messages
  const spinnerId = 'spinner-' + Date.now();
  const spinnerDiv = document.createElement('div');
  spinnerDiv.id = spinnerId;
  spinnerDiv.className = 'mt-2';
  spinnerDiv.innerHTML = createSpinner();
  messages.appendChild(spinnerDiv);
  // Ensure spinner is visible
  requestAnimationFrame(() => {
    spinnerDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
  });
  
  let assistantMessage = null;
  
  try {
    console.log('Sending message to agent:', currentAgentId);
    
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: currentAgentId, message })
    });
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    currentReader = response.body.getReader();
    let buffer = '';
    
    while (true) {
      const { done, value } = await currentReader.read();
      if (done) break;
      
      buffer += new TextDecoder().decode(value);
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            console.log('Received:', data.type, data);
            
            // Debug logging for user messages
            if (data.type === 'agent' && data.data) {
              if (data.data.type === 'user' || data.data.role === 'user') {
                console.log('USER MESSAGE DETECTED:', JSON.stringify(data.data, null, 2));
              }
            }
            
            // Don't remove spinner here - keep it until done
            
            if (data.type === 'error') {
              addRichMessage(renderError(data));
            } else if (data.type === 'agent') {
              const claudeData = data.data;
              
              switch (claudeData.type) {
                case 'system':
                  if (claudeData.subtype === 'init') {
                    addRichMessage(renderSystemInit(claudeData));
                  } else {
                    addRichMessage(renderSystemMessage(claudeData));
                  }
                  break;
                  
                case 'assistant':
                  // Handle assistant messages with potentially multiple content items
                  if (claudeData.message?.content) {
                    if (Array.isArray(claudeData.message.content)) {
                      // Process each content item in the array
                      for (const contentItem of claudeData.message.content) {
                        if (contentItem.type === 'text' && contentItem.text) {
                          // Display text content
                          if (!assistantMessage) {
                            assistantMessage = addMessage('assistant', contentItem.text);
                          } else {
                            updateMessage(assistantMessage, contentItem.text);
                          }
                        } else if (contentItem.type === 'tool_use') {
                          // Display tool use inline as a rich message
                          addRichMessage(renderToolUse(contentItem));
                        }
                      }
                    } else if (typeof claudeData.message.content === 'string') {
                      // Handle string content
                      if (!assistantMessage) {
                        assistantMessage = addMessage('assistant', claudeData.message.content);
                      } else {
                        updateMessage(assistantMessage, claudeData.message.content);
                      }
                    }
                  } else if (claudeData.content) {
                    // Handle direct content field (fallback)
                    const text = Array.isArray(claudeData.content) 
                      ? claudeData.content.find(item => item.type === 'text')?.text || ''
                      : typeof claudeData.content === 'string' 
                        ? claudeData.content 
                        : '';
                    if (text) {
                      if (!assistantMessage) {
                        assistantMessage = addMessage('assistant', text);
                      } else {
                        updateMessage(assistantMessage, text);
                      }
                    }
                    // Process tool_use items if present in content array
                    if (Array.isArray(claudeData.content)) {
                      for (const item of claudeData.content) {
                        if (item.type === 'tool_use') {
                          addRichMessage(renderToolUse(item));
                        }
                      }
                    }
                  }
                  break;
                  
                case 'tool_use':
                  addRichMessage(renderToolUse(claudeData));
                  break;
                  
                case 'tool_result':
                  addRichMessage(renderToolResult(claudeData));
                  break;
                  
                case 'todos':
                  if (claudeData.todos) {
                    addRichMessage(renderTodos(claudeData.todos));
                  }
                  break;
                  
                case 'user_feedback':
                  addRichMessage(renderUserFeedback(claudeData));
                  break;
                  
                case 'user':
                  // Handle user type messages with tool results
                  console.log('Processing user case:', claudeData);
                  addRichMessage(renderUserToolResult(claudeData));
                  break;
                  
                case 'error':
                  addRichMessage(renderError(claudeData));
                  break;
                  
                case 'result':
                  addRichMessage(renderResult(claudeData));
                  break;
                  
                default:
                  // Show any other message types as system messages
                  if (claudeData.type === 'user' && (claudeData.content || claudeData.role === 'user')) {
                    // Handle user messages that weren't caught above
                    addRichMessage(renderUserToolResult(claudeData));
                  } else if (claudeData.type) {
                    addRichMessage(renderSystemMessage(claudeData));
                  }
              }
            } else if (data.type === 'done') {
              console.log('Stream completed');
              // Remove spinner when stream is done
              const spinner = document.getElementById(spinnerId);
              if (spinner) spinner.remove();
              if (agentStatus) agentStatus.textContent = 'Ready to chat';
              break;
            }
          } catch (e) {
            console.error('Failed to parse SSE data:', e, line);
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to send message:', error);
    addRichMessage(renderError({ error: error.message }));
  } finally {
    // Remove spinner if still present
    const spinner = document.getElementById(spinnerId);
    if (spinner) spinner.remove();
    
    isExecuting = false;
    currentReader = null;
    if (stopButton) stopButton.classList.add('hidden');
    if (sendButton) sendButton.classList.remove('hidden');
    if (agentStatus) agentStatus.textContent = 'Ready to chat';
  }
}

function addMessage(role, content, id) {
  if (!messages) return;
  
  const msgId = id || 'msg-' + (++messageIdCounter);
  const msgDiv = document.createElement('div');
  msgDiv.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'} mb-4 animate-fade-in`;
  msgDiv.id = msgId;
  
  const roleClass = role === 'user' ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg' : 'bg-white border border-gray-200 shadow-sm';
  msgDiv.innerHTML = `
    <div class="${roleClass} rounded-lg px-5 py-3 max-w-3xl">
      <div class="text-xs font-semibold mb-2 ${role === 'user' ? 'text-blue-100' : 'text-gray-500'}">
        ${role === 'user' ? 'You' : 'Claude'}
      </div>
      <div class="message-content whitespace-pre-wrap">${escapeHtml(content)}</div>
    </div>
  `;
  
  // Find any spinner and insert before it, otherwise append
  const spinner = messages.querySelector('[id^="spinner-"]');
  if (spinner) {
    messages.insertBefore(msgDiv, spinner);
    requestAnimationFrame(() => {
      spinner.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  } else {
    messages.appendChild(msgDiv);
    requestAnimationFrame(() => {
      msgDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  }
  allMessages.push({ id: msgId, role, content });
  return msgId;
}

function addRichMessage(htmlContent) {
  if (!messages) return;
  
  const msgDiv = document.createElement('div');
  msgDiv.className = 'mb-3 animate-fade-in';
  msgDiv.innerHTML = htmlContent;
  
  // Find any spinner and insert before it, otherwise append
  const spinner = messages.querySelector('[id^="spinner-"]');
  if (spinner) {
    messages.insertBefore(msgDiv, spinner);
    // Scroll to keep latest content and spinner in view
    requestAnimationFrame(() => {
      spinner.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  } else {
    messages.appendChild(msgDiv);
    // Scroll to show new message
    requestAnimationFrame(() => {
      msgDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  }
}

function updateMessage(id, content) {
  const msgDiv = document.getElementById(id);
  if (msgDiv) {
    const contentDiv = msgDiv.querySelector('.message-content');
    if (contentDiv) {
      contentDiv.textContent = content;
      // Scroll to show updated message
      requestAnimationFrame(() => {
        const spinner = messages.querySelector('[id^="spinner-"]');
        if (spinner) {
          spinner.scrollIntoView({ behavior: 'smooth', block: 'end' });
        } else {
          msgDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      });
    }
  }
}

async function stopExecution() {
  if (!currentAgentId || !isExecuting) return;
  
  try {
    // Cancel the current read operation
    if (currentReader) {
      await currentReader.cancel();
    }
    
    // Send stop request to server
    await fetch('/api/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: currentAgentId })
    });
    
    isExecuting = false;
    if (stopButton) stopButton.classList.add('hidden');
    if (sendButton) sendButton.classList.remove('hidden');
    if (agentStatus) agentStatus.textContent = 'Stopped';
    
    addRichMessage(renderSystemMessage({ 
      type: 'system', 
      subtype: 'stopped',
      message: 'Execution stopped by user' 
    }));
  } catch (error) {
    console.error('Failed to stop execution:', error);
  }
}

// Removed permission handling - now using bypassPermissions mode

function escapeHtml(text) {
  // Handle different types of input
  let stringValue = '';
  if (typeof text === 'string') {
    stringValue = text;
  } else if (text === null || text === undefined) {
    stringValue = '';
  } else if (typeof text === 'object') {
    // Convert objects to JSON string for display
    stringValue = JSON.stringify(text, null, 2);
  } else {
    stringValue = String(text);
  }
  
  const div = document.createElement('div');
  div.textContent = stringValue;
  return div.innerHTML;
}