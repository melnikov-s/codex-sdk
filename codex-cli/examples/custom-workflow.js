#!/usr/bin/env node

// Import the necessary functions from the Codex CLI library
const { runCliWithWorkflow, AutoApprovalMode } = require('../../dist/lib.js');
const { streamText, generateText } = require('ai');

/**
 * Create a custom workflow factory for integrating with your own LLM and MCP clients
 * This is where you implement your agent logic and LLM interactions
 * 
 * @param {Object} hooks - Workflow hooks provided by Codex CLI
 * @returns {Object} - A Workflow object that implements the required interface
 */
function createCustomWorkflow(hooks) {
  // Your private workflow state
  let transcript = [];
  let canceled = false;
  let execAbortController = null;
  
  // You can manage your own MCP clients here
  const mcpClients = [
    // Example MCP client definition
    // {
    //   name: "mymcp",
    //   client: createMyMCPClient(),
    //   connected: true
    // }
  ];
  
  // Create your abort controller
  const hardAbort = new AbortController();
  hardAbort.signal.addEventListener(
    "abort",
    () => execAbortController?.abort(),
    { once: true }
  );
  
  // Return a workflow object that implements the required interface
  return {
    /**
     * Stop the current workflow execution
     */
    stop() {
      execAbortController?.abort();
      execAbortController = new AbortController();
      hooks.logger("Workflow.stop(): execAbortController.abort() called");
      hooks.setLoading(false);
      canceled = true;
    },
    
    /**
     * Terminate the workflow completely
     */
    terminate() {
      hardAbort.abort();
      this.stop();
      
      // Clean up your MCP clients here
      for (const client of mcpClients) {
        if (client.connected && client.client) {
          try {
            client.client.close();
          } catch (error) {
            hooks.logger(`Error closing MCP client ${client.name}: ${error}`);
          }
        }
      }
    },
    
    /**
     * Run the workflow with input messages
     * 
     * @param {Array} input - Array of CoreMessages from the user
     * @param {Object} opts - Optional parameters
     * @returns {Array} - Array of response CoreMessages
     */
    async run(input, opts = {}) {
      // Reset canceled state
      canceled = false;
      
      // Add input to transcript
      transcript.push(...input);
      
      // Set up variables for the agent loop
      let isRunning = true;
      hooks.setLoading(true);
      const maxTurns = 30;
      let currentTurn = 0;
      
      // Create abort controller for this run
      execAbortController = new AbortController();
      
      // Connect external abort signal if provided
      if (opts?.signal) {
        opts.signal.addEventListener('abort', () => {
          hooks.logger("External abort signal received");
          execAbortController?.abort();
          this.stop();
        }, { once: true });
      }
      
      // Store new messages
      const newMessages = [];
      
      // Run the agent loop
      while (isRunning && currentTurn < maxTurns && !canceled) {
        currentTurn++;
        
        try {
          // You can collect MCP tools from your own clients
          const mcpTools = {};
          
          // Define your system prompt
          const systemPrompt = `You are a helpful AI assistant working in a terminal environment. 
You can run shell commands and help users with coding tasks.`;
          
          // Call your LLM using the Vercel AI SDK or any other method
          const response = await generateText({
            maxSteps: 1,
            model: 'your-model-identifier', // Use your preferred model
            messages: [
              { role: "system", content: systemPrompt },
              ...transcript
            ],
            tools: {
              // Define your tools here
              shell: {
                description: "Run a shell command",
                parameters: {
                  type: "object",
                  properties: {
                    cmd: {
                      type: "array",
                      items: { type: "string" },
                      description: "The command to run"
                    },
                    workdir: {
                      type: "string",
                      description: "Working directory"
                    }
                  },
                  required: ["cmd"]
                }
              },
              // Add more tools from hooks.tools
              ...hooks.tools,
              // Add MCP tools if available
              ...mcpTools
            },
            signal: execAbortController.signal
          });
          
          // Process the response
          const { messages, finishReason } = response.response;
          
          // Track if any tool calls were made
          let hasToolCalls = false;
          
          // Process messages
          if (messages && messages.length > 0) {
            for (const message of messages) {
              // Add to local records
              newMessages.push(message);
              transcript.push(message);
              
              // Send to UI
              hooks.onItem(message);
              
              // Check for tool calls
              if (message.role === 'assistant' && message.content) {
                // Handle tool calls using hook
                const toolCall = extractToolCall(message);
                if (toolCall) {
                  hasToolCalls = true;
                  
                  const toolResult = await hooks.handleToolCall(message);
                  
                  if (toolResult) {
                    transcript.push(toolResult);
                    hooks.onItem(toolResult);
                    newMessages.push(toolResult);
                  }
                }
              }
            }
            
            // Continue loop if we're not done
            if (finishReason === "stop" && !hasToolCalls) {
              isRunning = false;
            }
          } else {
            isRunning = false;
          }
        } catch (error) {
          hooks.logger(`Error in workflow run: ${error.message}`);
          if (hooks.onError) {
            hooks.onError(error);
          }
          
          const errorMessage = {
            role: "system",
            content: `Error: ${error.message}`
          };
          newMessages.push(errorMessage);
          hooks.onItem(errorMessage);
          isRunning = false;
        }
      }
      
      // Clean up
      hooks.setLoading(false);
      
      // Return the new messages generated during this run
      return newMessages;
    }
  };
}

// Helper function to extract tool calls from messages
function extractToolCall(message) {
  if (message.role !== 'assistant' || !message.content) return null;
  
  // If using the Vercel AI SDK format
  if (message.tool_calls && message.tool_calls.length > 0) {
    const toolCall = message.tool_calls[0];
    return {
      toolName: toolCall.function.name,
      toolCallId: toolCall.id,
      args: JSON.parse(toolCall.function.arguments)
    };
  }
  
  return null;
}

// Configure CLI options
const options = {
  approvalPolicy: AutoApprovalMode.SUGGEST,
  config: {
    notify: true,
    tools: {
      shell: {
        maxBytes: 100000,
        maxLines: 1000
      }
    }
  }
};

// Launch the CLI with our custom workflow
runCliWithWorkflow(createCustomWorkflow, options);
