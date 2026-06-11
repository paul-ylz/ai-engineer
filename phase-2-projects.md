# Phase 2 Projects: RAG and Core Applications

These five projects are independent. Each is self-contained with its own objectives, architecture, tech stack, and implementation guide. They are ordered by complexity, but you can build them in any order.

---

## Project 1: Chatbot with Conversation Memory and Streaming

### Objective

Build a web-accessible chatbot that maintains multi-turn conversation context and streams responses token-by-token. This is the "hello world" of LLM application development — deceptively simple, but the patterns you learn here (streaming, session management, context window handling) appear in every production system.

### What You'll Learn

- Chat completions API (message roles, parameters)
- Streaming with Server-Sent Events (SSE)
- Conversation history management and context window limits
- Session management for multi-user scenarios
- Basic prompt engineering (system prompts)

### Architecture

```
┌──────────┐     HTTP/SSE      ┌──────────────┐      API Call       ┌──────────┐
│  Client   │ ───────────────→ │  FastAPI      │ ──────────────────→ │ OpenAI / │
│ (browser/ │ ←─────────────── │  Server       │ ←────────────────── │ Anthropic│
│  curl)    │   streamed       │               │   streamed          │ API      │
└──────────┘   tokens          │  - sessions   │   tokens            └──────────┘
                               │  - history    │
                               │  - truncation │
                               └───────┬───────┘
                                       │ (optional)
                                       ▼
                                 ┌───────────┐
                                 │   Redis    │
                                 │ (session   │
                                 │  persist)  │
                                 └───────────┘
```

### Tech Stack

| Component | Choice | Why |
|-----------|--------|-----|
| Language | Python 3.11+ | Industry standard for AI/ML |
| Web framework | FastAPI | Async-native, SSE support |
| LLM SDK | `openai` >= 1.0 | Direct SDK, no abstraction layers |
| Streaming | `sse-starlette` | SSE support for FastAPI |
| Session store | In-memory dict → Redis | Start simple, upgrade later |
| Token counting | `tiktoken` | Accurate token counting for truncation |

### Step-by-Step Implementation

**Step 1: Project setup**

```
chatbot/
├── main.py              # FastAPI app, routes
├── chat.py              # Chat logic, history management
├── config.py            # Settings (model, max tokens, etc.)
├── requirements.txt
└── .env                 # API keys
```

Install dependencies:
```bash
pip install fastapi uvicorn openai sse-starlette tiktoken python-dotenv
```

**Step 2: Basic chat endpoint (no memory)**

- Create a POST endpoint `/chat` that accepts `{"message": "..."}` and returns a completion.
- Use `openai.OpenAI()` client with `client.chat.completions.create()`.
- Set a system prompt that defines the assistant's behavior.
- Return the response as JSON.
- Verify it works with `curl`.

**Step 3: Add conversation history**

- Create a `ConversationManager` class that stores message history per session.
- Use a `session_id` (UUID) to identify conversations.
- On each request, append the user message to history, send full history to the API, append the assistant response.
- Return the `session_id` so the client can continue the conversation.

**Step 4: Implement streaming**

- Change the endpoint to use `stream=True` in the API call.
- Use `sse-starlette`'s `EventSourceResponse` to stream chunks back.
- Each SSE event contains one token/chunk from the model.
- Send a final `[DONE]` event when the stream completes.
- Handle `KeyboardInterrupt` and client disconnection gracefully.

**Step 5: Context window management**

- Use `tiktoken` to count tokens in the conversation history.
- Implement a truncation strategy: when history exceeds 80% of the model's context window, drop the oldest messages (keeping the system prompt).
- Alternative strategy: summarize old messages using a cheap/fast model call before dropping them.

**Step 6: Error handling and resilience**

- Handle API rate limits (429) with exponential backoff.
- Handle context length exceeded errors by truncating and retrying.
- Add request timeouts.
- Return structured error responses to the client.

### Common Pitfalls

- **Context window overflow:** Not tracking token count leads to API errors when history grows. Always count tokens and truncate proactively.
- **Streaming error handling:** If the API errors mid-stream, the client receives a partial response. Send an error event through the SSE channel.
- **Session memory leaks:** In-memory sessions grow forever. Add TTL-based expiration or switch to Redis with `EXPIRE`.
- **System prompt not preserved:** When truncating history, always keep the system prompt as the first message.

### Evaluation Criteria

- [ ] Multi-turn conversation works (assistant remembers earlier messages)
- [ ] Streaming delivers tokens incrementally (not buffered)
- [ ] Long conversations don't crash (truncation works)
- [ ] Multiple concurrent sessions are isolated
- [ ] API errors are handled gracefully

### Stretch Goals

- Add a simple web UI using HTMX or a basic React frontend
- Implement sliding-window summarization: summarize messages beyond a threshold instead of dropping them
- Add configurable system prompts via API
- Support model switching (GPT-4o, Claude, etc.) per session
- Add Redis persistence so conversations survive server restarts

---

## Project 2: Internal Knowledge-Base Assistant (Basic RAG)

### Objective

Build a Q&A system that answers questions from a corpus of internal documents (Markdown, PDF, plain text). This is the foundational RAG pattern — the single most in-demand AI application pattern in enterprise today.

### What You'll Learn

- Document loading and text extraction
- Chunking strategies and why they matter
- Embedding generation and vector storage
- Vector similarity search
- Prompt augmentation with retrieved context
- Basic citation/source attribution

### Architecture

```
                    INGESTION PIPELINE
┌──────────┐    ┌───────────┐    ┌───────────┐    ┌──────────┐
│  Documents│───→│  Chunker  │───→│ Embedding │───→│ Vector   │
│  (PDF,MD, │    │ (recursive│    │ Model     │    │ Database │
│   txt)    │    │  splits)  │    │ (OpenAI)  │    │ (Qdrant) │
└──────────┘    └───────────┘    └───────────┘    └──────────┘

                    QUERY PIPELINE
┌──────────┐    ┌───────────┐    ┌───────────┐    ┌──────────┐
│  User     │───→│ Embed     │───→│ Retrieve  │───→│ Augment  │
│  Question │    │ Query     │    │ Top-K     │    │ Prompt   │
└──────────┘    └───────────┘    │ Chunks    │    │ + LLM    │
                                 └───────────┘    └────┬─────┘
                                                       │
                                                       ▼
                                                 ┌──────────┐
                                                 │ Answer +  │
                                                 │ Sources   │
                                                 └──────────┘
```

### Tech Stack

| Component | Choice | Why |
|-----------|--------|-----|
| Language | Python 3.11+ | |
| Web framework | FastAPI | |
| Embeddings | `openai` (text-embedding-3-small) | Good quality/cost ratio |
| Vector DB | Qdrant (Docker) or pgvector | Qdrant is purpose-built; pgvector if you prefer Postgres |
| PDF parsing | `pdfplumber` | Better table/layout handling than PyPDF2 |
| Token counting | `tiktoken` | Accurate chunk sizing |
| CLI | `typer` or `argparse` | For ingestion commands |

### Step-by-Step Implementation

**Step 1: Project setup**

```
rag-assistant/
├── ingest.py            # Document ingestion CLI
├── chunker.py           # Chunking logic
├── embeddings.py        # Embedding generation
├── vectorstore.py       # Vector DB operations
├── query.py             # Query pipeline
├── main.py              # FastAPI app
├── config.py
├── requirements.txt
├── docs/                # Sample documents to ingest
└── .env
```

```bash
pip install fastapi uvicorn openai qdrant-client pdfplumber tiktoken python-dotenv typer
```

Run Qdrant locally:
```bash
docker run -p 6333:6333 qdrant/qdrant
```

**Step 2: Document loading**

- Write loaders for each file type: Markdown (read as text), PDF (pdfplumber), plain text.
- Each loader returns a list of `Document` objects: `{"text": "...", "metadata": {"source": "file.pdf", "page": 3}}`.
- Metadata is critical — it's how you provide citations later.

**Step 3: Chunking**

- Implement recursive character splitting:
  - Try to split on `\n\n` (paragraphs) first
  - Fall back to `\n` (lines), then `. ` (sentences), then character-level
  - Target chunk size: 500–1000 tokens
  - Overlap: 50–100 tokens between chunks
- Use `tiktoken` to measure chunk size in tokens, not characters.
- Preserve metadata through chunking (source file, page number, chunk index).

**Step 4: Embedding and storage**

- Generate embeddings using `openai.embeddings.create(model="text-embedding-3-small", input=chunks)`.
- Batch embedding calls (max ~2000 chunks per call, watch token limits).
- Store in Qdrant with the embedding vector, chunk text as payload, and metadata.
- Create a collection with appropriate vector size (1536 for text-embedding-3-small).

**Step 5: Query pipeline**

- Accept a user question.
- Embed the question using the same embedding model.
- Search Qdrant for the top-K most similar chunks (start with K=5).
- Construct an augmented prompt:
  ```
  Answer the question based on the provided context. If the context doesn't
  contain enough information, say so. Cite the source documents.

  Context:
  [chunk 1 - source: file.pdf, page 3]
  [chunk 2 - source: guide.md]
  ...

  Question: {user_question}
  ```
- Send to the LLM and return the answer with sources.

**Step 6: FastAPI endpoint**

- POST `/query` accepts `{"question": "..."}` and returns `{"answer": "...", "sources": [...]}`.
- POST `/ingest` accepts a file upload and runs the ingestion pipeline.
- GET `/documents` lists ingested documents.

### Common Pitfalls

- **Chunks too large:** The LLM's answer becomes unfocused. Aim for 500–800 tokens per chunk.
- **Chunks too small:** Context is fragmented and the LLM can't synthesize. Ensure chunks contain complete thoughts.
- **No overlap:** Important information at chunk boundaries is lost. Use 10–20% overlap.
- **Ignoring metadata:** Without source tracking, you can't provide citations — a hard requirement in enterprise.
- **Not evaluating retrieval:** You must check whether the *right* chunks are retrieved, not just whether the final answer sounds good. Wrong chunks + good LLM = confident hallucination.

### Evaluation Criteria

- [ ] Documents are ingested and searchable
- [ ] Questions about ingested content return accurate answers
- [ ] Answers include source citations (file name, page/section)
- [ ] Questions outside the knowledge base are handled gracefully ("I don't have information about...")
- [ ] Ingesting new documents doesn't require restarting the service

### Stretch Goals

- Add metadata filtering (e.g., "only search documents from Q4 2024")
- Try different embedding models and compare retrieval quality
- Implement a simple evaluation: create 20 question/answer pairs, measure how often the system gets the right answer
- Add a web UI with source highlighting
- Support incremental ingestion (don't re-embed unchanged documents)

---

## Project 3: Multi-Document Q&A with Hybrid Retrieval and Citations

### Objective

Build a production-grade Q&A system that handles multiple document types, uses hybrid retrieval (vector + keyword search), re-ranks results, and produces properly formatted citations. This project bridges the gap between a demo RAG system and something you could deploy at work.

### What You'll Learn

- Multi-format document ingestion (PDF, HTML, Markdown, CSV)
- Hybrid retrieval: combining vector search with BM25 keyword search
- Reciprocal Rank Fusion (RRF) for merging result lists
- Re-ranking for precision improvement
- Structured citation output
- Retrieval evaluation metrics

### Architecture

```
                        INGESTION
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│  PDF   │ │  HTML  │ │  MD    │ │  CSV   │
└───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘
    └──────────┴──────────┴──────────┘
                    │
                    ▼
            ┌───────────────┐
            │ Unified       │
            │ Chunker       │
            └───────┬───────┘
                    │
            ┌───────┴───────┐
            ▼               ▼
    ┌───────────────┐ ┌───────────────┐
    │ Vector Store  │ │ BM25 Index    │
    │ (Qdrant)      │ │ (in-memory)   │
    └───────────────┘ └───────────────┘

                    QUERY
                    │
        ┌───────────┼───────────┐
        ▼           │           ▼
 ┌─────────────┐   │   ┌─────────────┐
 │ Vector      │   │   │ BM25        │
 │ Search      │   │   │ Search      │
 └──────┬──────┘   │   └──────┬──────┘
        └──────────┼──────────┘
                   ▼
           ┌───────────────┐
           │ Reciprocal    │
           │ Rank Fusion   │
           └───────┬───────┘
                   ▼
           ┌───────────────┐
           │ Re-ranker     │
           │ (Cohere /     │
           │  cross-enc.)  │
           └───────┬───────┘
                   ▼
           ┌───────────────┐
           │ LLM Synthesis │
           │ + Citations   │
           └───────────────┘
```

### Tech Stack

| Component | Choice | Why |
|-----------|--------|-----|
| Language | Python 3.11+ | |
| Web framework | FastAPI | |
| Vector DB | Qdrant | |
| BM25 | `rank-bm25` | Lightweight, no infrastructure needed |
| Re-ranking | Cohere Rerank API or `sentence-transformers` cross-encoder | Cohere is easiest; cross-encoder is free |
| HTML parsing | `beautifulsoup4` | |
| CSV handling | `pandas` | |
| PDF parsing | `pdfplumber` | |

### Step-by-Step Implementation

**Step 1: Multi-format ingestion**

- Build a loader registry: map file extensions to loader functions.
- PDF loader: extract text per page, preserve page numbers in metadata.
- HTML loader: strip tags with BeautifulSoup, preserve headings as section metadata.
- Markdown loader: parse headings as sections, preserve heading hierarchy in metadata.
- CSV loader: convert each row (or group of rows) to a natural-language text representation.
- Each loader produces `Document(text, metadata)` with consistent metadata schema: `source`, `section`, `page` (where applicable), `doc_type`.

**Step 2: Unified chunking with metadata enrichment**

- Use the same recursive chunking from Project 2.
- Enrich each chunk's metadata with: document title, section heading, chunk position (start/end of document), neighboring chunk IDs (for context expansion later).
- Store a unique `chunk_id` for each chunk.

**Step 3: Dual indexing**

- Vector index: embed and store in Qdrant (same as Project 2).
- BM25 index: tokenize all chunks and build an in-memory BM25 index using `rank-bm25`.
- Both indexes reference the same `chunk_id`.

**Step 4: Hybrid retrieval with RRF**

- On query: run vector search (top 20) and BM25 search (top 20) in parallel.
- Merge results using Reciprocal Rank Fusion:
  ```
  RRF_score(doc) = sum(1 / (k + rank_i)) for each result list i where doc appears
  ```
  Use k=60 (standard constant).
- Return the top 10 merged results.

**Step 5: Re-ranking**

- Take the top 10 hybrid results and re-rank them using either:
  - **Cohere Rerank API**: send query + chunk texts, get re-ranked scores.
  - **Cross-encoder**: use `sentence-transformers` with `cross-encoder/ms-marco-MiniLM-L-6-v2`.
- Keep the top 5 after re-ranking.

**Step 6: LLM synthesis with structured citations**

- Construct a prompt that asks the LLM to answer using the provided chunks and cite each claim.
- Use structured output (JSON mode or function calling) to enforce citation format:
  ```json
  {
    "answer": "The deployment process involves...",
    "citations": [
      {"claim": "deployments use blue-green strategy", "source": "ops-guide.pdf", "page": 12},
      {"claim": "rollback takes under 5 minutes", "source": "sla.md", "section": "Availability"}
    ]
  }
  ```

**Step 7: Evaluation**

- Build a golden evaluation dataset: 30+ questions with known answers and the chunks that should be retrieved.
- Measure:
  - **Retrieval recall@5**: Is the correct chunk in the top 5?
  - **Answer faithfulness**: Does the answer match the ground truth?
  - **Citation accuracy**: Do citations point to real sources with correct content?
- Compare vector-only vs hybrid vs hybrid+rerank to see the improvement.

### Common Pitfalls

- **BM25 tokenization mismatch:** Use the same tokenization for indexing and querying. Lowercasing, stemming, and stop-word removal should be consistent.
- **Over-relying on vector search:** Vector search excels at semantic similarity but misses exact keyword matches (e.g., product names, error codes). That's why hybrid search matters.
- **Re-ranking is slow if over-applied:** Only re-rank the top candidates from hybrid retrieval, not the entire corpus.
- **Citation hallucination:** The LLM may generate citations that don't correspond to any retrieved chunk. Validate citations against actual source metadata before returning.

### Evaluation Criteria

- [ ] At least 3 document types are ingested correctly
- [ ] Hybrid retrieval outperforms vector-only on keyword-heavy queries
- [ ] Re-ranking improves precision on ambiguous queries
- [ ] Citations are accurate and traceable to source documents
- [ ] Evaluation metrics are measured and reported

### Stretch Goals

- Add a feedback loop: let users rate answers and log which chunks were useful
- Implement context window expansion: when a chunk is retrieved, optionally include its neighboring chunks
- Add query decomposition: break complex questions into sub-questions, retrieve for each, synthesize
- Build an evaluation dashboard that tracks metrics over time
- Support document versioning (re-ingest updated documents, mark old chunks as stale)

---

## Project 4: AI-Powered Ticket Triage System

### Objective

Build a system that automatically classifies, prioritizes, and routes incoming support tickets using LLMs with structured outputs. This project introduces structured output from LLMs, classification patterns, and integration with external systems — critical skills for enterprise AI.

### What You'll Learn

- Structured LLM outputs (JSON mode, function calling / tool use)
- Classification and routing with LLMs
- Confidence scores and fallback to human review
- Batch processing patterns
- Integration with external systems (simulated ticket queue)

### Architecture

```
┌──────────────┐     ┌──────────────────────────────────────────────┐
│ Ticket       │     │              Triage Pipeline                 │
│ Source       │────→│                                              │
│ (API/queue)  │     │  ┌────────────┐  ┌────────────┐  ┌────────┐│
└──────────────┘     │  │ Classify   │─→│ Prioritize │─→│ Route  ││
                     │  │ (category, │  │ (P1-P4,    │  │ (team, ││
                     │  │  sub-cat)  │  │  urgency)  │  │  SLA)  ││
                     │  └────────────┘  └────────────┘  └───┬────┘│
                     │                                      │      │
                     │  ┌─────────────────────────────────┐ │      │
                     │  │ Confidence < threshold?         │←┘      │
                     │  │ YES → flag for human review     │        │
                     │  │ NO  → auto-route                │        │
                     │  └─────────────────────────────────┘        │
                     └──────────────────────────────────────────────┘
                                        │
                     ┌──────────────────┬┴──────────────────┐
                     ▼                  ▼                    ▼
              ┌────────────┐   ┌──────────────┐    ┌──────────────┐
              │ Auto-routed│   │ Human Review  │    │ Dashboard    │
              │ Tickets    │   │ Queue         │    │ (metrics)    │
              └────────────┘   └──────────────┘    └──────────────┘
```

### Tech Stack

| Component | Choice | Why |
|-----------|--------|-----|
| Language | Python 3.11+ | |
| Web framework | FastAPI | |
| LLM | OpenAI GPT-4o-mini (cheap, fast, good at structured output) | |
| Structured output | OpenAI function calling or `response_format: json_schema` | Reliable structured extraction |
| Data validation | Pydantic v2 | Define schemas, validate LLM output |
| Queue (simulated) | SQLite or in-memory list | Keep it simple |
| Metrics | In-memory counters → Prometheus (stretch) | |

### Step-by-Step Implementation

**Step 1: Define the data model**

- Define Pydantic models for:
  ```python
  class TicketInput(BaseModel):
      id: str
      subject: str
      body: str
      customer_tier: str  # "free", "pro", "enterprise"
      submitted_at: datetime

  class TriageResult(BaseModel):
      category: Literal["billing", "technical", "account", "feature_request", "bug_report"]
      subcategory: str
      priority: Literal["P1", "P2", "P3", "P4"]
      urgency_reason: str
      assigned_team: str
      confidence: float  # 0.0 to 1.0
      suggested_response: str
      requires_human_review: bool
  ```

**Step 2: Classification with structured output**

- Use OpenAI's function calling or JSON schema mode to enforce the `TriageResult` schema.
- System prompt should include:
  - Definitions of each category and subcategory
  - Priority rubric (P1 = system down, P2 = degraded, P3 = inconvenience, P4 = question)
  - Routing rules (which team handles which category)
  - Instructions to set `confidence` based on how clearly the ticket fits a category
- Parse and validate the response against your Pydantic model.

**Step 3: Confidence-based routing**

- If `confidence >= 0.8`: auto-route to the assigned team.
- If `confidence < 0.8`: flag for human review, include the model's best guess.
- If the customer is "enterprise" tier: always flag for human review regardless of confidence.
- Log all decisions for auditing.

**Step 4: Batch processing endpoint**

- POST `/triage` accepts a single ticket and returns `TriageResult`.
- POST `/triage/batch` accepts a list of tickets, processes them concurrently (using `asyncio.gather`), and returns results.
- Implement rate limiting to avoid API throttling.

**Step 5: Suggested response generation**

- For each triaged ticket, generate a draft customer response.
- Use a separate LLM call with context about the category, priority, and any known solutions.
- Mark it as a draft (not auto-sent).

**Step 6: Dashboard and metrics**

- GET `/metrics` returns:
  - Total tickets processed
  - Distribution by category, priority
  - Auto-routed vs human-review ratio
  - Average confidence score
  - Average processing time

### Common Pitfalls

- **Schema validation failures:** LLMs occasionally produce malformed JSON even with function calling. Always validate with Pydantic and implement retry logic (2–3 attempts).
- **Category leakage:** Without clear category definitions, the model invents its own categories. Be very specific in the system prompt.
- **Over-confident classification:** The model's self-reported confidence doesn't always correlate with accuracy. Calibrate the threshold using labeled test data.
- **Cost explosion on batch:** Processing 1000 tickets hits API limits fast. Implement concurrency limits and use the cheapest model that meets accuracy requirements.

### Evaluation Criteria

- [ ] Single and batch triage endpoints work
- [ ] Output consistently matches the Pydantic schema
- [ ] Confidence threshold routing works (low confidence → human review)
- [ ] Metrics endpoint reports accurate statistics
- [ ] Enterprise-tier tickets always get human review

### Stretch Goals

- Add a feedback endpoint: human reviewers correct the triage, log corrections for analysis
- Implement few-shot examples: include 3–5 example tickets and their correct triage in the prompt
- Build a simple web dashboard for the human review queue
- Add semantic deduplication: detect tickets about the same issue
- Implement SLA tracking: P1 tickets should be acknowledged within 15 minutes
- Compare accuracy across models (GPT-4o-mini vs Claude Haiku vs Gemini Flash)

---

## Project 5: API-Calling Agent with Tool Use

### Objective

Build an autonomous agent that can answer questions and perform actions by calling external APIs. The agent decides which tools to use, chains multiple tool calls when needed, and handles errors gracefully. This is the bridge between RAG (information retrieval) and agentic AI (taking actions).

### What You'll Learn

- LLM tool/function calling mechanics
- Tool definition schemas (JSON Schema)
- Multi-step agent loops (reason → act → observe → repeat)
- Error handling in non-deterministic systems
- Safety: confirmation before destructive actions

### Architecture

```
┌──────────┐
│  User    │
│  Input   │
└────┬─────┘
     │
     ▼
┌────────────────────────────────────────────────────┐
│                   AGENT LOOP                        │
│                                                     │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐  │
│  │ LLM      │───→│ Tool     │───→│ Execute      │  │
│  │ Decides  │    │ Parser   │    │ Tool Call    │  │
│  │ next     │    │          │    │              │  │
│  │ action   │    └──────────┘    └──────┬───────┘  │
│  └──────────┘                           │          │
│       ▲                                 │          │
│       │         ┌──────────────┐        │          │
│       └─────────│ Observation  │←───────┘          │
│                 │ (tool result)│                    │
│                 └──────────────┘                    │
│                                                     │
│  Loop continues until LLM produces a final answer   │
│  or max iterations reached                           │
└────────────────────────────────────────────────────┘
     │
     ▼
┌──────────┐    ┌──────────────────────────────────┐
│  Tools   │    │ - Weather API (read)             │
│  Registry│    │ - GitHub API (read/write)        │
│          │    │ - Database query (read)           │
│          │    │ - Slack message (write, guarded)  │
│          │    │ - Calculator (local)              │
└──────────┘    └──────────────────────────────────┘
```

### Tech Stack

| Component | Choice | Why |
|-----------|--------|-----|
| Language | Python 3.11+ | |
| Web framework | FastAPI | |
| LLM | OpenAI GPT-4o (best tool-calling performance) | |
| HTTP client | `httpx` | Async support for API calls |
| Data validation | Pydantic v2 | Tool input/output schemas |
| Rate limiting | `tenacity` | Retry logic for external APIs |

### Step-by-Step Implementation

**Step 1: Define the tool interface**

- Create a base tool interface:
  ```python
  class Tool(BaseModel):
      name: str
      description: str
      parameters: dict  # JSON Schema
      requires_confirmation: bool = False

      async def execute(self, **kwargs) -> str:
          ...
  ```
- Each tool returns a string result (the "observation" the LLM receives).

**Step 2: Implement 3–5 tools**

Start with a mix of read-only and write tools:

- **Weather tool:** Calls a free weather API (e.g., Open-Meteo). Read-only.
- **Calculator tool:** Evaluates math expressions. Local, no API call. Use `ast.literal_eval` or a safe math parser — never `eval()`.
- **GitHub tool:** Lists repos, creates issues, gets PR details. Uses GitHub API with a personal access token. Write operations require confirmation.
- **Database query tool:** Runs SELECT queries against a local SQLite database (pre-populated with sample data). Read-only.
- **Slack/notification tool:** Sends a message to a webhook. Write operation, requires confirmation.

**Step 3: Build the agent loop**

```python
async def run_agent(user_input: str, tools: list[Tool], max_iterations: int = 10):
    messages = [system_prompt, {"role": "user", "content": user_input}]

    for i in range(max_iterations):
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=[tool.to_openai_schema() for tool in tools],
        )

        choice = response.choices[0]

        # If the model wants to call a tool
        if choice.finish_reason == "tool_calls":
            for tool_call in choice.message.tool_calls:
                tool = find_tool(tool_call.function.name)
                args = json.loads(tool_call.function.arguments)

                # Safety check for destructive tools
                if tool.requires_confirmation:
                    # In a real system: pause and ask user
                    pass

                result = await tool.execute(**args)
                messages.append(choice.message)
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": result
                })

        # If the model produces a final answer
        elif choice.finish_reason == "stop":
            return choice.message.content

    return "Agent reached maximum iterations without a final answer."
```

**Step 4: Implement safety guardrails**

- **Confirmation for write operations:** Before executing tools marked `requires_confirmation`, return a pending state with the proposed action. The user must approve before execution proceeds.
- **Max iterations:** Hard limit on the agent loop (10 is reasonable).
- **Tool output truncation:** If a tool returns a huge result (e.g., a large database query), truncate to a reasonable size before feeding back to the LLM.
- **Input validation:** Validate tool arguments against the JSON Schema before execution.

**Step 5: FastAPI endpoints**

- POST `/agent/run` accepts `{"message": "...", "session_id": "..."}` and runs the agent loop.
- POST `/agent/confirm/{action_id}` approves a pending write action.
- GET `/agent/history/{session_id}` returns the conversation and tool-call history.

**Step 6: Observability**

- Log every step of the agent loop: LLM input/output, tool calls, tool results, errors.
- Track metrics: total tool calls per request, success/failure rate per tool, total tokens used, latency per step.
- Store the full trace for debugging.

### Common Pitfalls

- **Infinite loops:** The agent calls the same tool repeatedly with the same arguments. Detect this pattern and break out.
- **Tool hallucination:** The LLM invents tool names that don't exist. Validate the tool name against your registry before executing.
- **Argument parsing failures:** The LLM occasionally produces invalid JSON for tool arguments. Implement retry with a nudge ("Your tool call had invalid arguments, please try again").
- **Unbounded tool output:** A database query returning 10,000 rows will blow the context window. Always truncate/summarize tool output.
- **Security:** Never pass raw LLM output to `eval()`, shell commands, or SQL without sanitization. Use parameterized queries.

### Evaluation Criteria

- [ ] Agent can answer questions requiring 1 tool call (e.g., "What's the weather in Tokyo?")
- [ ] Agent can chain 2–3 tool calls to answer complex questions (e.g., "Find the open PRs in repo X and create an issue summarizing them")
- [ ] Write operations require user confirmation before executing
- [ ] Agent handles tool errors gracefully (e.g., API is down)
- [ ] Agent stops after max iterations with a meaningful message
- [ ] Full trace is logged for each agent run

### Stretch Goals

- Add a tool that searches the RAG system from Project 2 — combining retrieval with action
- Implement parallel tool calls (the LLM can request multiple tools at once)
- Add tool-use analytics: which tools are used most, which fail most
- Implement a "planning" step: before acting, have the agent outline its plan
- Build a web UI showing the agent's thought process, tool calls, and results in real time
- Add memory: the agent remembers results from previous sessions
