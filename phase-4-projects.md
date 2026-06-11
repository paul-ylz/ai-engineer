# Phase 4 Projects: Agents and Workflow Orchestration

These five projects build on Phase 2 foundations to create autonomous agents and multi-step workflows. Each project leverages cloud infrastructure experience directly. They are independent — build in any order.

---

## Project 1: Incident-Response Agent

### Objective

Build an agent that triages production incidents by gathering context from multiple systems (logs, metrics, runbooks), correlating data, and proposing remediation steps — with human approval before any action is taken. This is the project that most directly leverages your cloud engineering background.

### What You'll Learn

- Multi-tool orchestration for a real operational workflow
- Structured incident analysis with LLMs
- Human-in-the-loop approval for critical actions
- State management across a multi-step investigation
- Integrating with infrastructure APIs (simulated or real)

### Architecture

```
┌────────────────┐
│ Incident Alert │
│ (PagerDuty /   │
│  webhook)      │
└───────┬────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                  INCIDENT AGENT                              │
│                                                              │
│  ┌─────────────┐                                            │
│  │ 1. Gather   │──→ Query logs (Loki/ES)                    │
│  │    Context   │──→ Check metrics (Prometheus)              │
│  │              │──→ Check recent deployments (GitHub/CI)    │
│  │              │──→ Search runbooks (RAG on docs)           │
│  └──────┬──────┘                                            │
│         │                                                    │
│  ┌──────▼──────┐                                            │
│  │ 2. Analyze  │──→ Correlate signals                       │
│  │    & Triage  │──→ Identify probable root cause            │
│  │              │──→ Assign severity (P1–P4)                │
│  └──────┬──────┘                                            │
│         │                                                    │
│  ┌──────▼──────┐                                            │
│  │ 3. Propose  │──→ Generate remediation steps              │
│  │   Actions   │──→ Match to runbook procedures             │
│  │              │──→ Estimate impact/risk per action         │
│  └──────┬──────┘                                            │
│         │                                                    │
│  ┌──────▼──────┐                                            │
│  │ 4. Approval │──→ Present plan to on-call engineer        │
│  │    Gate      │──→ Wait for approve/reject/modify         │
│  └──────┬──────┘                                            │
│         │                                                    │
│  ┌──────▼──────┐                                            │
│  │ 5. Execute  │──→ Run approved actions                    │
│  │   & Report  │──→ Verify resolution                       │
│  │              │──→ Generate post-incident summary          │
│  └─────────────┘                                            │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Component | Choice | Why |
|-----------|--------|-----|
| Language | Python 3.11+ | |
| Agent framework | LangGraph or plain tool-calling loop | LangGraph adds state management; plain loop for simplicity |
| LLM | GPT-4o or Claude Sonnet | Strong reasoning for root-cause analysis |
| Runbook search | RAG pipeline (from Phase 2) | Reuse your RAG knowledge |
| Simulated infra | Local JSON/SQLite fixtures | Simulate Prometheus, logs, deployment history |
| State management | SQLite or Redis | Track incident state across steps |
| Web framework | FastAPI | |

### Step-by-Step Implementation

**Step 1: Build simulated infrastructure data sources**

You don't need real production systems for this project. Create realistic fixtures:

- **Logs fixture:** JSON file with timestamped log entries, varying severity levels, service names, and error messages. Include patterns like connection timeouts, OOM errors, 5xx spikes.
- **Metrics fixture:** Time-series data for CPU, memory, request latency, error rate. Include an anomaly window (e.g., error rate spikes from 0.1% to 15%).
- **Deployment history fixture:** List of recent deployments with timestamp, service, commit hash, deployer.
- **Runbooks:** 5–10 Markdown documents covering common incidents (database connection pool exhaustion, memory leak, DNS failure, certificate expiry, deployment rollback procedure).

Create tool wrappers that query these fixtures as if they were real APIs.

**Step 2: Implement the context-gathering tools**

- `query_logs(service, severity, time_range)` → returns matching log entries
- `query_metrics(service, metric_name, time_range)` → returns time-series data
- `list_recent_deployments(service, hours)` → returns deployment history
- `search_runbooks(query)` → RAG search over runbook documents (reuse Phase 2 code)
- `get_service_dependencies(service)` → returns upstream/downstream services

**Step 3: Build the analysis step**

- After gathering context, feed all collected data to the LLM with a structured analysis prompt:
  ```
  You are an SRE investigating a production incident.

  Logs: {logs}
  Metrics: {metrics}
  Recent deployments: {deployments}
  Relevant runbooks: {runbook_excerpts}

  Analyze the data and produce:
  1. Probable root cause
  2. Severity assessment (P1-P4)
  3. Affected services
  4. Timeline of events
  ```
- Use structured output to enforce the analysis schema.

**Step 4: Remediation proposal**

- Based on the analysis, have the LLM propose concrete remediation steps.
- Each step should include:
  - Action description
  - Risk level (low/medium/high)
  - Expected impact
  - Rollback plan if the action makes things worse
  - Matching runbook reference (if available)
- High-risk actions (e.g., "restart production database") must be flagged.

**Step 5: Human approval gate**

- Present the analysis and proposed actions via the API.
- The on-call engineer can:
  - Approve all actions
  - Approve specific actions
  - Reject and provide alternative instructions
  - Request more investigation
- Use a simple state machine: `investigating → proposed → approved → executing → resolved`

**Step 6: Execution and reporting**

- Execute approved actions (simulated — log what would happen).
- After execution, verify resolution by re-checking metrics.
- Generate a post-incident summary: timeline, root cause, actions taken, resolution time.

### Common Pitfalls

- **Context overload:** Dumping 500 log lines into the LLM prompt produces poor analysis. Pre-filter and summarize before passing to the LLM.
- **False confidence in root cause:** The LLM may confidently identify a wrong root cause. Always present it as "probable" and require human verification.
- **Action safety:** Never auto-execute without approval. Even in a simulated environment, practice the approval flow.
- **State management bugs:** Incidents span multiple async steps. Track state carefully — a lost approval or duplicate execution is a real-world risk.

### Evaluation Criteria

- [ ] Agent gathers context from 3+ simulated data sources
- [ ] Analysis identifies the correct root cause in test scenarios
- [ ] Remediation steps are specific and actionable
- [ ] High-risk actions require explicit approval
- [ ] Post-incident summary is accurate and well-structured
- [ ] Full incident timeline is logged

### Stretch Goals

- Integrate with real monitoring (Prometheus API, Loki API) instead of fixtures
- Add Slack/Teams notification at each stage
- Implement pattern matching: "this looks like incident #42 from last month"
- Build a dashboard showing active incidents and their status
- Add automated post-incident analysis: "How can we prevent this in the future?"

---

## Project 2: Cloud Operations Copilot

### Objective

Build an interactive copilot that helps engineers understand and manage their cloud infrastructure. The copilot answers questions about resources, explains configurations, identifies potential issues, and suggests optimizations — all through natural language backed by real API queries.

### What You'll Learn

- Building a domain-specific copilot with deep tool integration
- Translating natural language to API queries
- Multi-step investigation workflows
- Context management for infrastructure-scale data
- Actionable recommendations backed by evidence

### Architecture

```
┌────────────────┐
│ Engineer asks:  │
│ "Why is the DB  │
│  slow today?"   │
└───────┬────────┘
        │
        ▼
┌─────────────────────────────────────────────────────┐
│              CLOUD OPS COPILOT                       │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │            Planning Layer                     │   │
│  │  Break question into investigation steps     │   │
│  └──────────────────────┬───────────────────────┘   │
│                         │                            │
│  ┌──────────────────────▼───────────────────────┐   │
│  │            Tool Execution Layer                │   │
│  │                                               │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │   │
│  │  │ AWS/GCP  │ │ K8s API  │ │ Cost         │ │   │
│  │  │ Resource │ │ (kubectl)│ │ Explorer     │ │   │
│  │  │ Query    │ │          │ │              │ │   │
│  │  └──────────┘ └──────────┘ └──────────────┘ │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │   │
│  │  │ Metrics  │ │ Config   │ │ Security     │ │   │
│  │  │ Query    │ │ Analyzer │ │ Checker      │ │   │
│  │  └──────────┘ └──────────┘ └──────────────┘ │   │
│  └──────────────────────────────────────────────┘   │
│                         │                            │
│  ┌──────────────────────▼───────────────────────┐   │
│  │            Synthesis Layer                     │   │
│  │  Explain findings, suggest actions            │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Tech Stack

| Component | Choice | Why |
|-----------|--------|-----|
| Language | Python 3.11+ | |
| LLM | GPT-4o or Claude Sonnet | Complex reasoning about infrastructure |
| Cloud API | `boto3` (AWS) or simulated fixtures | Start with fixtures, add real APIs later |
| K8s | `kubernetes` Python client or fixtures | |
| Agent loop | Tool-calling loop (build from scratch) | Good practice before using frameworks |
| Web framework | FastAPI | |

### Step-by-Step Implementation

**Step 1: Create infrastructure fixtures**

Build realistic simulated cloud state:

- **EC2/Compute instances:** 20–30 instances with names, types, status, tags, CPU/memory utilization
- **RDS/Databases:** 3–5 databases with connection counts, query latency, storage usage, recent slow queries
- **Load balancers:** Target group health, request counts, error rates
- **Kubernetes:** Pods with status, resource requests/limits, restart counts, events
- **Cost data:** Daily cost breakdown by service and resource
- **Security:** Security group rules, IAM role attachments, public endpoints

**Step 2: Build query tools**

Each tool answers a specific type of question:

- `list_instances(filters)` → instances matching tags/status/type
- `get_instance_metrics(instance_id, metric, period)` → CPU, memory, network over time
- `get_database_status(db_id)` → connections, latency, storage, slow queries
- `get_k8s_pods(namespace, status_filter)` → pod list with status and events
- `get_cost_breakdown(service, days)` → cost data
- `check_security_groups(resource_id)` → inbound/outbound rules, public exposure
- `get_recent_changes(service, hours)` → configuration changes, deployments

**Step 3: Build the planning layer**

- Before executing tools, have the LLM decompose the question into investigation steps:
  ```
  User: "Why is the DB slow today?"
  Plan:
  1. Check database metrics (connection count, query latency)
  2. Check for slow queries
  3. Check CPU/memory utilization
  4. Check for recent configuration changes
  5. Check application-side connection pool settings
  ```
- Execute each step, feeding results back to the LLM.

**Step 4: Build the synthesis layer**

- After gathering data, have the LLM produce a structured response:
  - **Finding summary:** What's happening
  - **Root cause analysis:** Why it's happening
  - **Evidence:** Specific data points supporting the conclusion
  - **Recommendations:** Ordered by impact, with effort estimates
  - **Risk assessment:** What happens if you do nothing

**Step 5: Implement common copilot queries**

Build and test against these specific scenarios:

- "What's the most expensive service this month and can we optimize it?"
- "Are there any security issues with our public-facing resources?"
- "Show me pods in CrashLoopBackOff and explain why they're failing"
- "Compare database performance this week vs last week"
- "What resources are over-provisioned?"

**Step 6: Conversation memory**

- The copilot should maintain context across turns:
  - "What about the other database?" (refers to previously discussed context)
  - "Can you dig deeper into the slow queries?" (follow-up investigation)
- Implement session-based message history with the LLM.

### Common Pitfalls

- **Fixture realism matters:** Unrealistic fake data produces an unconvincing demo and poor LLM responses. Use realistic resource names, metric ranges, and failure patterns.
- **Tool output size:** Cloud APIs return verbose JSON. Summarize or filter before passing to the LLM. Don't dump raw `describe-instances` output into the context.
- **Vague recommendations:** "Check your database" is not useful. Train the prompt to produce specific, actionable recommendations with commands or console steps.
- **Missing units:** Always include units (GB, ms, %, $) in tool output. The LLM can't reason about "latency: 450" without knowing if it's ms or seconds.

### Evaluation Criteria

- [ ] Copilot answers 5+ common infrastructure questions accurately
- [ ] Investigation follows a logical multi-step plan
- [ ] Recommendations are specific and actionable
- [ ] Conversation context is maintained across turns
- [ ] Tool outputs are properly summarized (not raw dumps)

### Stretch Goals

- Connect to a real AWS account (read-only IAM role) for live queries
- Add cost optimization recommendations using AWS pricing data
- Implement "what-if" analysis: "What if we downsize these instances to t3.medium?"
- Add infrastructure comparison: "How does staging differ from production?"
- Build an alerting layer: the copilot proactively flags issues it discovers

---

## Project 3: Terraform Assistant with Plan Review

### Objective

Build an agent that reviews Terraform plans, explains proposed changes in plain language, identifies risks, suggests improvements, and can generate or modify Terraform configurations from natural language requests. This project directly applies AI to infrastructure-as-code workflows.

### What You'll Learn

- Code analysis and generation with LLMs
- Diff parsing and structured interpretation
- Risk assessment and policy enforcement
- RAG over documentation (Terraform provider docs)
- Integrating with CLI tools (terraform plan output)

### Architecture

```
┌────────────────────────────────────────────────────────────┐
│                  TERRAFORM ASSISTANT                        │
│                                                             │
│  MODE 1: Plan Review                                       │
│  ┌──────────────┐    ┌──────────────┐   ┌──────────────┐  │
│  │ terraform    │───→│ Parse Plan   │──→│ Risk         │  │
│  │ plan -json   │    │ (resources,  │   │ Assessment   │  │
│  │              │    │  actions,    │   │ + Explanation│  │
│  │              │    │  changes)    │   │              │  │
│  └──────────────┘    └──────────────┘   └──────────────┘  │
│                                                             │
│  MODE 2: Config Generation                                 │
│  ┌──────────────┐    ┌──────────────┐   ┌──────────────┐  │
│  │ Natural      │───→│ Generate     │──→│ Validate     │  │
│  │ Language     │    │ Terraform    │   │ (terraform   │  │
│  │ Request      │    │ HCL          │   │  validate)   │  │
│  └──────────────┘    └──────────────┘   └──────────────┘  │
│                                                             │
│  MODE 3: Documentation Q&A                                 │
│  ┌──────────────┐    ┌──────────────┐   ┌──────────────┐  │
│  │ Question     │───→│ RAG over     │──→│ Answer with  │  │
│  │ about TF     │    │ TF provider  │   │ Code Example│  │
│  │              │    │ docs         │   │              │  │
│  └──────────────┘    └──────────────┘   └──────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Component | Choice | Why |
|-----------|--------|-----|
| Language | Python 3.11+ | |
| LLM | GPT-4o or Claude Sonnet | Strong at code analysis and generation |
| Plan parsing | `json` (terraform plan outputs JSON) | |
| RAG | Qdrant + Phase 2 RAG pipeline | For Terraform docs search |
| Validation | subprocess call to `terraform validate` | Real validation |
| Web framework | FastAPI | |
| HCL parsing | `python-hcl2` (optional) | Parse existing .tf files |

### Step-by-Step Implementation

**Step 1: Parse Terraform plan JSON**

- Terraform plan produces structured JSON: `terraform plan -out=plan.bin && terraform show -json plan.bin`
- Parse the JSON to extract:
  - Resources being created, updated, destroyed
  - Attribute changes (before/after values)
  - Dependencies between resources
- Build a `PlanSummary` data structure that organizes changes by action type and resource type.

**Step 2: Risk assessment engine**

Define a risk scoring system:

- **Critical risk:** Destroying databases, removing security groups, deleting storage
- **High risk:** Changing instance types (causes restart), modifying IAM policies, altering network ACLs
- **Medium risk:** Adding/changing tags, updating launch templates, modifying auto-scaling
- **Low risk:** Adding new resources, adding outputs, documentation changes

Implement as a rule engine first (pattern matching on resource types and actions), then enhance with LLM analysis for nuanced cases.

**Step 3: Plain-language explanation**

- Feed the plan summary and risk assessment to the LLM.
- System prompt instructs it to explain like a senior engineer reviewing a PR:
  ```
  You are a senior infrastructure engineer reviewing a Terraform plan.
  Explain each change in plain language. Highlight risks and suggest
  improvements. Be specific about what will happen when this plan is applied.

  For each risky change, explain:
  - What exactly will happen
  - What could go wrong
  - What the blast radius is
  - How to mitigate the risk
  ```
- Output structured review with per-resource comments.

**Step 4: Terraform config generation**

- Accept natural language requests: "Create an S3 bucket with versioning enabled, server-side encryption, and block all public access"
- Generate valid HCL using the LLM.
- Validate the output by writing it to a temp file and running `terraform validate` (requires Terraform installed, or skip validation and review manually).
- If validation fails, feed the error back to the LLM and ask it to fix the config.

**Step 5: Documentation RAG**

- Ingest Terraform provider documentation (AWS provider docs are freely available as Markdown/HTML).
- Build a RAG pipeline over the docs (reuse Phase 2).
- Enable questions like: "What arguments does aws_rds_cluster support?" or "How do I set up cross-region replication for S3?"

**Step 6: Best-practice policy checks**

Implement automated checks that run alongside the LLM review:

- All S3 buckets must have encryption enabled
- No security groups should allow 0.0.0.0/0 on port 22
- All resources must have a `Name` and `Environment` tag
- RDS instances must have automated backups enabled
- No resources should use hardcoded credentials

Report violations alongside the LLM review.

### Common Pitfalls

- **Plan JSON is complex:** The Terraform plan JSON schema is deeply nested. Start by handling the common cases (create, update, delete) and ignore edge cases like moved/imported resources initially.
- **HCL generation correctness:** LLMs produce syntactically valid-looking HCL that fails validation. Always validate generated config — never trust it blindly.
- **Provider version drift:** Terraform provider APIs change. Documentation RAG should note which provider version the docs cover.
- **Scope creep:** Don't try to support every Terraform resource type. Start with the AWS resources you know (EC2, S3, RDS, IAM, VPC) and expand.

### Evaluation Criteria

- [ ] Plan review correctly identifies create/update/destroy actions
- [ ] Risk assessment flags destructive operations
- [ ] Plain-language explanation is accurate and helpful
- [ ] Config generation produces valid HCL for common resources
- [ ] Documentation Q&A returns relevant answers with examples
- [ ] Policy checks catch common violations

### Stretch Goals

- Add a PR review bot: integrate with GitHub Actions to review Terraform plans in PRs
- Support multiple providers (AWS, GCP, Azure)
- Generate Terraform import commands for existing resources
- Compare two plans (before/after a change)
- Build a state explorer: "What resources are currently managed in this workspace?"

---

## Project 4: Runbook Execution Agent

### Objective

Build an agent that can read operational runbooks (written in Markdown) and execute them step by step, with human approval at critical junctures. The agent interprets each step, determines which tools to use, executes them, evaluates the result, and decides how to proceed — including handling branching logic like "if X, do Y; otherwise do Z."

### What You'll Learn

- Document-driven agentic execution (converting prose into actions)
- Branching workflow logic with LLMs
- Checkpoint and rollback patterns
- Human-in-the-loop at critical decision points
- State persistence for long-running workflows

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                   RUNBOOK EXECUTION AGENT                     │
│                                                               │
│  ┌──────────┐    ┌──────────────────────────────────┐        │
│  │ Runbook   │───→│ Step Parser                      │        │
│  │ (Markdown)│    │ - Extract ordered steps          │        │
│  │           │    │ - Identify conditional branches  │        │
│  │           │    │ - Map steps to tool calls        │        │
│  └──────────┘    └──────────────┬───────────────────┘        │
│                                 │                             │
│                                 ▼                             │
│  ┌──────────────────────────────────────────────────┐        │
│  │                EXECUTION LOOP                     │        │
│  │                                                   │        │
│  │   ┌──────────┐  ┌──────────┐  ┌──────────────┐  │        │
│  │   │ Execute  │─→│ Evaluate │─→│ Decide Next  │  │        │
│  │   │ Step     │  │ Result   │  │ Step         │  │        │
│  │   └──────────┘  └──────────┘  └──────┬───────┘  │        │
│  │        ▲                             │           │        │
│  │        └─────────────────────────────┘           │        │
│  │                                                   │        │
│  │   Checkpoints:  [step 1: ✓] [step 2: ✓] [step 3]│        │
│  └──────────────────────────────────────────────────┘        │
│                         │                                     │
│           ┌─────────────┤                                     │
│           ▼             ▼                                     │
│  ┌──────────────┐ ┌──────────────┐                           │
│  │ Auto-execute │ │ Human Gate   │                           │
│  │ (safe steps) │ │ (destructive │                           │
│  │              │ │  steps)      │                           │
│  └──────────────┘ └──────────────┘                           │
└──────────────────────────────────────────────────────────────┘

Tools available:
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Shell        │ HTTP/API     │ Database     │ Kubernetes   │
│ Commands     │ Requests     │ Queries      │ Operations   │
│ (simulated)  │ (simulated)  │ (simulated)  │ (simulated)  │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

### Tech Stack

| Component | Choice | Why |
|-----------|--------|-----|
| Language | Python 3.11+ | |
| LLM | GPT-4o or Claude Sonnet | Needs strong instruction following |
| Runbook format | Markdown | Standard operational documentation format |
| State persistence | SQLite | Track execution state, checkpoints |
| Agent framework | LangGraph (recommended) or custom state machine | LangGraph handles branching well |
| Web framework | FastAPI | |

### Step-by-Step Implementation

**Step 1: Create sample runbooks**

Write 3–5 realistic operational runbooks in Markdown:

```markdown
# Runbook: Database Connection Pool Exhaustion

## Symptoms
- Application returns "connection pool exhausted" errors
- Database connection count is at or near maximum

## Steps

### Step 1: Verify the issue
Run `SELECT count(*) FROM pg_stat_activity;` and check if connections
are near the `max_connections` setting.

If connections are below 80% of max, this is NOT connection pool exhaustion.
Check application logs instead.

### Step 2: Identify top consumers
Run `SELECT usename, application_name, count(*)
FROM pg_stat_activity GROUP BY 1,2 ORDER BY 3 DESC LIMIT 10;`

### Step 3: Check for idle connections
Run `SELECT count(*) FROM pg_stat_activity WHERE state = 'idle';`

If idle connections are > 50% of total:
- Check application connection pool settings (min/max pool size)
- Consider reducing idle timeout

### Step 4: Kill idle connections (REQUIRES APPROVAL)
⚠️ This step requires human approval.

Run: `SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle' AND state_change < now() - interval '30 minutes';`

### Step 5: Verify resolution
Re-run the connection count query from Step 1.
Connection count should have decreased by at least 20%.
```

**Step 2: Build the runbook parser**

- Parse Markdown into a structured representation:
  ```python
  class RunbookStep(BaseModel):
      number: int
      title: str
      instructions: str
      requires_approval: bool  # detected from "REQUIRES APPROVAL" markers
      condition: str | None    # "if connections below 80%..."
      actions: list[str]       # extracted commands/queries
  ```
- Use the LLM to assist in parsing complex steps with conditional logic.
- Identify which tools each step requires (database query, shell command, API call, etc.).

**Step 3: Build the execution engine**

- Process steps sequentially.
- For each step:
  1. Present the step to the LLM with current state context.
  2. LLM determines which tool(s) to call and with what arguments.
  3. Execute the tool (simulated — don't run real SQL).
  4. LLM evaluates the result against the step's success criteria.
  5. LLM decides: proceed to next step, branch (conditional), or escalate.

**Step 4: Implement checkpointing**

- After each successful step, save the execution state to SQLite:
  - Runbook ID, step number, status, tool outputs, timestamp
- If the agent is interrupted, it can resume from the last checkpoint.
- Support manual rollback: re-execute from a specific step.

**Step 5: Human approval gates**

- Steps marked with approval requirements pause execution.
- Present: what will be done, why, what the expected impact is, and what data was gathered so far.
- Wait for approval via the API (`POST /execution/{id}/approve`).
- Log who approved and when.

**Step 6: Execution report**

- After completion (or failure), generate a report:
  - Each step: what was done, what was observed, duration
  - Decision points: why the agent chose a specific branch
  - Final status: resolved, partially resolved, escalated
  - Recommendations for runbook improvement (if steps were unclear)

### Common Pitfalls

- **Runbook ambiguity:** Real runbooks are often poorly written. The LLM will struggle with vague instructions like "check if things look normal." Build robust error handling for when the LLM can't determine the next action.
- **Simulated tool fidelity:** If your simulated database returns unrealistic data, the agent's decisions won't make sense. Use realistic fixture data that matches the runbook scenarios.
- **Conditional logic failures:** "If X, do Y; otherwise Z" is hard for LLMs to track reliably. Implement conditionals as explicit branching in your state machine, not just in the prompt.
- **Runaway execution:** Without step limits and approval gates, a confused agent could loop forever. Implement max retries per step and a global execution timeout.

### Evaluation Criteria

- [ ] Agent successfully executes a simple linear runbook (no branches)
- [ ] Agent handles conditional branches correctly
- [ ] Approval gates pause execution and require explicit approval
- [ ] Checkpointing works (stop and resume mid-runbook)
- [ ] Execution report accurately reflects what happened
- [ ] Agent escalates appropriately when a step fails or is ambiguous

### Stretch Goals

- Build a runbook authoring assistant: "Write a runbook for handling SSL certificate expiry"
- Implement parallel step execution (some runbook steps are independent)
- Add a "dry run" mode that explains what it would do without executing
- Integrate with a real ticketing system: auto-create tickets for escalations
- Build a runbook improvement suggester: after execution, suggest ways to make the runbook clearer

---

## Project 5: Multi-Agent System for Deployment Review

### Objective

Build a multi-agent system where specialized agents collaborate to review a deployment. One agent analyzes code changes, another reviews infrastructure impact, another checks security implications, and a coordinator agent synthesizes their findings into a go/no-go recommendation. This introduces multi-agent patterns — the frontier of agentic AI.

### What You'll Learn

- Multi-agent architecture and coordination patterns
- Agent specialization and role design
- Inter-agent communication
- Consensus and conflict resolution between agents
- Synthesizing multiple perspectives into a coherent recommendation

### Architecture

```
┌──────────────────┐
│ Deployment       │
│ Request          │
│ (PR + Plan)      │
└────────┬─────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                  COORDINATOR AGENT                           │
│  Receives request, delegates to specialists, synthesizes    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              SPECIALIST AGENTS                       │    │
│  │                                                      │    │
│  │  ┌──────────────┐  ┌──────────────┐                 │    │
│  │  │ Code Review  │  │ Infra Review │                 │    │
│  │  │ Agent        │  │ Agent        │                 │    │
│  │  │              │  │              │                 │    │
│  │  │ - Diff anal. │  │ - TF plan    │                 │    │
│  │  │ - Test cov.  │  │ - Resource   │                 │    │
│  │  │ - Complexity │  │   changes    │                 │    │
│  │  │ - Patterns   │  │ - Cost est.  │                 │    │
│  │  └──────────────┘  └──────────────┘                 │    │
│  │                                                      │    │
│  │  ┌──────────────┐  ┌──────────────┐                 │    │
│  │  │ Security     │  │ Performance  │                 │    │
│  │  │ Review Agent │  │ Review Agent │                 │    │
│  │  │              │  │              │                 │    │
│  │  │ - Vuln scan  │  │ - Load est.  │                 │    │
│  │  │ - IAM check  │  │ - DB impact  │                 │    │
│  │  │ - Secrets    │  │ - Caching    │                 │    │
│  │  │ - OWASP      │  │ - Scaling    │                 │    │
│  │  └──────────────┘  └──────────────┘                 │    │
│  └─────────────────────────────────────────────────────┘    │
│                         │                                    │
│  ┌──────────────────────▼───────────────────────────┐       │
│  │          SYNTHESIS & DECISION                     │       │
│  │                                                   │       │
│  │  - Merge findings from all agents                │       │
│  │  - Identify conflicts between reviews            │       │
│  │  - Produce: GO / NO-GO / CONDITIONAL             │       │
│  │  - Attach conditions (if CONDITIONAL)            │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────┐
│ Review Report    │
│ - Summary        │
│ - Per-agent      │
│   findings       │
│ - Risk score     │
│ - Recommendation │
│ - Conditions     │
└──────────────────┘
```

### Tech Stack

| Component | Choice | Why |
|-----------|--------|-----|
| Language | Python 3.11+ | |
| LLM | GPT-4o or Claude Sonnet | Each agent gets its own LLM session |
| Multi-agent | LangGraph (recommended) or custom orchestration | LangGraph has built-in multi-agent support |
| Code analysis | Git diff parsing, `ast` module for Python | |
| Infra analysis | Terraform plan JSON parsing (reuse Project 3) | |
| Web framework | FastAPI | |
| Report format | Structured JSON + Markdown summary | |

### Step-by-Step Implementation

**Step 1: Define agent roles and interfaces**

Each specialist agent has:
- A focused system prompt defining its expertise and review criteria
- A set of tools specific to its domain
- A structured output schema for its findings

```python
class AgentFinding(BaseModel):
    agent_name: str
    category: str  # "code", "infrastructure", "security", "performance"
    severity: Literal["critical", "high", "medium", "low", "info"]
    finding: str
    evidence: str
    recommendation: str
    blocks_deployment: bool
```

**Step 2: Build the Code Review Agent**

Tools:
- `get_diff(pr_number)` → returns the code diff
- `get_file_content(path, ref)` → returns file content at a specific ref
- `check_test_coverage(changed_files)` → returns coverage data for changed files

Review criteria:
- Are there obvious bugs or logic errors?
- Are changed functions covered by tests?
- Is the code complexity reasonable?
- Are there any anti-patterns (hardcoded secrets, SQL injection, etc.)?
- Does the change size suggest it should be split?

**Step 3: Build the Infrastructure Review Agent**

Tools:
- `get_terraform_plan(pr_number)` → returns parsed plan (reuse Project 3)
- `estimate_cost_impact(plan)` → estimates monthly cost change
- `check_resource_limits(plan)` → checks against account quotas

Review criteria:
- What infrastructure is being changed?
- What's the blast radius (single service, single region, global)?
- Is the cost impact acceptable?
- Are there resource limit concerns?
- Is there a rollback plan?

**Step 4: Build the Security Review Agent**

Tools:
- `scan_code_for_secrets(diff)` → pattern matching for API keys, passwords
- `check_iam_changes(plan)` → analyzes IAM policy modifications
- `check_network_exposure(plan)` → identifies public-facing resource changes
- `check_dependency_vulnerabilities(changed_deps)` → simulated vuln check

Review criteria:
- Are any secrets being committed?
- Do IAM changes follow least-privilege?
- Are new network paths opened (especially to the internet)?
- Are dependencies up to date and free of known vulnerabilities?

**Step 5: Build the Performance Review Agent**

Tools:
- `analyze_query_changes(diff)` → finds new/modified database queries
- `check_caching_impact(diff)` → identifies cache-related changes
- `estimate_load_impact(changes)` → rough estimate of performance impact

Review criteria:
- Are new database queries indexed?
- Are there N+1 query patterns?
- Is caching properly invalidated?
- Could this change cause a performance regression under load?

**Step 6: Build the Coordinator Agent**

The coordinator:

1. Receives the deployment request (PR number + TF plan).
2. Dispatches to all 4 specialist agents in parallel.
3. Collects their findings.
4. Identifies conflicts (e.g., code agent says "looks fine" but security agent says "blocks deployment").
5. Produces a final decision:
   - **GO:** No blocking issues found. Proceed with deployment.
   - **NO-GO:** Critical/high-severity blocking issues found. Fix required.
   - **CONDITIONAL:** Proceed with specific conditions (e.g., "merge after adding tests for the new endpoint").
6. Generates a structured report with all findings, the decision, and conditions.

**Step 7: Report generation**

Produce both:
- Structured JSON (for programmatic consumption, PR comments)
- Markdown summary (for human reading)

Include:
- Overall risk score (aggregate of all agent findings)
- Per-agent summary
- Detailed findings sorted by severity
- Clear GO/NO-GO/CONDITIONAL decision with reasoning

### Common Pitfalls

- **Agent verbosity:** Without strict output schemas, agents produce long, unfocused reviews. Enforce structured output and length limits.
- **Redundant findings:** Multiple agents may flag the same issue from different angles. The coordinator should deduplicate.
- **False positives:** Security and performance agents tend to over-flag. Calibrate severity thresholds to reduce noise.
- **Coordinator bias:** The coordinator LLM may over-weight the last agent's findings. Present all findings in a structured, equal format.
- **Cost:** Running 5 LLM sessions per review gets expensive. Use cheaper models (GPT-4o-mini) for specialist agents and stronger models (GPT-4o) for the coordinator.

### Evaluation Criteria

- [ ] All 4 specialist agents produce structured findings
- [ ] Agents run in parallel (not sequentially)
- [ ] Coordinator correctly synthesizes a GO/NO-GO/CONDITIONAL decision
- [ ] Critical findings from any agent result in NO-GO
- [ ] Report is clear, structured, and actionable
- [ ] Conflicting agent opinions are surfaced and resolved

### Stretch Goals

- Add a feedback loop: engineers rate the review quality, used to improve agent prompts
- Integrate with GitHub: post the review as a PR comment
- Add historical context: "the last 3 deployments to this service caused incidents"
- Implement agent debate: if agents disagree, have them discuss and reach consensus
- Build a deployment dashboard showing review history and decision trends
- Add a "fast-track" mode for low-risk changes (small diffs, no infra changes)
