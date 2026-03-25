# Auto-Solve Tasks

Fetch tasks from an OPC board column and dispatch each to the appropriate AI CLI based on its `aiModelTag`.

## Usage

```
/auto-solve-tasks <board-id> [--column "To Do"]
```

## Config (env vars)

```
OPC_API_URL=https://your-opc-instance.com   # or http://localhost:3000
OPC_API_TOKEN=opc_...                        # from Settings > API Tokens
```

## Behavior

1. `GET $OPC_API_URL/api/boards/<board-id>` with `Authorization: Bearer $OPC_API_TOKEN`
2. Find the target column:
   - If `--column <name>` is given, find the column with that name
   - Otherwise, use the first column (lowest `order`)
3. For each task in the column (ordered by `order`):
   - Read `title`, `content`, `aiModelTag`
   - Route by `aiModelTag` prefix:
     - `claude-*` or empty → execute as a sub-task in the current Claude Code session
     - `gpt-*` or `codex-*` → `codex "$title\n\n$content"`
     - `gemini-*` → `gemini "$title\n\n$content"`
   - On completion:
     - `PATCH $OPC_API_URL/api/tasks/<id>/move` with `{ "columnId": "<next-column-id>" }` to move to the next column
     - `POST $OPC_API_URL/api/tasks/<id>/comments` with `{ "content": "<summary>" }` to post a summary comment
4. Repeat until the column is empty or the user interrupts

## When invoked as `/auto-solve-tasks <board-id> [--column "..."]`:

1. Read `OPC_API_URL` and `OPC_API_TOKEN` from environment. If missing, error with setup instructions.
2. Fetch the board: `GET $OPC_API_URL/api/boards/<board-id>` (Bearer token auth)
3. Identify the source column and the next column (the one with the next higher `order`)
4. For each task in the source column:
   a. Print: `Working on: <title>`
   b. Build prompt: `<title>\n\n<content>`
   c. Dispatch based on `aiModelTag`:
      - No tag or `claude-*`: Handle as a sub-task directly in this session
      - `gpt-*` / `codex-*`: Run `codex "<prompt>"`
      - `gemini-*`: Run `gemini "<prompt>"`
   d. After completion, move task to next column and post summary comment
5. Print summary: `Completed N tasks`
