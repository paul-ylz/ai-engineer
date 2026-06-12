In the OpenAI **Responses API** (as well as the Chat Completions API), there isn't a traditional cache object that you
explicitly manage or clear. Instead, caching is **managed completely automatically by OpenAI** at the server level via *
*Prompt Caching**.

Here is exactly how the cache works, where to find it in the API response, and how it behaves.

---

## Where to Find the Cache Data (The Response Object)

You won't find a "cache" folder or cache keys in your local setup. Instead, OpenAI looks at the incoming prompt and
determines if parts of it have been recently processed.

To see if your request successfully hit the cache, you need to check the `usage` object returned in the API response. It
lives under `prompt_tokens_details.cached_tokens`:

```json
{
  "id": "resp_12345...",
  "object": "response",
  "model": "gpt-4o",
  "usage": {
    "prompt_tokens": 2006,
    "completion_tokens": 300,
    "total_tokens": 2306,
    "prompt_tokens_details": {
      "cached_tokens": 1920,
      // <--- THIS IS YOUR CACHE HIT!
      "audio_tokens": 0
    },
    "completion_tokens_details": {
      "reasoning_tokens": 0,
      "audio_tokens": 0
    }
  }
}

```

If `cached_tokens` is greater than `0`, the cache was successfully used. Those specific tokens are heavily discounted
and returned with much lower latency.

---

## How the Cache Works Under the Hood

OpenAI routes your API requests to specific server nodes based on a **hash of the initial prefix** of your prompt (
typically looking at the first 256 tokens).

1. **The Machine Lookup:** The router sends your request to a machine likely to hold your prompt context.
2. **The Cache Check:** That machine checks its local GPU memory to see if the exact identical text matches.
3. **Hit or Miss:** * **Cache Hit:** It uses the pre-computed KV (key/value) tensors, saving time and money.

* **Cache Miss:** It processes the prompt normally, and then saves that prefix to its cache for the next call.

---

## Rules and Mechanics of the Cache

* **Minimum Size Required:** The prompt must be **at least 1,024 tokens long** for caching to kick in. Anything shorter
  will not be cached.
* **Incremental Caching:** After the first 1,024 tokens, OpenAI caches text in **128-token increments**.
* **Strict Prefix Matching:** It matches from the *very beginning* of the prompt. If you change a single character in
  the first sentence, the entire cache is invalidated (a cache miss). Keep your static data (system prompts, large
  context documents, tools) at the top, and put your dynamic user queries at the very bottom.
* **Retention Policy:** By default, the system uses an `in_memory` policy where the cache is cleared after 5 to 10
  minutes of inactivity (and always wiped after 1 hour). Newer models allow configuring a `prompt_cache_retention`
  parameter to `"24h"`, which spills cached data over to GPU-local storage so it lasts longer.