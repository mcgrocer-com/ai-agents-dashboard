# Dynamic Agent System Guide

This document explains the intelligent task delegation and dynamic agent creation system.

## System Overview

The system provides three levels of task handling:

1. **Direct Handling** - Claude handles simple tasks directly
2. **Delegate to Existing Agents** - Route to specialized agents for known domains
3. **Create Custom Agents** - Generate new specialists only for complex, reusable capabilities

## How to Use

### `/delegate-to-subagent` Command

This slash command automatically analyzes your request and determines the optimal approach:

```
/delegate-to-subagent
```

The system will:
1. Check if an existing agent matches your need
2. Assess task complexity if no match found
3. Either handle directly OR create a specialized agent
4. Track all agents in the registry for future use

## Decision Framework

### ✅ Claude Handles Directly When:

- **Simple file operations**: Read, write, edit, basic modifications
- **Quick code fixes**: Bug fixes, simple refactoring, formatting
- **Straightforward features**: Standard CRUD operations, simple API endpoints
- **General queries**: Status checks, information retrieval, documentation
- **One-time tasks**: Unlikely to be repeated
- **Standard tools sufficient**: Can be completed efficiently with existing tools
- **Time estimate**: < 30 minutes of work

**Examples**:
- "Fix typo in README"
- "Add a new API endpoint for user profile"
- "Write a migration script"
- "Update the color scheme in CSS"

### 🎯 Delegates to Existing Agent When:

- **Perfect domain match**: Request fits an existing specialist's expertise
- **Proven capability**: Agent has successfully handled similar tasks before
- **Specialized tools**: Agent has necessary MCP tools or framework expertise

**Available Specialists**:
- `crewai-specialist` - CrewAI framework work
- `supabase-backend-expert` - Database, RLS, edge functions
- `frontend-developer` - React, UI components
- `documentation-manager` - Documentation updates
- `pragmatic-code-review` - Code quality reviews
- `design-review` - UI/UX reviews
- `validation-gates` - Testing and QA
- `task-orchestrator/executor/checker` - Task management

**Examples**:
- "Create a new Supabase table with RLS policies" → supabase-backend-expert
- "Review this code for best practices" → pragmatic-code-review
- "Build a responsive dashboard component" → frontend-developer

### 🏭 Creates New Agent ONLY When:

Must meet **multiple** criteria:

- **Complex domain expertise**: Payment processing, ML pipelines, blockchain, etc.
- **External API integration**: Requires custom MCP tools (Stripe, Shopify, AWS, etc.)
- **High reusability**: Will be needed repeatedly for similar tasks
- **Multi-service orchestration**: Complex workflows with multiple external services
- **Specialized tooling benefits**: Task significantly benefits from dedicated tools
- **Time complexity**: > 30 minutes with standard approach
- **Long-term value**: Ongoing requirement, not temporary need

**Examples**:
- "Integrate Stripe payment processing with subscription billing"
  - Creates: `stripe-payment-specialist` with Stripe MCP tools
- "Set up end-to-end ML inference pipeline with monitoring"
  - Creates: `ml-inference-specialist` with custom monitoring tools
- "Build Shopify inventory sync system"
  - Creates: `shopify-sync-specialist` with Shopify MCP tools

## Agent Registry

All agents (built-in and custom) are tracked in `.claude/agents/registry.json`:

```json
{
  "agents": {
    "existing": [...],  // Built-in agents
    "custom": [         // Dynamically created agents
      {
        "name": "stripe-payment-specialist",
        "description": "Stripe payment integration expert",
        "domains": ["payments", "stripe", "subscriptions"],
        "tools": ["Read", "Write", "Edit"],
        "mcpTools": ["stripe-mcp"],
        "createdAt": "2024-01-15T10:00:00Z",
        "usageCount": 5,
        "successRate": 0.95
      }
    ]
  }
}
```

## MCP Tool Creation (Only When Essential)

**CRITICAL**: MCP tools are created ONLY for:
- **FREE** services or services requiring only **LLM API keys**
- When **ESSENTIAL** to the agent's core expertise

**For PAID services**: Use WebFetch or Bash instead of creating MCP tools.

### When to Create MCP Tools:

✅ **CREATE MCP**:
- Supabase (FREE tier + ESSENTIAL for Supabase expert)
- GitHub (FREE + ESSENTIAL for GitHub specialist)
- OpenAI (LLM_API_KEY + ESSENTIAL for AI integration expert)

❌ **DON'T CREATE MCP** (use WebFetch/Bash):
- Stripe (PAID service)
- Shopify (PAID service)
- AWS services (PAID service)
- SendGrid (PAID service)
- Twilio (PAID service)

### Process (Only if Justified):
1. **Cost Check**: Verify service is FREE or LLM_API_KEY
2. **Essentiality Check**: Confirm MCP is ESSENTIAL to expertise
3. **Alternative Check**: Verify WebFetch/Bash insufficient
4. **Create**: Only if all checks pass
5. Install to `C:\Users\izzy\.claude.json`
6. Link to agent in registry

### Templates Available:
- **api-integration.json** - For FREE APIs only (GitHub, OpenAI)
- **database-connector.json** - For databases with FREE tiers
- **service-integration.json** - For FREE services only

### Example - FREE Service MCP:
```json
{
  "github-mcp": {
    "command": "npx",
    "args": ["-y", "@custom/github-mcp-server"],
    "env": {
      "GITHUB_TOKEN": "ghp_..."
    }
  }
}
```

### Example - PAID Service (NO MCP):
```javascript
// For Stripe - Use WebFetch instead
const response = await WebFetch({
  url: 'https://api.stripe.com/v1/customers',
  headers: {
    'Authorization': `Bearer ${STRIPE_KEY}`
  }
});
```

## System Components

### 1. Agent Registry (`.claude/agents/registry.json`)
- Central tracking of all agents
- MCP tool configurations
- Usage statistics and performance metrics

### 2. MCP Tool Builder (`.claude/agents/mcp-tool-builder.md`)
- Creates custom MCP server configurations
- Installs tools to Claude.json
- Validates connectivity and security

### 3. MCP Templates (`.claude/mcp-templates/`)
- Reusable patterns for common integrations
- Pre-configured for popular services
- Customizable for specific needs

### 4. Subagent Factory (`.claude/agents/subagent-factory.md`)
- Assesses task complexity
- Creates justified agents only
- Auto-updates registry and slash commands
- Invokes MCP tool builder when needed

### 5. Delegate Command (`.claude/commands/delegate.md`)
- Analyzes user requests
- Routes to appropriate handler
- Reads from dynamic registry
- Shows available agents and their MCP tools

## Workflow Example 1: Stripe Integration (PAID - NO MCP)

**User Request**: "Integrate Stripe payment processing for subscription billing"

### Step 1: Analysis
```yaml
Task: Stripe subscription integration
Complexity: High (8/10)
Reusability: Frequent
External Integration: Yes (Stripe API - PAID)
MCP Decision: NO - Stripe is PAID, use WebFetch instead
Decision: CREATE AGENT (without MCP tools)
```

### Step 2: Agent Creation
```yaml
Agent Name: stripe-payment-specialist
Domain: Payment processing
Required MCP: NONE (Stripe is PAID service)
Tools: Read, Write, Edit, TodoWrite, WebFetch
Implementation: Use WebFetch for Stripe API calls
```

### Step 3: NO MCP Tool Creation
```javascript
// NO MCP tool - Agent uses WebFetch instead:
async function createStripeCustomer(email) {
  return await WebFetch({
    url: 'https://api.stripe.com/v1/customers',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${STRIPE_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `email=${email}`
  });
}
```

### Step 4: Installation (No MCP)
- Agent config → `.claude/agents/stripe-payment-specialist.md`
- Registry update → `.claude/agents/registry.json` (mcpTools: [])
- Slash command update → Auto-regenerated
- NO changes to `C:\Users\izzy\.claude.json`

### Step 5: Future Use
Next time: "Process a Stripe payment" → Auto-routes to `stripe-payment-specialist` (uses WebFetch)

---

## Workflow Example 2: GitHub Integration (FREE - WITH MCP)

**User Request**: "Create GitHub repository management specialist"

### Step 1: Analysis
```yaml
Task: GitHub repository automation
Complexity: High (8/10)
Reusability: Frequent
External Integration: Yes (GitHub API - FREE)
MCP Decision: YES - GitHub is FREE + ESSENTIAL to expertise
Decision: CREATE AGENT with MCP tools
```

### Step 2: Agent Creation
```yaml
Agent Name: github-specialist
Domain: GitHub repository management
Required MCP: github-mcp
Tools: Read, Write, Edit, TodoWrite + github-mcp
```

### Step 3: MCP Tool Creation (Justified)
```javascript
// MCP Tool Builder creates:
{
  "github-mcp": {
    "command": "npx",
    "args": ["-y", "@custom/github-mcp-server"],
    "env": {
      "GITHUB_TOKEN": "ghp_..."
    }
  }
}
```

### Step 4: Installation
- MCP tool → `C:\Users\izzy\.claude.json`
- Agent config → `.claude/agents/github-specialist.md`
- Registry update → `.claude/agents/registry.json` (mcpTools: ["github-mcp"])
- Slash command update → Auto-regenerated

### Step 5: Future Use
Next time: "Create a GitHub PR" → Auto-routes to `github-specialist` (uses github-mcp)

## Best Practices

### ✅ DO:
- Use `/delegate-to-subagent` for complex or specialized tasks
- Let the system decide: direct handling vs agent creation
- Create agents for reusable, complex capabilities
- Use WebFetch/Bash for PAID services (Stripe, Shopify, AWS, etc.)
- Create MCP tools ONLY for FREE/LLM_API_KEY services
- Ensure MCP tools are ESSENTIAL to agent's core expertise

### ❌ DON'T:
- Create agents for simple, one-time tasks
- Bypass the complexity analysis
- Create duplicate agents (check registry first)
- Create MCP tools for PAID services (use WebFetch instead)
- Create MCP tools when WebFetch/Bash would suffice
- Hardcode API credentials (use environment variables)

### MCP Tool Guidelines:
- ✅ **CREATE**: Supabase-mcp (FREE + ESSENTIAL for Supabase expert)
- ✅ **CREATE**: GitHub-mcp (FREE + ESSENTIAL for GitHub specialist)
- ❌ **NO MCP**: Stripe (PAID - use WebFetch)
- ❌ **NO MCP**: AWS (PAID - use Bash with aws-cli)
- ❌ **NO MCP**: Shopify (PAID - use WebFetch)

## Performance Tracking

The registry tracks:
- **Usage Count**: How many times each agent is used
- **Success Rate**: Task completion rate
- **Creation Date**: When the agent was created
- **MCP Tools**: Which external integrations are available

This data helps optimize future delegations and identifies valuable agents.

## Key Principles

1. **Efficiency First** - Handle simple tasks directly
2. **Expertise When Needed** - Delegate to specialists for domain work
3. **Strategic Agent Creation** - Only for complex, reusable capabilities
4. **Cost-Benefit Analysis** - Justify agent creation with long-term value
5. **Progressive Enhancement** - Start simple, add specialists as complexity grows

---

**Result**: An intelligent system that optimizes between efficiency (direct handling) and expertise (specialized agents), creating new capabilities only when truly justified.