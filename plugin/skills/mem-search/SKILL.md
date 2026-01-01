---
name: mem-search
description: Search claude-mem's persistent cross-session memory database. Use when user asks "did we already solve this?", "how did we do X last time?", or needs work from previous sessions.
---

# Memory Search

Search past work across all sessions using a 3-layer workflow for optimal token efficiency.

## When to Use

Use when users ask about PREVIOUS sessions (not current conversation):

- "Did we already fix this?"
- "How did we solve X last time?"
- "What happened last week?"

## 3-Layer Workflow (ALWAYS FOLLOW)

1. **search(query)** → Get index with IDs (~50-100 tokens/result)
2. **timeline(anchor=ID)** → Get context around interesting results
3. **get_observations([IDs])** → Fetch full details ONLY for filtered IDs

**NEVER fetch full details without filtering first. 10x token savings.**

### Step 1: Search Everything

Use the `search` MCP tool:

**Required parameters:**

- `query` - Search term
- `project` - Project name (required)

**Optional parameters:**

- `limit` - How many results (default 20)
- `type` - Filter to "observations", "sessions", or "prompts"
- `dateStart` - Start date (YYYY-MM-DD or epoch timestamp)
- `dateEnd` - End date (YYYY-MM-DD or epoch timestamp)
- `obs_type` - Filter by type: bugfix, feature, decision, discovery, change

**Example:**

```
search(query="authentication", limit=20, project="my-project")
```

**Returns:**

```
| ID | Time | T | Title | Read | Work |
|----|------|---|-------|------|------|
| #11131 | 3:48 PM | 🟣 | Added JWT authentication | ~75 | 🛠️ 450 |
| #10942 | 2:15 PM | 🔴 | Fixed auth token expiration | ~50 | 🛠️ 200 |
```

### Step 2: Get Timeline Context

Use the `timeline` MCP tool to understand what was happening around a result:

**Example with observation ID:**

```
timeline(anchor=11131, depth_before=3, depth_after=3, project="my-project")
```

**Example with query (finds anchor automatically):**

```
timeline(query="authentication", depth_before=3, depth_after=3, project="my-project")
```

**Returns exactly `depth_before + 1 + depth_after` items** - observations, sessions, and prompts interleaved chronologically.

### Step 3: Batch Fetch by ID

Use `get_observations` to fetch full details for selected IDs:

```
get_observations(ids=[11131, 10942, 10855])
```

**With ordering and limit:**

```
get_observations(
  ids=[11131, 10942, 10855],
  orderBy="date_desc",
  limit=10,
  project="my-project"
)
```

**Why batch fetch?**

- **10-100x more efficient** than individual fetches
- Single HTTP request vs N requests
- Returns all results in one response

## Examples

**Find recent bug fixes:**

```
search(query="bug", type="observations", obs_type="bugfix", limit=20, project="my-project")
```

**Find what happened last week:**

```
search(type="observations", dateStart="2025-12-20", limit=20, project="my-project")
```

**Get context around a specific observation:**

```
timeline(anchor=11131, depth_before=5, depth_after=5, project="my-project")
```

## Why This Workflow?

**Token efficiency:**

- **Search results:** ~50-100 tokens per result (table index)
- **Full observation:** ~500-1000 tokens each
- **10x savings** - only fetch full when you know it's relevant

**Speed:**

- **Individual fetches:** 10 HTTP requests, ~5-10s latency
- **Batch fetch:** 1 HTTP request, ~0.5-1s latency

---

## Tool Reference

### search

Search across all memory types.

**Parameters:**

- `query` (string) - Search term
- `project` (string, required) - Project name
- `limit` (number) - Max results (default 20)
- `type` (string) - Filter: "observations", "sessions", "prompts"
- `dateStart`, `dateEnd` (string) - Date range
- `obs_type` (string) - Filter by type

### timeline

Get chronological context around a point.

**Parameters:**

- `anchor` (number) - Observation ID to center on
- `query` (string) - Search term to find anchor automatically
- `depth_before`, `depth_after` (number) - Items before/after (default 5)
- `project` (string, required) - Project name

### get_observations

Batch fetch observations by IDs.

**Parameters:**

- `ids` (array of numbers, required) - Observation IDs to fetch
- `orderBy` (string) - Sort order: "date_desc", "date_asc"
- `limit` (number) - Max results
- `project` (string) - Project filter

---

**Remember:** search → timeline → batch fetch = 10-100x faster
