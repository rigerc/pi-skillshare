# Files

## File: .agents/skills/am-command-skillshare-recommend/SKILL.md
````markdown
---
name: am-command-skillshare-recommend
description: Analyze codebase with repomix, search skillshare for relevant skills, and recommend top 5
x-agentsmesh-kind: command
x-agentsmesh-name: skillshare-recommend
x-agentsmesh-allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

Generate a skill profile of this repository using repomix, then search the skillshare registry for relevant community skills and recommend the best matches.

Focus on **domain-relevant skills**: ones that match what this project *is* (e.g., skill systems, extension patterns, package management, skill authoring, configuration management). Deprioritize generic tooling, CI, and AI/LLM skills unless they directly match a unique aspect of the project.

## Workflow

1. **Determine repo name**: Extract the repository name from `git remote -v` (e.g., `origin  git@github.com:user/repo.git` → `repo`). Use that as `<repo name>`.

2. **Run repomix**: Execute:
   ```bash
   npx -y repomix --skill-generate --no-dot-ignore --skill-output .skillshare/skills/<repo name> --force
   ```

3. **Analyze generated files**: Read the generated files in `.skillshare/skills/<repo name>/` — examine the skill profile, detected patterns, languages, frameworks, and conventions captured by repomix.

4. **Extract tech stack signals**: From the repomix-generated skill profile, extract every distinct:
   - Language (e.g., TypeScript, Python, Rust, Go)
   - Framework / runtime (e.g., React, Next.js, Vue, Svelte, Django, FastAPI, Express)
   - Major library or tool (e.g., Prisma, Tailwind, Docker, Redis, PostgreSQL)
   - Testing approach (e.g., Vitest, Playwright, pytest, Jest)
   - Detected convention or pattern (e.g., monorepo, microservices, GraphQL, REST)

5. **Populate up to 3 queries and run multi-search aggregation**: From the repomix tech-stack, craft **at most 3 queries** — they should target **domain-relevant skills** (e.g., skill systems, extension patterns, package management, skill authoring, configuration management). Avoid queries about tooling, CI, testing, or generic AI/LLM topics unless they match a unique project need. Execute the script below.

   ```bash
   # ── Populate with 1-3 domain-targeted queries ──
   QUERIES=(
     "skill system"
     "extension pattern"
     "configuration management"
   )

   # ── Automated aggregation script ──
   RESULTS_DIR=$(mktemp -d)
   ALL="$RESULTS_DIR/_all.json"
   echo '[]' > "$ALL"

   echo "=== Running ${#QUERIES[@]} targeted searches ==="
   for q in "${QUERIES[@]}"; do
     safe=$(echo "$q" | tr -s ' /' '_')
     out="$RESULTS_DIR/$safe.json"
     echo "  Searching: $q"
     skillshare search "$q" --json --limit 10 > "$out" 2>/dev/null
     if [[ $? -ne 0 || ! -s "$out" ]]; then
       echo "    ⚠  Empty"
       continue
     fi
     is_valid=$(jq 'if type == "array" and length > 0 then true else false end' "$out" 2>/dev/null)
     if [[ "$is_valid" != "true" ]]; then
       echo "    ⚠  No results"
       continue
     fi
     # Tag each result with its source query then merge
     jq --arg q "$q" '[.[] | . + {_source: $q}]' "$out" > "${out}.tagged" 2>/dev/null
     jq -s 'add' "$ALL" "${out}.tagged" > "${ALL}.tmp" 2>/dev/null && mv "${ALL}.tmp" "$ALL"
   done

   echo ""
   echo "=== Aggregating and deduplicating ==="
   AGGREGATED="$RESULTS_DIR/aggregated.json"

   # Deduplicate by Name, sort by Stars descending, track matched queries
   jq '
     group_by(.Name)
     | map(
         first as $orig
         | {
             name: $orig.Name,
             description: $orig.Description,
             stars: ($orig.Stars // 0),
             owner: $orig.Owner,
             source: $orig.Source,
             repo: $orig.Repo,
             tags: $orig.Tags // [],
             matched_by: [.[] | ._source] | unique
           }
       )
     | sort_by(-.stars)
     | to_entries
     | map(.key += 1 | { rank: .key, name: .value.name, description: .value.description, stars: .value.stars, owner: .value.owner, source: .value.source, repo: .value.repo, tags: .value.tags, matched_by: .value.matched_by })
   ' "$ALL" > "$AGGREGATED" 2>/dev/null

   if [[ ! -s "$AGGREGATED" ]]; then
     echo "No valid results could be aggregated."
     cat "$ALL" 2>/dev/null | head -c 2000 || true
     rm -rf "$RESULTS_DIR"
     exit 1
   fi

   echo ""
   echo "╔══════════════════════════════════════════════════════════╗"
   echo "║             SKILLSHARE RECOMMENDATIONS                  ║"
   echo "╚══════════════════════════════════════════════════════════╝"
   jq -r '
     .[] |
     "\(.rank). \(.name)
        ⭐ \(.stars) stars  |  Owner: \(.owner // "?")
        \(.description // "(no description)")
        Matched by: \(if (.matched_by | length) > 0 then (.matched_by | join(", ")) else "direct search" end)
     "' "$AGGREGATED" 2>&1 | head -120

   cp "$AGGREGATED" ".skillshare/skills/<repo name>/aggregated-results.json"
   echo ""
   echo "Full results saved to: .skillshare/skills/<repo name>/aggregated-results.json"
   rm -rf "$RESULTS_DIR"
   ```

6. **Review and recommend top 5**: Read the leaderboard from the script output. Pick the **5 most relevant skills** based on:
   - How well the skill matches the project's **domain** (its purpose, not its toolchain)
   - Description alignment with the project
   - Practical benefit for day-to-day development
   - **Avoid** generic tooling, CI, or AI/LLM skills unless they have a unique, non-obvious fit

   For each of the 5 recommendations, explain:
   - What domain/technologies from the codebase it maps to
   - Why it was selected over other candidates
   - How it would benefit development on this project
````

## File: .agentsmesh/commands/skillshare-recommend.md
````markdown
---
description: Analyze codebase with repomix, search skillshare for relevant
  skills, and recommend top 5
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

Generate a skill profile of this repository using repomix, then search the skillshare registry for relevant community skills and recommend the best matches.

Focus on **domain-relevant skills**: ones that match what this project *is* (e.g., skill systems, extension patterns, package management, skill authoring, configuration management). Deprioritize generic tooling, CI, and AI/LLM skills unless they directly match a unique aspect of the project.

## Workflow

1. **Determine repo name**: Extract the repository name from `git remote -v` (e.g., `origin  git@github.com:user/repo.git` → `repo`). Use that as `<repo name>`.

2. **Run repomix**: Execute:
   ```bash
   npx -y repomix --skill-generate --no-dot-ignore --skill-output .skillshare/skills/<repo name> --force
   ```

3. **Analyze generated files**: Read the generated files in `.skillshare/skills/<repo name>/` — examine the skill profile, detected patterns, languages, frameworks, and conventions captured by repomix.

4. **Extract tech stack signals**: From the repomix-generated skill profile, extract every distinct:
   - Language (e.g., TypeScript, Python, Rust, Go)
   - Framework / runtime (e.g., React, Next.js, Vue, Svelte, Django, FastAPI, Express)
   - Major library or tool (e.g., Prisma, Tailwind, Docker, Redis, PostgreSQL)
   - Testing approach (e.g., Vitest, Playwright, pytest, Jest)
   - Detected convention or pattern (e.g., monorepo, microservices, GraphQL, REST)

5. **Populate up to 3 queries and run multi-search aggregation**: From the repomix tech-stack, craft **at most 3 queries** — they should target **domain-relevant skills** (e.g., skill systems, extension patterns, package management, skill authoring, configuration management). Avoid queries about tooling, CI, testing, or generic AI/LLM topics unless they match a unique project need. Execute the script below.

   ```bash
   # ── Populate with 1-3 domain-targeted queries ──
   QUERIES=(
     "skill system"
     "extension pattern"
     "configuration management"
   )

   # ── Automated aggregation script ──
   RESULTS_DIR=$(mktemp -d)
   ALL="$RESULTS_DIR/_all.json"
   echo '[]' > "$ALL"

   echo "=== Running ${#QUERIES[@]} targeted searches ==="
   for q in "${QUERIES[@]}"; do
     safe=$(echo "$q" | tr -s ' /' '_')
     out="$RESULTS_DIR/$safe.json"
     echo "  Searching: $q"
     skillshare search "$q" --json --limit 10 > "$out" 2>/dev/null
     if [[ $? -ne 0 || ! -s "$out" ]]; then
       echo "    ⚠  Empty"
       continue
     fi
     is_valid=$(jq 'if type == "array" and length > 0 then true else false end' "$out" 2>/dev/null)
     if [[ "$is_valid" != "true" ]]; then
       echo "    ⚠  No results"
       continue
     fi
     # Tag each result with its source query then merge
     jq --arg q "$q" '[.[] | . + {_source: $q}]' "$out" > "${out}.tagged" 2>/dev/null
     jq -s 'add' "$ALL" "${out}.tagged" > "${ALL}.tmp" 2>/dev/null && mv "${ALL}.tmp" "$ALL"
   done

   echo ""
   echo "=== Aggregating and deduplicating ==="
   AGGREGATED="$RESULTS_DIR/aggregated.json"

   # Deduplicate by Name, sort by Stars descending, track matched queries
   jq '
     group_by(.Name)
     | map(
         first as $orig
         | {
             name: $orig.Name,
             description: $orig.Description,
             stars: ($orig.Stars // 0),
             owner: $orig.Owner,
             source: $orig.Source,
             repo: $orig.Repo,
             tags: $orig.Tags // [],
             matched_by: [.[] | ._source] | unique
           }
       )
     | sort_by(-.stars)
     | to_entries
     | map(.key += 1 | { rank: .key, name: .value.name, description: .value.description, stars: .value.stars, owner: .value.owner, source: .value.source, repo: .value.repo, tags: .value.tags, matched_by: .value.matched_by })
   ' "$ALL" > "$AGGREGATED" 2>/dev/null

   if [[ ! -s "$AGGREGATED" ]]; then
     echo "No valid results could be aggregated."
     cat "$ALL" 2>/dev/null | head -c 2000 || true
     rm -rf "$RESULTS_DIR"
     exit 1
   fi

   echo ""
   echo "╔══════════════════════════════════════════════════════════╗"
   echo "║             SKILLSHARE RECOMMENDATIONS                  ║"
   echo "╚══════════════════════════════════════════════════════════╝"
   jq -r '
     .[] |
     "\(.rank). \(.name)
        ⭐ \(.stars) stars  |  Owner: \(.owner // "?")
        \(.description // "(no description)")
        Matched by: \(if (.matched_by | length) > 0 then (.matched_by | join(", ")) else "direct search" end)
     "' "$AGGREGATED" 2>&1 | head -120

   cp "$AGGREGATED" ".skillshare/skills/<repo name>/aggregated-results.json"
   echo ""
   echo "Full results saved to: .skillshare/skills/<repo name>/aggregated-results.json"
   rm -rf "$RESULTS_DIR"
   ```

6. **Review and recommend top 5**: Read the leaderboard from the script output. Pick the **5 most relevant skills** based on:
   - How well the skill matches the project's **domain** (its purpose, not its toolchain)
   - Description alignment with the project
   - Practical benefit for day-to-day development
   - **Avoid** generic tooling, CI, or AI/LLM skills unless they have a unique, non-obvious fit

   For each of the 5 recommendations, explain:
   - What domain/technologies from the codebase it maps to
   - Why it was selected over other candidates
   - How it would benefit development on this project
````

## File: .agents/skills/am-command-init-rules/SKILL.md
````markdown
---
name: am-command-init-rules
description: Initialize non-obvious modular rules for the codebase
x-agentsmesh-kind: command
x-agentsmesh-name: init-rules
x-agentsmesh-allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - question
---

Generate modular, path-scoped rules that are **non-obvious, project-specific, and actionable** using a 3-phase workflow.

## Phase 1: Discovery (Find Non-Obvious Patterns)

Analyze the repository to identify project-specific conventions, not generic patterns:
1. Use Glob to map file types and directory structure
2. Read framework configs (`package.json`, `go.mod`, etc.) for project-specific dependencies
3. Grep for repeated custom patterns (e.g., internal utility usage, error handling wrappers, custom types)
4. Identify existing anti-patterns or inconsistent practices to codify as rules
5. Suggest rule topics based on **project-specific** findings, not generic categories

## Phase 2: Configuration

For each rule, use the `question` tool to gather:
- Rule topic (prioritize project-specific conventions over generic ones)
- Scope: global or path-specific (use `globs:` for file scoping)
- Target tools (optional `targets:` array)
- Team-specific non-obvious rules to include

## Phase 3: Generation (Non-Obvious Rules Only)

Create rule files in `rules/` with strict guidelines:

### Frontmatter Format

```markdown
---
description: Project-specific API response convention
targets: [claude-code, cursor]
globs: ["src/api/**/*.ts"]
---

- All endpoints must return the project's `ApiEnvelope<T>` type (never raw objects)
- Include `requestId` matching the `traceId` from the project's logger
- Use `handleApiError` wrapper for all catch blocks (no raw error throws)
```

### Rule Requirements

- **Non-obvious only**: Reject generic advice (e.g., "validate input", "write tests")
- **Project-specific**: Capture team conventions, custom patterns, or edge cases
- **Succinct**: 5-15 bullet points per rule (10-15 lines max excluding frontmatter)
- **Actionable**: Clear, specific to the codebase (e.g., "use `withTransaction` wrapper" not "handle DB errors")
- **Organized**: Use subdirectories by topic (`frontend/`, `backend/`, `testing/`)

### Bad vs Good Rule Examples

❌ Obvious (reject): "Use strict TypeScript. Never use `any`."
✅ Non-obvious (accept): "Prefer project's `Result<T, E>` type over throws for all service layer errors"

After creating rules, suggest running `agentsmesh generate` to deploy to configured AI tools.
````

## File: .agents/skills/am-command-plan-task/SKILL.md
````markdown
---
name: am-command-plan-task
description: Plan and add as task
x-agentsmesh-kind: command
x-agentsmesh-name: plan-task
---

Use td-task-management skill and make a new task with a attached implementation plan.
````

## File: .agentsmesh/agents/_example.md
````markdown
---
name: example-agent
description: "Example subagent — rename and customize"
# tools: [Read, Grep, Glob]
# model: sonnet
# permissionMode: ask
# maxTurns: 10
---

Describe this agent's role and instructions here.
Agents are specialized subagents with restricted tools and a specific purpose.
````

## File: .agentsmesh/commands/_example.md
````markdown
---
description: "Example command — rename and customize"
# allowed-tools: [Read, Grep, Glob, Bash]
---

Describe the task for this command here.
Commands are invoked on-demand (e.g. /example) with a focused tool set.
````

## File: .agentsmesh/commands/init-rules.md
````markdown
---
description: "Initialize non-obvious modular rules for the codebase"
allowed-tools: [Read, Grep, Glob, Bash, question]
---

Generate modular, path-scoped rules that are **non-obvious, project-specific, and actionable** using a 3-phase workflow.

## Phase 1: Discovery (Find Non-Obvious Patterns)

Analyze the repository to identify project-specific conventions, not generic patterns:
1. Use Glob to map file types and directory structure
2. Read framework configs (`package.json`, `go.mod`, etc.) for project-specific dependencies
3. Grep for repeated custom patterns (e.g., internal utility usage, error handling wrappers, custom types)
4. Identify existing anti-patterns or inconsistent practices to codify as rules
5. Suggest rule topics based on **project-specific** findings, not generic categories

## Phase 2: Configuration

For each rule, use the `question` tool to gather:
- Rule topic (prioritize project-specific conventions over generic ones)
- Scope: global or path-specific (use `globs:` for file scoping)
- Target tools (optional `targets:` array)
- Team-specific non-obvious rules to include

## Phase 3: Generation (Non-Obvious Rules Only)

Create rule files in `.agentsmesh/rules/` with strict guidelines:

### Frontmatter Format

```markdown
---
description: Project-specific API response convention
targets: [claude-code, cursor]
globs: ["src/api/**/*.ts"]
---

- All endpoints must return the project's `ApiEnvelope<T>` type (never raw objects)
- Include `requestId` matching the `traceId` from the project's logger
- Use `handleApiError` wrapper for all catch blocks (no raw error throws)
```

### Rule Requirements

- **Non-obvious only**: Reject generic advice (e.g., "validate input", "write tests")
- **Project-specific**: Capture team conventions, custom patterns, or edge cases
- **Succinct**: 5-15 bullet points per rule (10-15 lines max excluding frontmatter)
- **Actionable**: Clear, specific to the codebase (e.g., "use `withTransaction` wrapper" not "handle DB errors")
- **Organized**: Use subdirectories by topic (`frontend/`, `backend/`, `testing/`)

### Bad vs Good Rule Examples

❌ Obvious (reject): "Use strict TypeScript. Never use `any`."
✅ Non-obvious (accept): "Prefer project's `Result<T, E>` type over throws for all service layer errors"

After creating rules, suggest running `agentsmesh generate` to deploy to configured AI tools.
````

## File: .agentsmesh/commands/plan-task.md
````markdown
---
description: "Plan and add as task"
---

Use td-task-management skill and make a new task with a attached implementation plan.
````

## File: .agentsmesh/rules/_example.md
````markdown
---
description: "Example contextual rule — rename and customize"
# targets: [claude-code, cursor]   # limit to specific tools (optional)
# globs: ["src/**/*.ts"]           # activate only for matching files (optional)
---

# Example Rule

Replace this with your coding standards, conventions, or domain-specific guidelines.
````

## File: .agentsmesh/rules/_root.md
````markdown
---
root: true
description: Project rules
---
````

## File: .agentsmesh/rules/common.md
````markdown
---
description: Project conventions
---

# Common Rules

## Code Style

### Organization
- **One responsibility per file** - Split large files (>300 lines) into focused modules
- **Consistent structure** - Imports -> Constants -> Types -> Functions -> Exports
- **Avoid deep nesting** - Maximum 3 levels; extract helper functions
- **No orphaned code** - Delete unused functions, imports, and variables

### Naming

| Element | Convention | Example |
|---------|------------|---------|
| Files | kebab-case | `user-service.ts` |
| Classes | PascalCase | `UserService` |
| Functions | camelCase (JS/TS), snake_case (Python/Kotlin/Rust) | `getUser`, `get_user` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRIES` |

### Quality
- **Immutability first** - Prefer `const`, `val`, immutable data structures
- **Pure functions** - Minimize side effects; isolate I/O at boundaries
- **Explicit over implicit** - Clear types, explicit returns, no magic
- **Early returns** - Reduce nesting with guard clauses
- **No magic numbers** - Extract constants with descriptive names

### Error Handling
- Catch specific exceptions, not generic ones
- Fail fast with clear messages
- Don't swallow errors - log or re-raise
- Clean up resources with try/finally or context managers

### Comments
- Self-documenting code over comments
- Explain **why**, not what
- No commented-out code - use version control

## Testing

### TDD Workflow
1. Write failing test - Define expected behavior
2. Make it pass - Minimal implementation
3. Refactor - Improve while green

### Coverage

| Scope | Minimum |
|-------|---------|
| Overall | 80% |
| New code | 90% |

### Naming Convention
```
test_<unit>_<situation>_<expected>
```
Examples: `test_login_valid_credentials_returns_token`, `test_payment_insufficient_funds_raises_error`

### Test Structure (Situation / Expected)
```python
def test_user_creation_with_valid_data_succeeds():
    # Situation - valid user data provided
    user_data = {"email": "test@example.com", "name": "Test"}

    # Expected - user is created with correct fields
    user = create_user(user_data)
    assert user.email == "test@example.com"
    assert user.id is not None
```

### Test Categories

| Type | Purpose | Speed |
|------|---------|-------|
| Unit | Single function | <100ms |
| Integration | Module interaction | <1s |
| E2E | Full user flows | >1s |

### Test Quality
- Test behavior, not implementation
- Keep tests independent - no shared state
- Make tests deterministic
- Cover edge cases
- Mock at boundaries only

## Git

### Branch Naming
```
<type>/<description>
```
Types: `feature`, `fix`, `refactor`, `docs`, `test`, `chore`

### Commit Messages
```
type(scope): concise description

- Detail 1
- Detail 2

Co-Authored-By: Claude <noreply@anthropic.com>
```
Types: feat, fix, docs, style, refactor, test, chore

### Pre-Commit Checklist
- `git status` - Verify expected files
- `git diff --cached` - Review changes
- No sensitive files (.env, credentials)
- No debug statements (console.log, print)
- Tests pass

### PR Process
- Same format as commit messages for title
- Include summary, changes, and test plan
- At least 1 approval, all CI checks pass

### Rules
- Never force push to main/master
- Never commit secrets
- Keep commits atomic (one logical change)
- Run tests before pushing

## Performance

### Efficiency
- Only load files you need
- Use parallel tool calls for independent tasks
- Batch git operations into single commands
- Use specific search patterns over broad scans
````

## File: .agentsmesh/ignore
````
# Patterns ignored by all configured AI tools (gitignore syntax)
#
# node_modules/
# dist/
# .env*
# *.log
# coverage/
````

## File: .agentsmesh/permissions.yaml
````yaml
# Tool permission allow/deny lists
#
# allow:
#   - Bash(npm run:*)
#   - Bash(git add:*)
#   - Bash(git commit:*)
#
# deny:
#   - Bash(rm -rf:*)
#   - Bash(git push --force:*)
#
# ask:
#   - Write(/tmp/**)
allow:
  - Bash(td *:*)
deny: []
ask: []
````

## File: .pi/extensions/pi-permissions-system/config.json
````json
{
  "$schema": "https://raw.githubusercontent.com/gotgenes/pi-permission-system/main/schemas/permissions.schema.json",
  "debugLog": false,
  "permissionReviewLog": true,
  "yoloMode": false,
  "piInfrastructureReadPaths": [],
  "permission": {
    "*": "ask",
    "read": "allow",
    "write": "ask",
    "bash": {
      "*": "ask",
      "git status": "allow",
      "git diff": "allow",
      "git *": "ask",
      "td *": "allow"
    },
    "mcp": {
      "*": "allow",
      "mcp_status": "allow",
      "mcp_list": "allow"
    },
    "skill": {
      "*": "allow"
    },
    "external_directory": {
      "*": "ask",
      "~/development/*": "allow",
      "~/go/*": "allow"
    }
  }
}
````

## File: .todos/agent_errors.jsonl
````
{"ts":"2026-05-09T17:46:24.930836778Z","args":["create","Fix shell injection in CLI wrappers","--type","bug","--priority","P0","--description-file","-","--acceptance-file","-"],"error":"--acceptance-file cannot read from stdin more than once in a single command","session":"ses_7a47bc"}
````

## File: .todos/command_usage.jsonl
````
{"ts":"2026-05-09T19:46:07.916617819+02:00","cmd":"","ok":true,"dur_ms":0}
{"ts":"2026-05-09T19:46:11.351536469+02:00","cmd":"usage","flags":{"new-session":"true"},"session":"ses_7a47bc","ok":true,"dur_ms":77}
{"ts":"2026-05-09T19:46:24.842076039+02:00","cmd":"create","session":"ses_7a47bc","ok":false,"dur_ms":5,"err":"--acceptance-file cannot read from stdin more than once in a single command"}
{"ts":"2026-05-09T19:46:33.232097933+02:00","cmd":"create","flags":{"acceptance-file":"/tmp/td-acc1.md","description-file":"/tmp/td-desc1.md","priority":"P0","type":"bug"},"session":"ses_7a47bc","ok":true,"dur_ms":83}
{"ts":"2026-05-09T19:46:40.131095777+02:00","cmd":"create","flags":{"acceptance-file":"/tmp/td-acc2.md","description-file":"/tmp/td-desc2.md","priority":"P2","type":"bug"},"session":"ses_7a47bc","ok":true,"dur_ms":170}
{"ts":"2026-05-09T19:46:48.455871184+02:00","cmd":"create","flags":{"acceptance-file":"/tmp/td-acc3.md","description-file":"/tmp/td-desc3.md","priority":"P2","type":"chore"},"session":"ses_7a47bc","ok":true,"dur_ms":241}
{"ts":"2026-05-09T19:46:53.95121127+02:00","cmd":"start","session":"ses_7a47bc","ok":true,"dur_ms":130}
{"ts":"2026-05-09T19:46:54.147361598+02:00","cmd":"log","session":"ses_7a47bc","ok":true,"dur_ms":63}
{"ts":"2026-05-09T19:49:20.909625838+02:00","cmd":"log","session":"ses_7a47bc","ok":true,"dur_ms":56}
{"ts":"2026-05-09T19:49:31.558457467+02:00","cmd":"start","session":"ses_7a47bc","ok":true,"dur_ms":91}
{"ts":"2026-05-09T19:49:31.698167448+02:00","cmd":"log","session":"ses_7a47bc","ok":true,"dur_ms":56}
{"ts":"2026-05-09T19:50:06.76369614+02:00","cmd":"log","session":"ses_7a47bc","ok":true,"dur_ms":89}
{"ts":"2026-05-09T19:50:11.030089596+02:00","cmd":"start","session":"ses_7a47bc","ok":true,"dur_ms":91}
{"ts":"2026-05-09T19:50:11.176996229+02:00","cmd":"log","session":"ses_7a47bc","ok":true,"dur_ms":55}
{"ts":"2026-05-09T19:54:50.216958753+02:00","cmd":"log","session":"ses_7a47bc","ok":true,"dur_ms":57}
````

## File: .todos/config.json
````json
{
  "focused_issue_id": "td-22732c",
  "pane_heights": [
    0,
    0,
    0
  ]
}
````

## File: .todos/config.json.lock
````

````

## File: .todos/db.lock
````

````

## File: src/index.ts
````typescript
/**
 * Skillshare Extension — Main Entry Point
 *
 * Provides:
 *   /skillshare [query]      – tabbed TUI: search, installed, status
 *   /skillshare-settings     – standalone settings panel
 *   /skillshare-sync         – one-shot sync
 *   /skillshare-update       – one-shot update
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { matchesKey, Key } from "@earendil-works/pi-tui";
import type { SkillshareConfig } from "./utils";
import { DEFAULT_CONFIG, isSkillshareAvailable, detectProjectMode, resolveScope } from "./utils";
import {
	TabBar,
	SKILLSHARE_TABS,
	type TabId,
	SearchPanel,
	InstalledPanel,
	StatusPanel,
	SettingsPanel,
	type SearchPanelCallbacks,
} from "./panels";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** Current configuration, loaded from session or defaults. */
let config: SkillshareConfig = { ...DEFAULT_CONFIG };

// Detect project mode from filesystem on first load
config.installMode = detectProjectMode(process.cwd()) ? "project" : "global";

// ---------------------------------------------------------------------------
// Entry Point
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
	// Restore saved config from session
	pi.on("session_start", async (_event, ctx) => {
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type === "custom" && entry.customType === "skillshare-config") {
				const saved = entry.data as SkillshareConfig | undefined;
				if (saved?.hubMode && saved?.installMode && saved?.searchLimit) {
					config = { ...saved };
				}
			}
		}
	});

	// Persist config
	function saveConfig() {
		pi.appendEntry<SkillshareConfig>("skillshare-config", { ...config });
	}

	// ── /skillshare — Main tabbed panel (search / installed / status) ───

	pi.registerCommand("skillshare", {
		description:
			"Search, install, and manage skillshare skills. " +
			"Usage: /skillshare [query]",
		handler: async (args, ctx: ExtensionCommandContext) => {
			if (!isSkillshareAvailable()) {
				ctx.ui.notify(
					"skillshare CLI not found. Install from https://github.com/runkids/skillshare",
					"error",
				);
				return;
			}

			if (!ctx.hasUI) {
				ctx.ui.notify("/skillshare requires interactive mode", "error");
				return;
			}

			// Prompt for query if none provided
			let initialQuery = args?.trim() || "";
			if (!initialQuery) {
				const input = await ctx.ui.input(
					"Search skillshare for:",
					"Enter a keyword, skill name, or leave empty to browse popular skills",
				);
				if (input === undefined || input === null) {
					ctx.ui.notify("Search cancelled", "info");
					return;
				}
				initialQuery = input;
			}

			// Shared callbacks
			const callbacks: SearchPanelCallbacks = {
				onNotify: (msg, type) => ctx.ui.notify(msg, type),
				onSetStatus: (msg) => ctx.ui.setStatus("skillshare", msg),
				onClearStatus: () => ctx.ui.setStatus("skillshare", ""),
				onClose: () => { /* handled by custom() */ },
				onRequestRender: () => { /* set below */ },
			};

			await ctx.ui.custom<void>(
				(_tui, theme, _kb, done) => {
					let currentTab: TabId = "search";

					const tabBar = new TabBar(theme, SKILLSHARE_TABS, (tab) => {
						currentTab = tab;
						_tui.requestRender();
					});

					const searchPanel = new SearchPanel(
						config,
						theme,
						{
							...callbacks,
							onRequestRender: () => _tui.requestRender(),
						},
						initialQuery,
					);

					const installedPanel = new InstalledPanel(config, theme, {
						...callbacks,
						onRequestRender: () => _tui.requestRender(),
					});

					const statusPanel = new StatusPanel(config, theme, {
						...callbacks,
						onRequestRender: () => _tui.requestRender(),
					});

					const component = {
						render(width: number): string[] {
							const lines: string[] = [];
							lines.push(...tabBar.render(width));
							lines.push("");
							switch (currentTab) {
								case "search":
									lines.push(...searchPanel.render(width));
									break;
								case "installed":
									lines.push(...installedPanel.render(width));
									break;
								case "status":
									lines.push(...statusPanel.render(width));
									break;
							}
							return lines;
						},

						handleInput(data: string) {
							if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
								done();
								return;
							}

							const prevTab = currentTab;
							tabBar.handleInput(data);

							if (currentTab !== prevTab) {
								_tui.requestRender();
								return;
							}

							switch (currentTab) {
								case "search":
									searchPanel.handleInput(data);
									break;
								case "installed":
									installedPanel.handleInput(data);
									break;
								case "status":
									statusPanel.handleInput(data);
									break;
							}
							_tui.requestRender();
						},

						invalidate() {
							tabBar.invalidate();
							searchPanel.invalidate();
							installedPanel.invalidate();
							statusPanel.invalidate();
						},
					};

					return component;
				},
			);
		},
	});

	// ── /skillshare-settings — Standalone settings panel ────────────────

	pi.registerCommand("skillshare-settings", {
		description: "Configure skillshare extension defaults (hub mode, install target, search limit)",
		handler: async (_args, ctx: ExtensionCommandContext) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("/skillshare-settings requires interactive mode", "error");
				return;
			}

			await ctx.ui.custom<void>(
				(_tui, theme, _kb, done) => {
					const settingsPanel = new SettingsPanel(config, theme, {
						onConfigChange: (newConfig) => {
							config = newConfig;
							saveConfig();
							ctx.ui.notify("Settings updated", "info");
						},
						onNotify: (msg, type) => ctx.ui.notify(msg, type),
						onRequestRender: () => _tui.requestRender(),
					});

					const component = {
						render(width: number): string[] {
							const lines: string[] = [];

							// Title
							lines.push(theme.fg("accent", theme.bold(" Skillshare Settings")));
							lines.push(theme.fg("borderMuted", "─".repeat(width)));
							lines.push("");

							// Settings panel body
							lines.push(...settingsPanel.render(width));

							// Footer
							lines.push("");
							lines.push(theme.fg("borderMuted", "─".repeat(width)));
							lines.push(
								`  ${theme.fg("dim", "Esc close")}`,
							);

							return lines;
						},

						handleInput(data: string) {
							if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
								done();
								return;
							}
							settingsPanel.handleInput(data);
							_tui.requestRender();
						},

						invalidate() {
							settingsPanel.invalidate();
						},
					};

					return component;
				},
			);
		},
	});

	// ── /skillshare-sync — One-shot sync ─────────────────────────────

	pi.registerCommand("skillshare-sync", {
		description:
			"Sync installed skills to configured targets. " +
			"Usage: /skillshare-sync [-p | -g]",
		handler: async (args, ctx: ExtensionCommandContext) => {
			if (!isSkillshareAvailable()) {
				ctx.ui.notify(
					"skillshare CLI not found. Install from https://github.com/runkids/skillshare",
					"error",
				);
				return;
			}

			const projectMode = resolveScope(args, config) === "project";
			ctx.ui.setStatus("skillshare", "Syncing skills...");

			try {
				const { syncSkills } = await import("./utils");
				const output = syncSkills(projectMode);
				ctx.ui.setStatus("skillshare", "");
				ctx.ui.notify("Sync completed", "success");
				console.log(`skillshare sync:\n${output}`);
			} catch (err: unknown) {
				ctx.ui.setStatus("skillshare", "");
				ctx.ui.notify(
					`Sync failed: ${err instanceof Error ? err.message : String(err)}`,
					"error",
				);
			}
		},
	});

	// ── /skillshare-update — One-shot update ──────────────────────────

	pi.registerCommand("skillshare-update", {
		description:
			"Check for updates then apply them. " +
			"Usage: /skillshare-update [-p | -g]",
		handler: async (args, ctx: ExtensionCommandContext) => {
			if (!isSkillshareAvailable()) {
				ctx.ui.notify(
					"skillshare CLI not found. Install from https://github.com/runkids/skillshare",
					"error",
				);
				return;
			}

			const projectMode = resolveScope(args, config) === "project";

			// Step 1: Check for updates first
			ctx.ui.setStatus("skillshare", "Checking for updates...");

			let checkResult;
			try {
				const { checkSkills } = await import("./utils");
				checkResult = checkSkills(projectMode);
			} catch (err: unknown) {
				ctx.ui.setStatus("skillshare", "");
				ctx.ui.notify(
					`Check failed: ${err instanceof Error ? err.message : String(err)}`,
					"error",
				);
				return;
			}

			ctx.ui.setStatus("skillshare", "");

			// Summarise results
			const updatable = checkResult.skills.filter(
				(s: any) => s.status === "update_available"
			);
			const stale = checkResult.skills.filter(
				(s: any) => s.status === "stale"
			);
			const reposBehind = checkResult.tracked_repos.filter(
				(r: any) => r.status === "behind"
			);
			const upToDateCount =
				checkResult.skills.filter((s: any) => s.status === "up_to_date").length;

			if (updatable.length === 0 && reposBehind.length === 0 && stale.length === 0) {
				if (checkResult.skills.length === 0 && checkResult.tracked_repos.length === 0) {
					ctx.ui.notify("No skills installed — nothing to check", "info");
				} else {
					ctx.ui.notify(
						`All ${upToDateCount} skills are up to date`,
						"success",
					);
				}
				return;
			}

			// Build summary message
			let summary = "";
			if (updatable.length > 0) {
				summary += `\n  Updates available (${updatable.length}):`;
				for (const s of updatable.slice(0, 6)) {
					summary += `\n    \u2022 ${s.name}`;
				}
				if (updatable.length > 6) {
					summary += `\n    ... and ${updatable.length - 6} more`;
				}
			}
			if (reposBehind.length > 0) {
				summary += `\n  Tracked repos behind (${reposBehind.length}):`;
				for (const r of reposBehind) {
					summary += `\n    \u2022 ${r.name} (${r.behind} commit(s))`;
				}
			}
			if (stale.length > 0) {
				summary += `\n  Stale skills (${stale.length}):`;
				for (const s of stale.slice(0, 4)) {
					summary += `\n    \u2022 ${s.name}`;
				}
				if (stale.length > 4) {
					summary += `\n    ... and ${stale.length - 4} more (use --prune to remove)`;
				}
			}

			ctx.ui.notify(`Changes detected:${summary}`, "info");

			// Step 2: Ask for confirmation
			const confirmed = await ctx.ui.confirm(
				"Apply all updates now?",
				"Yes",
				"No",
			);

			if (!confirmed) {
				ctx.ui.notify("Update cancelled", "info");
				return;
			}

			// Step 3: Run update
			ctx.ui.setStatus("skillshare", "Updating skills...");

			try {
				const { updateSkills } = await import("./utils");
				const output = updateSkills(projectMode);
				ctx.ui.setStatus("skillshare", "");
				ctx.ui.notify("Update completed", "success");
				console.log(`skillshare update:\n${output}`);
			} catch (err: unknown) {
				ctx.ui.setStatus("skillshare", "");
				ctx.ui.notify(
					`Update failed: ${err instanceof Error ? err.message : String(err)}`,
					"error",
				);
			}
		},
	});

	// ── /skillshare-ui — Launch web UI ─────────────────────────────

	pi.registerCommand("skillshare-ui", {
		description: "Open the skillshare web UI in a browser",
		handler: async (_args, ctx: ExtensionCommandContext) => {
			if (!isSkillshareAvailable()) {
				ctx.ui.notify(
					"skillshare CLI not found. Install from https://github.com/runkids/skillshare",
					"error",
				);
				return;
			}

			ctx.ui.setStatus("skillshare", "Starting web UI...");

			try {
				const { openUI } = await import("./utils");
				const { url } = openUI(process.cwd());
				ctx.ui.setStatus("skillshare", "");
				ctx.ui.notify("Skillshare web UI starting at " + url, "success");
			} catch (err: unknown) {
				ctx.ui.setStatus("skillshare", "");
				ctx.ui.notify(
					"Failed to start UI: " + (err instanceof Error ? err.message : String(err)),
					"error",
				);
			}
		},
	});
}
````

## File: src/panels.ts
````typescript
/**
 * TUI panel components for the skillshare extension.
 *
 * Contains:
 *   - TabBar         – horizontal tab bar
 *   - SearchPanel    – search + multi-select + install
 *   - InstalledPanel – list installed skills with actions
 *   - StatusPanel    – health dashboard
 *   - SettingsPanel  – extension configuration
 */

import type { Theme } from "@earendil-works/pi-coding-agent";
import { matchesKey, Key, truncateToWidth } from "@earendil-works/pi-tui";
import type {
	SkillSearchResult,
	InstalledSkill,
	SkillshareConfig,
} from "./utils";
import {
	searchSkillsAsync,
	installSkill,
	listInstalledSkills,
	syncSkills,
	updateSkills,
	uninstallSkill,
	runDoctor,
	startSpinner,
	formatStars,
} from "./utils";

// ---------------------------------------------------------------------------
// Tab bar
// ---------------------------------------------------------------------------

export type TabId = "search" | "installed" | "status" | "settings";

export interface TabDef {
	id: TabId;
	label: string;
}

/** Three-tab layout used by /skillshare (search + installed + status). */
export const SKILLSHARE_TABS: TabDef[] = [
	{ id: "search", label: "Search" },
	{ id: "installed", label: "Installed" },
	{ id: "status", label: "Status" },
];

export class TabBar {
	private cursor = 0;
	private tabs: TabDef[];
	private onTabChange: (tab: TabId) => void;
	private theme: Theme;
	private cachedWidth?: number;
	private cachedLines?: string[];

	constructor(theme: Theme, tabs: TabDef[], onTabChange: (tab: TabId) => void) {
		this.theme = theme;
		this.tabs = tabs;
		this.onTabChange = onTabChange;
	}

	get activeTab(): TabId {
		return this.tabs[this.cursor].id;
	}

	setActiveTab(id: TabId) {
		const idx = this.tabs.findIndex((t) => t.id === id);
		if (idx >= 0) this.cursor = idx;
		this.cachedWidth = undefined;
	}

	handleInput(data: string) {
		if (matchesKey(data, Key.left) || matchesKey(data, Key.shift("tab"))) {
			this.cursor = this.cursor === 0 ? this.tabs.length - 1 : this.cursor - 1;
			this.cachedWidth = undefined;
			this.onTabChange(this.activeTab);
		} else if (matchesKey(data, Key.right) || matchesKey(data, Key.tab)) {
			this.cursor = this.cursor === this.tabs.length - 1 ? 0 : this.cursor + 1;
			this.cachedWidth = undefined;
			this.onTabChange(this.activeTab);
		}
	}

	render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

		const t = this.theme;
		const lines: string[] = [];
		let bar = " ";
		for (let i = 0; i < this.tabs.length; i++) {
			const tab = this.tabs[i];
			const active = i === this.cursor;
			const sep = i > 0 ? t.fg("borderMuted", " │ ") : " ";
			const label = active
				? t.fg("accent", t.bold(` ${tab.label} `))
				: t.fg("muted", ` ${tab.label} `);
			bar += `${sep}${label}`;
		}
		lines.push(truncateToWidth(bar, width));

		// Divider line
		const divider = t.fg("borderMuted", "─".repeat(width));
		lines.push(divider);

		this.cachedWidth = width;
		this.cachedLines = lines;
		return lines;
	}

	invalidate() {
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}
}

// ---------------------------------------------------------------------------
// Search Panel
// ---------------------------------------------------------------------------

export interface SearchPanelCallbacks {
	onNotify: (msg: string, type: "info" | "success" | "error") => void;
	onSetStatus: (msg: string) => void;
	onClearStatus: () => void;
	onClose: () => void;
	onRequestRender: () => void;
}

export class SearchPanel {
	private query: string;
	private results: SkillSearchResult[] = [];
	private checked: boolean[] = [];
	private cursor = 0;
	private config: SkillshareConfig;
	private callbacks: SearchPanelCallbacks;
	private theme: Theme;
	private searching = false;
	private installedNames: Set<string>;
	private cachedWidth?: number;
	private cachedLines?: string[];

	constructor(
		config: SkillshareConfig,
		theme: Theme,
		callbacks: SearchPanelCallbacks,
		initialQuery: string,
	) {
		this.config = config;
		this.theme = theme;
		this.callbacks = callbacks;
		this.query = initialQuery;
		this.installedNames = new Set(
			listInstalledSkills(config.installMode === "project").map((s) => s.name),
		);

		// Auto-search if query provided
		if (this.query) {
			this.runSearch();
		}
	}

	handleInput(data: string) {
		if (this.searching) return;

		if (matchesKey(data, Key.enter) && this.results.length > 0) {
			this.installSelected();
			return;
		}

		if (matchesKey(data, Key.space) && this.results.length > 0) {
			if (this.cursor < this.checked.length) {
				this.checked[this.cursor] = !this.checked[this.cursor];
				this.cachedWidth = undefined;
			}
			return;
		}

		if (matchesKey(data, Key.up) || matchesKey(data, "k")) {
			if (this.results.length > 0) {
				this.cursor = Math.max(0, this.cursor - 1);
				this.cachedWidth = undefined;
			}
			return;
		}

		if (matchesKey(data, Key.down) || matchesKey(data, "j")) {
			if (this.results.length > 0) {
				this.cursor = Math.min(this.results.length - 1, this.cursor + 1);
				this.cachedWidth = undefined;
			}
			return;
		}

		if (matchesKey(data, "s") && !this.query) {
			// 's' to search when idle — handled by main panel
		}
	}

	async runSearch(newQuery?: string) {
		if (newQuery !== undefined) this.query = newQuery;
		if (!this.query) return;

		this.searching = true;
		this.cachedWidth = undefined;
		this.callbacks.onRequestRender();

		const stopSpinner = startSpinner(
			this.callbacks.onSetStatus,
			`searching "${this.query}"...`,
		);

		try {
			this.results = await searchSkillsAsync(
				this.query,
				this.config.searchLimit,
				this.config.hubMode,
			);
			this.checked = new Array(this.results.length).fill(false);
			this.cursor = 0;
		} catch (err: unknown) {
			this.results = [];
			this.checked = [];
			this.callbacks.onNotify(
				err instanceof Error ? err.message : String(err),
				"error",
			);
		} finally {
			stopSpinner();
			this.callbacks.onClearStatus();
			this.searching = false;
			this.cachedWidth = undefined;
			this.callbacks.onRequestRender();
		}
	}

	private async installSelected() {
		const selected: number[] = [];
		for (let i = 0; i < this.checked.length; i++) {
			if (this.checked[i]) selected.push(i);
		}
		if (selected.length === 0) {
			this.callbacks.onNotify("No skills selected", "info");
			return;
		}

		const projectMode = this.config.installMode === "project";
		const modeLabel = projectMode ? "project" : "global";

		// We need to close the panel to show confirm dialogs
		// Instead, we'll install sequentially with status feedback
		this.callbacks.onSetStatus(`Installing ${selected.length} skill(s) to ${modeLabel}...`);

		const installed: string[] = [];
		const failed: Array<{ name: string; error: string }> = [];
		let lastRender = Date.now();

		for (let i = 0; i < selected.length; i++) {
			const skill = this.results[selected[i]];
			this.callbacks.onSetStatus(
				`Installing ${skill.Name} (${i + 1}/${selected.length})...`,
			);

			// Throttle renders for performance
			if (Date.now() - lastRender > 100) {
				this.callbacks.onRequestRender();
				lastRender = Date.now();
			}

			try {
				const output = installSkill(skill.Source, projectMode);
				installed.push(skill.Name);
				console.log(`Installed ${skill.Name}:\n${output}`);
			} catch (err: unknown) {
				const message = err instanceof Error ? err.message : String(err);
				failed.push({ name: skill.Name, error: message });
				console.error(`Failed to install ${skill.Name}: ${message}`);
			}
		}

		this.callbacks.onClearStatus();

		// Update installed names
		for (const name of installed) {
			this.installedNames.add(name);
		}

		// Report
		if (installed.length > 0) {
			this.callbacks.onNotify(
				`✓ Installed: ${installed.join(", ")}`,
				"success",
			);
			this.callbacks.onNotify(
				"Run sync from the Status panel to distribute",
				"info",
			);
		}
		if (failed.length > 0) {
			this.callbacks.onNotify(
				`✗ Failed: ${failed.map((f) => `${f.name} (${f.error})`).join("; ")}`,
				"error",
			);
		}

		this.cachedWidth = undefined;
		this.callbacks.onRequestRender();
	}

	render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width && !this.searching) {
			return this.cachedLines;
		}

		const t = this.theme;
		const lines: string[] = [];

		// Query bar
		const queryLine = `${t.fg("accent", "Search")}: ${this.query || t.fg("dim", "(no query — reopen with a keyword)")}`;
		lines.push(queryLine);
		lines.push("");

		// Searching indicator
		if (this.searching) {
			lines.push(`  ${t.fg("muted", "Searching...")}`);
			this.cachedLines = lines;
			return lines;
		}

		// No results
		if (this.results.length === 0) {
			if (this.query) {
				lines.push(`  ${t.fg("dim", `No results for "${this.query}"`)}`);
				lines.push("");
				lines.push(
					`  ${t.fg("muted", "Try different keywords or change hub in /skillshare-settings")}`,
				);
			} else {
				lines.push(`  ${t.fg("dim", "Run /skillshare <query> to search")}`);
			}
			lines.push("");
			// Key hints
			lines.push(`  ${t.fg("dim", "← → or Tab tabs  |  s  search  |  Esc close")}`);
			this.cachedLines = lines;
			return lines;
		}

		// Results header
		const hubLabel =
			this.config.hubMode === "community-hub"
				? t.fg("muted", " [community hub]")
				: "";
		lines.push(
			`  ${t.fg("muted", `${this.results.length} result(s)${hubLabel}`)}`,
		);
		lines.push("");

		// Paginate results
		const visibleCount = Math.min(this.results.length, 14);
		const startOffset = Math.max(
			0,
			Math.min(
				this.cursor - Math.floor(visibleCount / 2),
				this.results.length - visibleCount,
			),
		);
		const endIndex = Math.min(startOffset + visibleCount, this.results.length);

		for (let i = startOffset; i < endIndex; i++) {
			const r = this.results[i];
			const isCursor = i === this.cursor;
			const isChecked = this.checked[i];
			const isInstalled = this.installedNames.has(r.Name);

			const checkbox = isChecked
				? t.fg("success", "✓")
				: t.fg("dim", "○");
			const cursorMarker = isCursor ? t.fg("accent", "▸") : " ";

			const starStr = formatStars(r.Stars);
			const starTag = starStr ? t.fg("warning", ` ★${starStr}`) : "";
			const installedTag = isInstalled
				? ` ${t.fg("success", "installed")}`
				: "";

			let source = r.Source;
			if (source.length > 34) source = "…" + source.slice(-33);

			const nameWidth = Math.floor(width * 0.32);
			const name = truncateToWidth(
				`${r.Name}${starTag}${installedTag}`,
				nameWidth,
			);
			const src = truncateToWidth(source, Math.max(15, width - nameWidth - 8));

			lines.push(
				` ${cursorMarker} ${checkbox} ${t.fg(isCursor ? "text" : "muted", name)} ${t.fg("dim", src)}`,
			);
		}

		if (this.results.length > visibleCount) {
			lines.push(
				`  ${t.fg("dim", `… ${this.results.length - visibleCount} more`)}`,
			);
		}

		lines.push("");

		// Status + hints
		const count = this.checked.filter(Boolean).length;
		if (count > 0) {
			lines.push(
				`  ${t.fg("success", `${count} selected — Enter to install`)}`,
			);
		}
		lines.push(
			`  ${t.fg("dim", "↑↓ navigate  |  Space toggle  |  Enter install  |  ← → or Tab tabs")}`,
		);

		this.cachedWidth = width;
		this.cachedLines = lines;
		return lines;
	}

	invalidate() {
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}
}

// ---------------------------------------------------------------------------
// Installed Panel
// ---------------------------------------------------------------------------

export class InstalledPanel {
	private skills: InstalledSkill[] = [];
	private cursor = 0;
	private theme: Theme;
	private config: SkillshareConfig;
	private callbacks: SearchPanelCallbacks;
	private loading = true;
	private actionMsg = "";
	private cachedWidth?: number;
	private cachedLines?: string[];

	constructor(
		config: SkillshareConfig,
		theme: Theme,
		callbacks: SearchPanelCallbacks,
	) {
		this.config = config;
		this.theme = theme;
		this.callbacks = callbacks;
		this.refresh();
	}

	refresh() {
		this.loading = true;
		this.skills = listInstalledSkills(this.config.installMode === "project");
		this.cursor = 0;
		this.loading = false;
		this.cachedWidth = undefined;
	}

	handleInput(data: string) {
		if (this.loading) return;

		if (matchesKey(data, Key.up) || matchesKey(data, "k")) {
			if (this.skills.length > 0) {
				this.cursor = Math.max(0, this.cursor - 1);
				this.cachedWidth = undefined;
			}
			return;
		}
		if (matchesKey(data, Key.down) || matchesKey(data, "j")) {
			if (this.skills.length > 0) {
				this.cursor = Math.min(this.skills.length - 1, this.cursor + 1);
				this.cachedWidth = undefined;
			}
			return;
		}
		if (matchesKey(data, "u") && this.skills.length > 0) {
			// Uninstall focused skill
			this.doUninstall();
			return;
		}
		if (matchesKey(data, "U")) {
			// Update all
			this.doUpdate();
			return;
		}
		if (matchesKey(data, "r")) {
			this.refresh();
			this.cachedWidth = undefined;
			this.callbacks.onRequestRender();
			return;
		}
	}

	private async doUninstall() {
		if (this.cursor >= this.skills.length) return;
		const skill = this.skills[this.cursor];
		this.actionMsg = `Uninstalling ${skill.name}...`;
		this.callbacks.onSetStatus(this.actionMsg);
		this.cachedWidth = undefined;
		this.callbacks.onRequestRender();

		try {
			uninstallSkill(skill.name, this.config.installMode === "project");
			this.callbacks.onNotify(`Uninstalled ${skill.name}`, "success");
			this.refresh();
		} catch (err: unknown) {
			this.callbacks.onNotify(
				`Failed: ${err instanceof Error ? err.message : String(err)}`,
				"error",
			);
		}
		this.actionMsg = "";
		this.callbacks.onClearStatus();
		this.cachedWidth = undefined;
		this.callbacks.onRequestRender();
	}

	private async doUpdate() {
		this.actionMsg = "Updating all skills...";
		this.callbacks.onSetStatus(this.actionMsg);
		this.cachedWidth = undefined;
		this.callbacks.onRequestRender();

		try {
			const output = updateSkills(this.config.installMode === "project");
			this.callbacks.onNotify("All skills updated", "success");
			console.log(`skillshare update:\n${output}`);
		} catch (err: unknown) {
			this.callbacks.onNotify(
				`Update failed: ${err instanceof Error ? err.message : String(err)}`,
				"error",
			);
		}
		this.actionMsg = "";
		this.callbacks.onClearStatus();
		this.cachedWidth = undefined;
		this.callbacks.onRequestRender();
	}

	render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width && !this.actionMsg) {
			return this.cachedLines;
		}

		const t = this.theme;
		const lines: string[] = [];
		const modeLabel =
			this.config.installMode === "project" ? "project" : "global";

		lines.push(t.fg("accent", ` Installed Skills (${modeLabel})`));
		lines.push("");

		if (this.loading) {
			lines.push(`  ${t.fg("dim", "Loading...")}`);
			return lines;
		}

		if (this.actionMsg) {
			lines.push(`  ${t.fg("muted", this.actionMsg)}`);
			return lines;
		}

		if (this.skills.length === 0) {
			lines.push(`  ${t.fg("dim", "No installed skills")}`);
			lines.push("");
			lines.push(`  ${t.fg("muted", "Go to the Search tab to find and install skills")}`);
			lines.push("");
			lines.push(`  ${t.fg("dim", "← → or Tab tabs  |  r refresh  |  Esc close")}`);
			this.cachedLines = lines;
			return lines;
		}

		lines.push(`  ${t.fg("muted", `${this.skills.length} skill(s) installed`)}`);
		lines.push("");

		const visibleCount = Math.min(this.skills.length, 16);
		const startOffset = Math.max(
			0,
			Math.min(
				this.cursor - Math.floor(visibleCount / 2),
				this.skills.length - visibleCount,
			),
		);
		const endIndex = Math.min(startOffset + visibleCount, this.skills.length);

		for (let i = startOffset; i < endIndex; i++) {
			const s = this.skills[i];
			const isCursor = i === this.cursor;
			const cursorMarker = isCursor ? t.fg("accent", "▸") : " ";
			const name = truncateToWidth(s.name, Math.floor(width * 0.4));
			lines.push(
				` ${cursorMarker} ${t.fg(isCursor ? "text" : "muted", name)} ${t.fg("dim", truncateToWidth(s.path, Math.max(10, width - 50)))}`,
			);
		}

		if (this.skills.length > visibleCount) {
			lines.push(`  ${t.fg("dim", `… ${this.skills.length - visibleCount} more`)}`);
		}

		lines.push("");
		lines.push(
			`  ${t.fg("dim", "↑↓ navigate  |  u uninstall  |  U update all  |  r refresh  |  ← → or Tab tabs")}`,
		);

		this.cachedWidth = width;
		this.cachedLines = lines;
		return lines;
	}

	invalidate() {
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}
}

// ---------------------------------------------------------------------------
// Status Panel
// ---------------------------------------------------------------------------

export class StatusPanel {
	private theme: Theme;
	private config: SkillshareConfig;
	private callbacks: SearchPanelCallbacks;
	private actionMsg = "";
	private cachedWidth?: number;
	private cachedLines?: string[];

	constructor(
		config: SkillshareConfig,
		theme: Theme,
		callbacks: SearchPanelCallbacks,
	) {
		this.config = config;
		this.theme = theme;
		this.callbacks = callbacks;
	}

	handleInput(data: string) {
		if (matchesKey(data, "s")) {
			this.doAction("sync");
		} else if (matchesKey(data, "u")) {
			this.doAction("update");
		} else if (matchesKey(data, "d")) {
			this.doAction("doctor");
		}
	}

	private async doAction(action: "sync" | "update" | "doctor") {
		const labels: Record<string, string> = {
			sync: "Syncing skills to targets...",
			update: "Updating all skills...",
			doctor: "Running doctor...",
		};
		this.actionMsg = labels[action];
		this.callbacks.onSetStatus(this.actionMsg);
		this.cachedWidth = undefined;
		this.callbacks.onRequestRender();

		try {
			let output = "";
			switch (action) {
				case "sync":
					output = syncSkills(this.config.installMode === "project");
					break;
				case "update":
					output = updateSkills(this.config.installMode === "project");
					break;
				case "doctor":
					output = runDoctor();
					break;
			}
			this.callbacks.onNotify(`${action} completed`, "success");
			console.log(`skillshare ${action}:\n${output}`);
		} catch (err: unknown) {
			this.callbacks.onNotify(
				`${action} failed: ${err instanceof Error ? err.message : String(err)}`,
				"error",
			);
		}
		this.actionMsg = "";
		this.callbacks.onClearStatus();
		this.cachedWidth = undefined;
		this.callbacks.onRequestRender();
	}

	render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width && !this.actionMsg) {
			return this.cachedLines;
		}

		const t = this.theme;
		const lines: string[] = [];

		lines.push(t.fg("accent", " Skillshare Status"));
		lines.push("");

		if (this.actionMsg) {
			lines.push(`  ${t.fg("muted", this.actionMsg)}`);
			return lines;
		}

		// Version
		const version = listInstalledSkills(this.config.installMode === "project").length;
		lines.push(`  ${t.fg("muted", "Skills installed:")}  ${t.fg("text", String(version))}`);

		const modeLabel = this.config.installMode === "project" ? "project (.skillshare/)" : "global (~/.config/skillshare)";
		lines.push(`  ${t.fg("muted", "Install mode:")}      ${t.fg("text", modeLabel)}`);

		const hubLabel = this.config.hubMode === "community-hub" ? "community hub" : "GitHub search";
		lines.push(`  ${t.fg("muted", "Search source:")}     ${t.fg("text", hubLabel)}`);

		const hasProject = listInstalledSkills(true).length > 0;
		const hasGlobal = listInstalledSkills(false).length > 0;
		lines.push(
			`  ${t.fg("muted", "Project skills:")}    ${hasProject ? t.fg("success", "found") : t.fg("dim", "none")}`,
		);
		lines.push(
			`  ${t.fg("muted", "Global skills:")}     ${hasGlobal ? t.fg("success", "found") : t.fg("dim", "none")}`,
		);
		lines.push("");
		lines.push(`  ${t.fg("dim", "Actions:  s sync  |  u update  |  d doctor")}`);
		lines.push(`  ${t.fg("dim", "← → or Tab tabs  |  Esc close")}`);

		this.cachedWidth = width;
		this.cachedLines = lines;
		return lines;
	}

	invalidate() {
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}
}

// ---------------------------------------------------------------------------
// Settings Panel
// ---------------------------------------------------------------------------

export interface SettingsCallbacks {
	onConfigChange: (config: SkillshareConfig) => void;
	onNotify: (msg: string, type: "info" | "success" | "error") => void;
	onRequestRender: () => void;
}

export class SettingsPanel {
	private config: SkillshareConfig;
	private theme: Theme;
	private callbacks: SettingsCallbacks;
	private cursor = 0;
	private cachedWidth?: number;
	private cachedLines?: string[];

	// Setting options
	private settings: Array<{
		id: string;
		label: string;
		detail: string;
		values: string[];
		currentIndex: number;
	}>;

	constructor(config: SkillshareConfig, theme: Theme, callbacks: SettingsCallbacks) {
		this.config = { ...config };
		this.theme = theme;
		this.callbacks = callbacks;
		this.buildSettings();
	}

	private buildSettings() {
		this.settings = [
			{
				id: "hubMode",
				label: "Search source",
				detail: "Where to search for skills",
				values: ["GitHub search", "Community hub"],
				currentIndex: this.config.hubMode === "community-hub" ? 1 : 0,
			},
			{
				id: "installMode",
				label: "Default install target",
				detail: "Where skills are installed by default",
				values: ["Global (~/.config)", "Project (.skillshare/)"],
				currentIndex: this.config.installMode === "project" ? 1 : 0,
			},
			{
			id: "operationScope",
			label: "Check/update scope",
			detail: "Scope for check and update commands",
			values: ["Global", "Project"],
			currentIndex: this.config.operationScope === "project" ? 1 : 0,
		},
		{
			id: "searchLimit",
			label: "Search result limit",
			detail: "Max results per search",
			values: ["10", "20", "30", "50"],
			currentIndex: (() => {
				const idx = [10, 20, 30, 50].indexOf(this.config.searchLimit);
				return idx >= 0 ? idx : 1; // default to 20
			})(),
		},
		];
	}

	handleInput(data: string) {
		if (matchesKey(data, Key.up) || matchesKey(data, "k")) {
			this.cursor = this.cursor === 0 ? this.settings.length - 1 : this.cursor - 1;
			this.cachedWidth = undefined;
			return;
		}
		if (matchesKey(data, Key.down) || matchesKey(data, "j")) {
			this.cursor = this.cursor === this.settings.length - 1 ? 0 : this.cursor + 1;
			this.cachedWidth = undefined;
			return;
		}
		if (matchesKey(data, Key.left)) {
			const setting = this.settings[this.cursor];
			setting.currentIndex =
				setting.currentIndex === 0
					? setting.values.length - 1
					: setting.currentIndex - 1;
			this.applySetting(setting);
			this.cachedWidth = undefined;
			return;
		}
		if (matchesKey(data, Key.right)) {
			const setting = this.settings[this.cursor];
			setting.currentIndex =
				setting.currentIndex === setting.values.length - 1
					? 0
					: setting.currentIndex + 1;
			this.applySetting(setting);
			this.cachedWidth = undefined;
			return;
		}
	}

	private applySetting(setting: (typeof this.settings)[0]) {
		const newConfig = { ...this.config };

		switch (setting.id) {
			case "hubMode":
				newConfig.hubMode = setting.currentIndex === 1 ? "community-hub" : "github";
				break;
			case "installMode":
				newConfig.installMode = setting.currentIndex === 1 ? "project" : "global";
				break;
			case "operationScope":
				newConfig.operationScope = setting.currentIndex === 1 ? "project" : "global";
				break;
			case "searchLimit":
				newConfig.searchLimit = [10, 20, 30, 50][setting.currentIndex] ?? 20;
				break;
		}

		this.config = newConfig;
		this.callbacks.onConfigChange(newConfig);
	}

	render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

		const t = this.theme;
		const lines: string[] = [];

		lines.push(t.fg("accent", " Settings"));
		lines.push("");
		lines.push(
			`  ${t.fg("muted", "↑↓ navigate  |  ← → change value  |  Esc close")}`,
		);
		lines.push("");

		for (let i = 0; i < this.settings.length; i++) {
			const s = this.settings[i];
			const isCursor = i === this.cursor;
			const cursorMarker = isCursor ? t.fg("accent", "▸") : " ";

			const label = t.fg(isCursor ? "text" : "muted", s.label);
			const value = t.fg("accent", s.values[s.currentIndex]);
			const detail = `  ${t.fg("dim", s.detail)}`;

			lines.push(` ${cursorMarker} ${label}: ${value}${detail}`);
		}

		lines.push("");
		lines.push(
			`  ${t.fg(
				"dim",
				this.config.hubMode === "community-hub"
					? "Search uses community skillshare-hub (--hub flag)"
					: "Search queries GitHub directly (no --hub flag)",
			)}`,
		);

		this.cachedWidth = width;
		this.cachedLines = lines;
		return lines;
	}

	invalidate() {
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}
}
````

## File: src/utils.ts
````typescript
/**
 * Shared utilities for the skillshare extension.
 * CLI wrappers, error parsing, spinner, etc.
 */

import { execFileSync, execFile, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SkillSearchResult {
	Name: string;
	Description: string;
	Source: string;
	Stars: number;
	Owner: string;
	Repo: string;
	Path: string;
	Tags?: string[];
	RiskScore?: number | null;
	RiskLabel?: string;
}

export interface InstalledSkill {
	name: string;
	source?: string;
	path: string;
}

export interface SkillshareConfig {
	hubMode: "github" | "community-hub";
	installMode: "project" | "global";
	operationScope: "project" | "global";
	searchLimit: number;
}

export const DEFAULT_CONFIG: SkillshareConfig = {
	hubMode: "github",
	installMode: "project",
	operationScope: "project",
	searchLimit: 20,
};

// ---------------------------------------------------------------------------
// Check types
// ---------------------------------------------------------------------------

export interface CheckRepoResult {
	name: string;
	status: string;
	behind: number;
	branch?: string;
	message?: string;
}

export interface CheckSkillResult {
	name: string;
	source: string;
	version: string;
	status: string;
	installed_at?: string;
}

export interface CheckOutput {
	tracked_repos: CheckRepoResult[];
	skills: CheckSkillResult[];
}

// ---------------------------------------------------------------------------
// CLI helpers
// ---------------------------------------------------------------------------

/** Check if the `skillshare` CLI is available on PATH. */
export function isSkillshareAvailable(): boolean {
	try {
		execFileSync("skillshare", ["--version"], { stdio: "ignore", timeout: 5000 });
		return true;
	} catch {
		return false;
	}
}

/** Get the skillshare CLI version. */
export function getSkillshareVersion(): string {
	try {
		return execFileSync("skillshare", ["--version"], {
			encoding: "utf-8",
			timeout: 5000,
		}).trim();
	} catch {
		return "unknown";
	}
}

/** Get project root (where .skillshare/ lives) by walking up at most 20 levels. */
export function getProjectRoot(cwd: string): string | null {
	let dir = cwd;
	for (let i = 0; i < 20; i++) {
		if (fs.existsSync(path.join(dir, ".skillshare"))) return dir;
		const parent = path.resolve(dir, "..");
		if (parent === dir) break;
		dir = parent;
	}
	return null;
}

/** Check whether project mode should be default. */
/** Resolve operation scope from CLI args (-p/-g) falling back to config. */
export function resolveScope(
	args: string | undefined,
	config: SkillshareConfig,
): "project" | "global" {
	if (!args) return config.operationScope;
	const parts = args.trim().split(/\s+/);
	for (const p of parts) {
		if (p === "-p" || p === "--project") return "project";
		if (p === "-g" || p === "--global") return "global";
	}
	return config.operationScope;
}

export function detectProjectMode(cwd: string): boolean {
	return getProjectRoot(cwd) !== null;
}

// ---------------------------------------------------------------------------
// Error parsing
// ---------------------------------------------------------------------------

function parseSkillshareError(stderr: string, stdout: string): string {
	const combined = stderr + "\n" + stdout;
	try {
		const parsed = JSON.parse(stdout.trim()) as { error?: string };
		if (parsed.error) {
			const e = parsed.error;
			if (
				e.includes("requires authentication") ||
				e.includes("401") ||
				e.includes("Not Found")
			) {
				return (
					"GitHub authentication required. Run:\n" +
					"  gh auth login\n" +
					"Or set:\n" +
					"  export GITHUB_TOKEN=ghp_your_token_here"
				);
			}
			if (e.includes("rate limit") || e.includes("403")) {
				return (
					"GitHub API rate limit exceeded. Wait or set GITHUB_TOKEN:\n" +
					"  export GITHUB_TOKEN=ghp_your_token_here"
				);
			}
			return e;
		}
	} catch {
		/* not JSON */
	}

	const lower = combined.toLowerCase();
	if (lower.includes("command not found") || lower.includes("not recognized")) {
		return "The skillshare CLI is not installed or not on PATH.\n  Install: https://github.com/runkids/skillshare";
	}
	if (lower.includes("requires authentication") || lower.includes("401")) {
		return (
			"GitHub authentication required. Run:\n" +
			"  gh auth login\n" +
			"Or set:\n" +
			"  export GITHUB_TOKEN=ghp_your_token_here"
		);
	}
	if (lower.includes("rate limit") || lower.includes("403")) {
		return (
			"GitHub API rate limit exceeded. Wait or set GITHUB_TOKEN:\n" +
			"  export GITHUB_TOKEN=ghp_your_token_here"
		);
	}
	if (lower.includes("network") || lower.includes("timed out") || lower.includes("econnrefused")) {
		return "Network error: could not reach GitHub. Check your internet connection.";
	}
	const lines = combined.split("\n").filter((l) => l.trim());
	return lines.length > 0 ? lines.slice(0, 5).join("\n") : "Unknown error";
}

/** Convert exec error to a user-friendly Error using parseSkillshareError. */
function toSkillshareError(err: unknown): Error {
	if (err && typeof err === "object" && "stderr" in err) {
		const e = err as { stderr?: string; stdout?: string };
		const stderr = typeof e.stderr === "string" ? e.stderr : "";
		const stdout = typeof e.stdout === "string" ? e.stdout : "";
		return new Error(parseSkillshareError(stderr, stdout));
	}
	const message = err instanceof Error ? err.message : String(err);
	return new Error(parseSkillshareError(message, ""));
}

function rethrowExecError(err: unknown): never {
	if (err && typeof err === "object" && "stderr" in err) {
		const e = err as { stderr?: string; stdout?: string };
		const stderr = typeof e.stderr === "string" ? e.stderr : "";
		const stdout = typeof e.stdout === "string" ? e.stdout : "";
		throw new Error(parseSkillshareError(stderr, stdout));
	}
	const message = err instanceof Error ? err.message : String(err);
	throw new Error(`Search failed: ${parseSkillshareError(message, "")}`);
}

function parseSearchOutput(stdout: string): SkillSearchResult[] {
	const trimmed = stdout.trim();
	if (!trimmed) return [];
	const parsed = JSON.parse(trimmed);
	if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.error) {
		throw new Error(parseSkillshareError("", trimmed));
	}
	if (Array.isArray(parsed)) return parsed as SkillSearchResult[];
	return [];
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

function buildSearchArgs(
	query: string,
	limit: number,
	hubMode: SkillshareConfig["hubMode"],
): string[] {
	const safeLimit = String(Math.max(1, Math.min(100, limit)));
	const args = ["search", query, "--json", "--limit", safeLimit];
	if (hubMode === "community-hub") {
		args.push("--hub");
	}
	return args;
}

/** Sync search (no spinner). */
/** Async search (enables spinner in command handler). */
export async function searchSkillsAsync(
	query: string,
	limit: number,
	hubMode: SkillshareConfig["hubMode"],
): Promise<SkillSearchResult[]> {
	return new Promise((resolve, reject) => {
		execFile(
			"skillshare",
			buildSearchArgs(query, limit, hubMode),
			{
				encoding: "utf-8",
				timeout: 30_000,
				maxBuffer: 10 * 1024 * 1024,
			},
			(err, stdout) => {
				if (err) {
					(err as any).stdout = stdout ?? "";
					(err as any).stderr = (err as any).stderr ?? "";
					try {
						rethrowExecError(err);
					} catch (e) {
						reject(e);
					}
				} else {
					try {
						resolve(parseSearchOutput(stdout ?? ""));
					} catch (e) {
						reject(e);
					}
				}
			},
		);
	});
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

export function installSkill(source: string, projectMode: boolean): string {
	const args = ["install", source];
	if (projectMode) args.push("-p");
	else args.push("-g");
	args.push("-y");

	const tryExec = (extraArgs: string[] = []): string => {
		return execFileSync("skillshare", [...args, ...extraArgs], {
			encoding: "utf-8",
			timeout: 120_000,
			maxBuffer: 10 * 1024 * 1024,
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
	};

	try {
		return tryExec();
	} catch (err: unknown) {
		if (err && typeof err === "object" && "stderr" in err) {
			const e = err as { stderr?: string; stdout?: string };
			const stderr = typeof e.stderr === "string" ? e.stderr : "";
			const stdout = typeof e.stdout === "string" ? e.stdout : "";
			const combined = (stderr + "\n" + stdout).toLowerCase();
			if (combined.includes("already exists") || combined.includes("already installed")) {
				throw new Error(
					`"${source}" is already installed. Use --update to refresh, or uninstall first.`,
				);
			}
			if (combined.includes("blocked") || combined.includes("audit")) {
				try {
					return tryExec(["--force"]);
				} catch {
					/* fall through */
				}
			}
			throw new Error(parseSkillshareError(stderr, stdout));
		}
		const message = err instanceof Error ? err.message : String(err);
		throw new Error(parseSkillshareError(message, ""));
	}
}

// ---------------------------------------------------------------------------
// List installed skills
// ---------------------------------------------------------------------------

/** List installed skills by reading the skillshare skills directory. */
export function listInstalledSkills(projectMode: boolean): InstalledSkill[] {
	const baseDir = projectMode
		? (() => {
				const root = getProjectRoot(process.cwd());
				return root ? path.join(root, ".skillshare", "skills") : null;
			})()
		: path.join(os.homedir(), ".config", "skillshare", "skills");

	if (!baseDir || !fs.existsSync(baseDir)) return [];

	try {
		return fs
			.readdirSync(baseDir, { withFileTypes: true })
			.filter((d) => d.isDirectory())
			.map((d) => ({
				name: d.name,
				path: path.join(baseDir, d.name),
			}));
	} catch {
		return [];
	}
}

// ---------------------------------------------------------------------------
// Sync / Update / Uninstall / Doctor
// ---------------------------------------------------------------------------

export function syncSkills(projectMode: boolean): string {
	const args = ["sync"];
	if (projectMode) args.push("-p");
	try {
		return execFileSync("skillshare", args, {
			encoding: "utf-8",
			timeout: 60_000,
			maxBuffer: 10 * 1024 * 1024,
		}).trim();
	} catch (err: unknown) {
		throw toSkillshareError(err);
	}
}

export function updateSkills(projectMode: boolean): string {
	const args = ["update"];
	if (projectMode) args.push("-p");
	try {
		return execFileSync("skillshare", args, {
			encoding: "utf-8",
			timeout: 120_000,
			maxBuffer: 10 * 1024 * 1024,
		}).trim();
	} catch (err: unknown) {
		throw toSkillshareError(err);
	}
}

export function uninstallSkill(name: string, projectMode: boolean): string {
	const args = ["uninstall", name];
	if (projectMode) args.push("-p");
	try {
		return execFileSync("skillshare", args, {
			encoding: "utf-8",
			timeout: 30_000,
			maxBuffer: 10 * 1024 * 1024,
		}).trim();
	} catch (err: unknown) {
		throw toSkillshareError(err);
	}
}

export function checkSkills(projectMode: boolean): CheckOutput {
	const args = ["check", "--json"];
	if (projectMode) args.push("-p");
	try {
		const stdout = execFileSync("skillshare", args, {
			encoding: "utf-8",
			timeout: 30_000,
			maxBuffer: 10 * 1024 * 1024,
		}).trim();
		if (!stdout) return { tracked_repos: [], skills: [] };
		return JSON.parse(stdout) as CheckOutput;
	} catch (err: unknown) {
		throw toSkillshareError(err);
	}
}

export function runDoctor(): string {
	try {
		return execFileSync("skillshare", ["doctor"], {
			encoding: "utf-8",
			timeout: 30_000,
			maxBuffer: 10 * 1024 * 1024,
		}).trim();
	} catch (err: unknown) {
		throw toSkillshareError(err);
	}
}

/** Track the currently running UI process so we can kill it before spawning a new one. */
let uiProcess: ReturnType<typeof spawn> | null = null;

export function openUI(cwd: string): { url: string } {
	// Kill previous instance if still running
	if (uiProcess && !uiProcess.killed) {
		try {
			uiProcess.kill();
		} catch {
			/* process already dead */
		}
	}

	uiProcess = spawn("skillshare", ["ui", "--port", "19420"], {
		cwd,
		detached: true,
		stdio: "ignore",
	});
	uiProcess.unref();

	// Track exit to clean up reference
	uiProcess.on("exit", () => {
		uiProcess = null;
	});

	return { url: "http://127.0.0.1:19420" };
}

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function startSpinner(
	setStatus: (msg: string) => void,
	prefix: string,
): () => void {
	let frame = 0;
	const id = setInterval(() => {
		setStatus(`${SPINNER_FRAMES[frame]} ${prefix}`);
		frame = (frame + 1) % SPINNER_FRAMES.length;
	}, 150);
	setStatus(`${SPINNER_FRAMES[0]} ${prefix}`);
	return () => {
		clearInterval(id);
	};
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatStars(stars: number): string {
	return stars > 0
		? stars >= 1000
			? `${(stars / 1000).toFixed(1)}k`
			: String(stars)
		: "";
}
````

## File: .copier-answers.yml
````yaml
# Changes here will be overwritten by Copier; NEVER EDIT MANUALLY
_commit: 67f0aaf
_src_path: gh:rigerc/repo-3
create_github_repo: false
created_year: '2026'
description: ''
init_agentsmesh: true
init_git: true
init_skillshare: true
init_td: true
initial_commit: true
install_matt_pocock_skills: true
license: MIT
project_name: pi-extensions
project_slug: pi-extensions
search_skills: false
skillshare_targets:
- universal
- claude
- codex
- opencode
- pi
status: active
tags: []
````

## File: .editorconfig
````
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false

[Makefile]
indent_style = tab
````

## File: .eslintrc.json
````json
{
  "env": {
    "node": true,
    "es2022": true
  },
  "extends": [
    "eslint:recommended"
  ],
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module"
  },
  "rules": {}
}
````

## File: .gitattributes
````
# Force LF line endings for all text files regardless of platform.
#
# Without this, Windows checkouts under `core.autocrlf=true` (the default on
# GitHub Actions Windows runners) rewrite text files to CRLF on checkout,
# which breaks `agentsmesh generate --check` whose lock checksums are computed
# over LF-normalized output, and breaks fixture-driven e2e tests that copy
# canonical content into temp dirs and then assert byte-stable artifacts.
#
# `text=auto eol=lf` lets git autodetect text vs binary but normalizes any
# detected text file to LF on checkout AND on commit. Binary files matched
# below are excluded explicitly.

* text=auto eol=lf

# Explicit text categories — guard against autodetection misclassifying.
*.md            text eol=lf
*.mdc           text eol=lf
*.mdx           text eol=lf
*.markdown      text eol=lf
*.json          text eol=lf
*.yaml          text eol=lf
*.yml           text eol=lf
*.toml          text eol=lf
*.ts            text eol=lf
*.tsx           text eol=lf
*.js            text eol=lf
*.jsx           text eol=lf
*.cjs           text eol=lf
*.mjs           text eol=lf
*.sh            text eol=lf
*.css           text eol=lf
*.html          text eol=lf
*.xml           text eol=lf
*.svg           text eol=lf
*.txt           text eol=lf

# Lock and config files.
.gitignore      text eol=lf
.gitattributes  text eol=lf
.editorconfig   text eol=lf
LICENSE         text eol=lf

# Binary files — never normalize.
*.png           binary
*.jpg           binary
*.jpeg          binary
*.gif           binary
*.ico           binary
*.webp          binary
*.pdf           binary
*.zip           binary
*.tgz           binary
*.tar           binary
*.tar.gz        binary
*.gz            binary
*.woff          binary
*.woff2         binary
*.ttf           binary
*.eot           binary

# Generated lock files keep LF so checksums are reproducible across platforms.
pnpm-lock.yaml  text eol=lf
package-lock.json text eol=lf
.agentsmesh/.lock text eol=lf

.claude/CLAUDE.md linguist-generated=true
.claude/commands/**/*.md linguist-generated=true
.cursor/rules/**/*.mdc linguist-generated=true
.github/copilot-instructions.md linguist-generated=true
.gemini/rules/**/*.md linguist-generated=true
CLAUDE.md linguist-generated=true
AGENTS.md linguist-generated=true
CONTEXT.md linguist-generated=true
.agents/**/*.md linguist-generated=true
.codex/**/*.md linguist-generated=true
````

## File: .ignore
````
# mkproject: this prevents Copier from rendering the docs/ directory from
# the template. Projects manage their own docs separately.
!docs/
````

## File: .prettierrc
````
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
````

## File: .project.json
````json
{"context":[{"repo":"runkids/skillshare","name":"skillshare","last_sync":"2026-05-09T14:51:02Z","last_tree_sha":"d8007dd7508b3da37e09838e9b6fc9eb7ee7eef2"}]}
````

## File: AGENTS.md
````markdown
<!-- agentsmesh:codex-rule-index:start -->
## Additional Rule Files
- [Project conventions](.codex/instructions/common.md): General guidance with no file glob restriction.
<!-- agentsmesh:codex-rule-index:end -->

<!-- agentsmesh:root-generation-contract:start -->
## AgentsMesh Generation Contract

`agentsmesh.yaml` selects targets/features (`agentsmesh.local.yaml` overrides locally), and `.agentsmesh` is the only place to add or edit canonical items: `rules/_root.md`, `rules/*.md`, `commands/*.md`, `agents/*.md`, `skills/*/SKILL.md` plus supporting files, `mcp.json`, `hooks.yaml`, `permissions.yaml`, and `ignore`; if missing run `agentsmesh init`, use `agentsmesh import --from <tool>` for native configs, `agentsmesh install <source>` or `install --sync` for reusable packs, then run `agentsmesh generate`. Use `diff`, `lint`, `check`, `watch`, `matrix`, and `merge` as needed; never edit generated tool files.
<!-- agentsmesh:root-generation-contract:end -->
````

## File: agentsmesh.yaml
````yaml
# yaml-language-server: $schema=https://unpkg.com/agentsmesh/schemas/agentsmesh.json
version: 1
targets:
  - codex-cli
  - claude-code
  - opencode
features:
  - rules
  - commands
  - agents
  - mcp
  - hooks
  - ignore
  - permissions
````

## File: CHANGELOG.md
````markdown
# Changelog

## [0.1.2](https://github.com/rigerc/pi-skillshare/compare/pi-skillshare-v0.1.1...pi-skillshare-v0.1.2) (2026-05-09)


### Bug Fixes

* 🐛 npm flow ([58d123b](https://github.com/rigerc/pi-skillshare/commit/58d123bc6736a4a283e2397dba23531b8c9201b2))

## [0.1.1](https://github.com/rigerc/pi-skillshare/compare/pi-skillshare-v0.1.0...pi-skillshare-v0.1.1) (2026-05-09)


### Features

* 💡 set up release automation with release-please ([78880c0](https://github.com/rigerc/pi-skillshare/commit/78880c0171903dc0f873af7d73db917cc2a4c712))

## Changelog

All notable changes to **pi-skillshare** are documented here.
````

## File: Taskfile.yml
````yaml
version: '3'
tasks:
    _run:
        internal: true
        requires:
            vars: [APP, COMMAND]
        cmds:
            - task: _global:pre
              vars: {APP: '{{.APP}}'}
            - task: _app:pre
              vars: {APP: '{{.APP}}'}
            - defer:
                task: _app:post
                vars: {APP: '{{.APP}}'}
            - defer:
                task: _global:post
                vars: {APP: '{{.APP}}'}
            - '{{.COMMAND}}'
    _app:pre:
        internal: true
        requires:
            vars: [APP]
        cmds:
            - task: _{{.APP}}:pre
    _app:post:
        internal: true
        requires:
            vars: [APP]
        cmds:
            - task: _{{.APP}}:post
    _global:pre:
        internal: true
        requires:
            vars: [APP]
        cmds:
            - 'skillshare update -p && skillshare sync -p'
    _global:post:
        internal: true
        requires:
            vars: [APP]
        cmds:
            - ':'
    pi:
        desc: Run pi with global and pi-specific hooks
        cmds:
            - task: _run
              vars:
                APP: pi
                COMMAND: 'pi {{.CLI_ARGS}}'
    _pi:pre:
        internal: true
        cmds:
            - ':'
    _pi:post:
        internal: true
        cmds:
            - ':'
    codex:
        desc: Run codex with global and codex-specific hooks
        cmds:
            - task: _run
              vars:
                APP: codex
                COMMAND: 'codex {{.CLI_ARGS}}'
    _codex:pre:
        internal: true
        cmds:
            - ':'
    _codex:post:
        internal: true
        cmds:
            - ':'
    claude:
        desc: Run claude with global and claude-specific hooks
        cmds:
            - task: _run
              vars:
                APP: claude
                COMMAND: 'claude {{.CLI_ARGS}}'
    _claude:pre:
        internal: true
        cmds:
            - ':'
    _claude:post:
        internal: true
        cmds:
            - ':'
    opencode:
        desc: Run opencode with global and opencode-specific hooks
        cmds:
            - task: _run
              vars:
                APP: opencode
                COMMAND: 'opencode {{.CLI_ARGS}}'
    _opencode:pre:
        internal: true
        cmds:
            - ':'
    _opencode:post:
        internal: true
        cmds:
            - ':'
````

## File: vitest.config.ts
````typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.{ts,js}'],
    gitignore: true,
  },
});
````

## File: .agentsmesh/.lock
````
# Auto-generated. DO NOT EDIT MANUALLY.
# Tracks the state of all config files for team conflict resolution.

generated_at: 2026-05-09T19:31:23.610Z
generated_by: bond
lib_version: 0.16.0
checksums:
  agents/_example.md: sha256:335780c653c0deb6db2971d8a9e2a25beca8ab467442ca7c0be70e48ad6d543c
  commands/_example.md: sha256:8eb175f909f6acc109f5b4c47286393b945422f0c256bfde8af2d536d600577e
  commands/init-rules.md: sha256:2a27e6c9e542a0b4b970146831821379bf66490a42cdb78c54251f18524b8f20
  commands/plan-task.md: sha256:7a48145a8bb06d370cc4a5b0956db24b213a3b2c02406de50f260abbf6ac1f7e
  commands/skillshare-recommend.md: sha256:aafc1fc3becdba218b99d892e6a0aa769ea4483c7159d12eac167f93bb6d2e57
  hooks.yaml: sha256:e6172228d1a35367871a5be05ada33e5c7e07a9f6ecae4108fedaaec1989be1a
  ignore: sha256:b71641360cf120445e4b90844b4130053c68d55ead2cf7164f63c7208c1bcc02
  mcp.json: sha256:10dfe9acafeeeeb59377c828246a1f6824fb9a359ea6f32ded48faddf4f6cd3d
  permissions.yaml: sha256:928e45ce5b43ca076ba2ad8d2884a676fa244d47dc85a801f0acb92c2f1fab13
  rules/_example.md: sha256:3aed4a8359f650ceed854ce037489ba60bfaf245f46df11b164e9d6dd5f29b42
  rules/_root.md: sha256:d20b1f94a0cb5f2ad5a58bc2c06df2740fb35db5cff02f508d61f3991b524f17
  rules/common.md: sha256:c781f3bdbb8a11339a044bf604901a2e6fd55c69f25a6aa0b6b507c219bbd0ac
extends: {}
packs: {}
````

## File: .github/release-please-config.json
````json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "release-type": "node",
  "baseBranch": "master",
  "packages": {
    ".": {
      "release-type": "node",
      "changelog-path": "CHANGELOG.md",
      "include-v-in-tag": true
    }
  },
  "bump-minor-pre-major": true,
  "bump-patch-for-minor-pre-major": true,
  "changelog-sections": [
    { "type": "feat", "section": "Features" },
    { "type": "fix", "section": "Bug Fixes" },
    { "type": "perf", "section": "Performance Improvements" },
    { "type": "revert", "section": "Reverts" },
    { "type": "docs", "section": "Documentation", "hidden": true },
    { "type": "style", "section": "Styles", "hidden": true },
    { "type": "chore", "section": "Miscellaneous Chores", "hidden": true },
    { "type": "refactor", "section": "Code Refactoring", "hidden": true },
    { "type": "test", "section": "Tests", "hidden": true },
    { "type": "build", "section": "Build System", "hidden": true },
    { "type": "ci", "section": "Continuous Integration", "hidden": true }
  ]
}
````

## File: .skillshare/.gitignore
````
# BEGIN SKILLSHARE MANAGED - DO NOT EDIT
logs/
trash/
skills/td-task-management/
skills/grill-me/
skills/grill-with-docs/
skills/improve-codebase-architecture/
skills/setup-matt-pocock-skills/
skills/to-issues/
skills/to-prd/
skills/triage/
skills/write-a-skill/
skills/zoom-out/
skills/skill/
skills/verify/
skills/publish-npm-package/
skills/release-please-development/
# END SKILLSHARE MANAGED
````

## File: .skillshare/config.yaml
````yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/runkids/skillshare/main/schemas/project-config.schema.json
targets:
  - name: universal
    skills:
      mode: copy
  - name: claude
    skills:
      mode: copy
  - name: codex
    skills:
      mode: copy
  - name: opencode
    skills:
      mode: copy
audit:
  block_threshold: CRITICAL
````

## File: package.json
````json
{
  "name": "pi-skillshare",
  "version": "0.1.2",
  "description": "Search, install, and manage skillshare AI agent skills from within Pi",
  "keywords": [
    "pi-package"
  ],
  "repository": {
    "type": "git",
    "url": "git+https://github.com/rigerc/pi-skillshare.git"
  },
  "files": [
    "src/",
    "CHANGELOG.md",
    "README.md"
  ],
  "license": "MIT",
  "type": "module",
  "scripts": {
    "format": "prettier --write .",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "pi": {
    "extensions": [
      "./src"
    ]
  },
  "peerDependencies": {
    "@earendil-works/pi-coding-agent": "*",
    "@earendil-works/pi-tui": "*"
  },
  "devDependencies": {
    "eslint": "^10.3.0",
    "prettier": "^3.8.3",
    "vitest": "^4.1.5"
  }
}
````

## File: .agentsmesh/hooks.yaml
````yaml
# Lifecycle hooks — run shell commands before/after AI tool use
# Events: PreToolUse, PostToolUse, SubagentStart, SubagentStop
# Matcher: tool name pattern (e.g. "Edit|Write", "Bash", "*")
#
# PreToolUse:
#   - matcher: Edit|Write
#     type: command
#     command: npm run lint --fix
#
# PostToolUse:
#   - matcher: Edit|Write
#     type: command
#     command: npm test --passWithNoTests
````

## File: .github/workflows/publish-manual.yml
````yaml
name: Publish Manually

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to publish (e.g., 0.2.0). Also bumps package.json.'
        required: true

concurrency:
  group: pi-skillshare-manual-publish
  cancel-in-progress: false

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v6

      - uses: actions/setup-node@v6
        with:
          node-version: '24'
          registry-url: https://registry.npmjs.org
          package-manager-cache: false

      - name: Install dependencies
        run: npm ci

      - name: Bump version
        run: npm version ${{ github.event.inputs.version }} --no-git-tag-version

      - name: Validate package contents
        run: npm pack --dry-run

      - name: Publish to npm
        run: npm publish --access public

      - name: Verify signatures
        run: npm audit signatures
````

## File: .github/release-please-manifest.json
````json
{
  ".": "0.1.2"
}
````

## File: .skillshare/skills/.metadata.json
````json
{
  "version": 1,
  "entries": {
    "grill-me": {
      "source": "github.com/mattpocock/skills/skills/productivity/grill-me",
      "type": "github-subdir",
      "installed_at": "2026-05-09T16:48:40.777340985+02:00",
      "repo_url": "https://github.com/mattpocock/skills.git",
      "subdir": "skills/productivity/grill-me",
      "version": "733d312",
      "tree_hash": "2a1ad17028306ebe45f0e49703fa28b9b2e7f499",
      "file_hashes": {
        "SKILL.md": "sha256:74147eb6010a65957efef2b9e0f0b3ff935c1def7fc117697151b1d0f3610556"
      }
    },
    "grill-with-docs": {
      "source": "github.com/mattpocock/skills/skills/engineering/grill-with-docs",
      "type": "github-subdir",
      "installed_at": "2026-05-09T16:48:40.800760458+02:00",
      "repo_url": "https://github.com/mattpocock/skills.git",
      "subdir": "skills/engineering/grill-with-docs",
      "version": "733d312",
      "tree_hash": "2969a1224c70fe41b9dd2ddbe32c2ec62f2815bd",
      "file_hashes": {
        "ADR-FORMAT.md": "sha256:f1f36cd3f8d3b6474ddd5855da4e233bfc4ae1a1c5024909ccf11871819a41b2",
        "CONTEXT-FORMAT.md": "sha256:8f6baaa3b1c91644bd7c600196b1aee781d5f525c7c345db8cdfbfb368329a05",
        "SKILL.md": "sha256:c7176600a8bffc9f359102cb041b6686387618b8e1434ba484dd708d45df6d5e"
      }
    },
    "improve-codebase-architecture": {
      "source": "github.com/mattpocock/skills/skills/engineering/improve-codebase-architecture",
      "type": "github-subdir",
      "installed_at": "2026-05-09T16:48:40.827679262+02:00",
      "repo_url": "https://github.com/mattpocock/skills.git",
      "subdir": "skills/engineering/improve-codebase-architecture",
      "version": "733d312",
      "tree_hash": "3ad8fa787b3b9b622d1f5a3d0afc27812ac782fa",
      "file_hashes": {
        "DEEPENING.md": "sha256:9577485f4fc32c0267639a9151bb41c8af0f8f6086e4bf8b84d5b236e30604e9",
        "INTERFACE-DESIGN.md": "sha256:678c3e34f1339015053212b3316bf0b676c70aa251050a0613667d4e755fb35e",
        "LANGUAGE.md": "sha256:6feca2140439c54a774749e8367f18350899ff69c777144ed2248cd4407949fa",
        "SKILL.md": "sha256:9e9b617b1c70d390e37dbfd1c031c11b3de850e2e3d01c4a2c2888bdb386a247"
      }
    },
    "publish-npm-package": {
      "source": "github.com/yigitkonur/skills-by-yigitkonur/skills/publish-npm-package/skills/publish-npm-package",
      "type": "github-subdir",
      "installed_at": "2026-05-09T18:45:21.516858526+02:00",
      "repo_url": "https://github.com/yigitkonur/skills-by-yigitkonur.git",
      "subdir": "skills/publish-npm-package/skills/publish-npm-package",
      "version": "8454ef6",
      "tree_hash": "1754e6661183ce1ea72e83a9d07aaa19e690ba30",
      "file_hashes": {
        "SKILL.md": "sha256:87ac35511660dff0e3cd0672548e97ddb922976cc18e8684b43e65e28c16171f",
        "references/auth/granular-tokens.md": "sha256:5229670beba112c4a27bf14d66d69c00a633be5b58ff01793bffdfbbdcd44263",
        "references/auth/oidc-trusted-publishing.md": "sha256:d42513bc6cbe54832499350995519dd13ac6585536319ba1b26ff9c1b54b1f52",
        "references/common-issues.md": "sha256:9fad437d81c8f6d562c09dd79cf6bb0d13fc535a4e76b9e05474c736f942135a",
        "references/monorepo-publishing.md": "sha256:33f76b04c044514fec2e160699bf01c5c7b3d60e98f5e1dc739292be3e892c11",
        "references/package-config.md": "sha256:9d5de7dae31b582bff9cb68b819bce38987d49a423d2d0c6a88f4ba89026b919",
        "references/supply-chain.md": "sha256:3d8ae4e15619b54184a1e913e41b9e63b68c7eecad61fa916aed0e3a95790a48",
        "references/versioning/changesets.md": "sha256:8be63652af89e19fbacc17883d2a92ce22ef4704052f0d70b6d8751098c5eaee",
        "references/versioning/release-please.md": "sha256:9984c88d0ea87b601e2d16a16a6d264c48b15066d844c73cda1b3d86bbcef80d",
        "references/versioning/semantic-release.md": "sha256:a6fda921c539737d122998ea64db2968486af9bfe6f96c5f90c2870f3559df2d",
        "references/workflows/oidc-workflows.md": "sha256:eeaac54111ca857a5f319790f30d3f96eb85ed4af215d7ce6e3acd294b93ce5d",
        "references/workflows/token-workflows.md": "sha256:af767084da661d28987130e485e3894f7ae35d10f3c4975e88b7f309cd80f574",
        "scripts/check-npm-auth.md": "sha256:9c4881683d1e8bc547385aa8827c050145908cf82d2096da9a6925c968d0d6fb",
        "scripts/check-npm-auth.sh": "sha256:e7e573e2c09d4f7c0fbd8073f82369f10261a45cdda02bcc8879f6eeba46e6f7",
        "scripts/check-package-json.md": "sha256:f16adfd29ff587ad62fefc33368482d012591966c82af31791d4a95ee153dc2f",
        "scripts/check-package-json.mjs": "sha256:47ed34aa39f8015b4b47f2cc1e6e36389bd048822a0e96131843cecfa77d669d",
        "scripts/dry-run-publish.md": "sha256:bc8d7f0ec2ef5b7470da11a8c7aac6aae592f28533f020c7f4298a99ce505620",
        "scripts/dry-run-publish.sh": "sha256:93851c133a3ac269f739c40d31f8969490e131f57bcf7a8101038bb10af6c711"
      }
    },
    "release-please-development": {
      "source": "github.com/majiayu000/claude-skill-registry/skills/other/release-please-development",
      "type": "github-subdir",
      "installed_at": "2026-05-09T18:52:12.93208464+02:00",
      "repo_url": "https://github.com/majiayu000/claude-skill-registry.git",
      "subdir": "skills/other/release-please-development",
      "version": "fc98f4ec9",
      "tree_hash": "ac09c8db8f28406967abd542a07d02cbc8d3f70a",
      "file_hashes": {
        "SKILL.md": "sha256:05eff4956edcd032df7e61304f2d6c4a9a71512892431ba6a0493695cf290073",
        "metadata.json": "sha256:98b687998bfa0f81680b355469dddbc4d0c589a0a7d46d6267994eff9b973f39"
      }
    },
    "setup-matt-pocock-skills": {
      "source": "github.com/mattpocock/skills/skills/engineering/setup-matt-pocock-skills",
      "type": "github-subdir",
      "installed_at": "2026-05-09T16:48:40.855940056+02:00",
      "repo_url": "https://github.com/mattpocock/skills.git",
      "subdir": "skills/engineering/setup-matt-pocock-skills",
      "version": "733d312",
      "tree_hash": "77638955bebe492948244f1338e54ca1a9445c29",
      "file_hashes": {
        "SKILL.md": "sha256:c778d4e3d86ecc9125c357279a86780657b5db23110e1f7acf4f46d2441e7204",
        "domain.md": "sha256:a8cc3d1c11c9cdea455f39c4090cf61ac273f2474dd6f229ab0c2b9b1deec759",
        "issue-tracker-github.md": "sha256:f0e138631d1fc8aedc9e05d25bc688b97679f81eae7a7c760dd35e0790568370",
        "issue-tracker-gitlab.md": "sha256:94c574647c4755f2a807742f5e78e7cef586c100266d54501d0e55445c1b1807",
        "issue-tracker-local.md": "sha256:9a052f4599525e581721ec24cb2ae3e0296b79053e39f684b540d34d3a4f6528",
        "triage-labels.md": "sha256:4f53c9b40ce2651e3611aa090eaedbd6dbc9b71ef8c5f7e65eac0d8263190d0d"
      }
    },
    "td-task-management": {
      "source": "github.com/marcus/td/td-task-management",
      "type": "github-subdir",
      "installed_at": "2026-05-09T16:48:38.3733407+02:00",
      "repo_url": "https://github.com/marcus/td.git",
      "subdir": "td-task-management",
      "version": "16c2b4d",
      "tree_hash": "da611430295ea46ad41c225522352deea0ad646e",
      "file_hashes": {
        "SKILL.md": "sha256:20cd289d3210ad8857f6605bf21dafc64f60c3f3265e9ac5fc1075f71eef6719",
        "references/ai_agent_workflows.md": "sha256:bfe8322a60485d56bb11c7db5a4b85d89169f4b6aaf514997b385d2fa64f87bc",
        "references/quick_reference.md": "sha256:8916442063a800b49a324f591429b99689d31c89a7b2a1e83577153b8a474af1"
      }
    },
    "to-issues": {
      "source": "github.com/mattpocock/skills/skills/engineering/to-issues",
      "type": "github-subdir",
      "installed_at": "2026-05-09T16:48:40.868772246+02:00",
      "repo_url": "https://github.com/mattpocock/skills.git",
      "subdir": "skills/engineering/to-issues",
      "version": "733d312",
      "tree_hash": "b38c5aa6ae5d6903e60d3f74a7aafd32d02f2c06",
      "file_hashes": {
        "SKILL.md": "sha256:0e6a2973fa5bdf32570227c578f7e474d945dd9281615d31439664c3ef016fce"
      }
    },
    "to-prd": {
      "source": "github.com/mattpocock/skills/skills/engineering/to-prd",
      "type": "github-subdir",
      "installed_at": "2026-05-09T16:48:40.881430666+02:00",
      "repo_url": "https://github.com/mattpocock/skills.git",
      "subdir": "skills/engineering/to-prd",
      "version": "733d312",
      "tree_hash": "d6eff3e99a325d2d9c2acbe31b4d76fa5340a154",
      "file_hashes": {
        "SKILL.md": "sha256:b60e3805e361e4eabc6f3df48d305299e0fde64cb24b6e95443c01de907a2e7d"
      }
    },
    "triage": {
      "source": "github.com/mattpocock/skills/skills/engineering/triage",
      "type": "github-subdir",
      "installed_at": "2026-05-09T16:48:40.909519133+02:00",
      "repo_url": "https://github.com/mattpocock/skills.git",
      "subdir": "skills/engineering/triage",
      "version": "733d312",
      "tree_hash": "de4f182c30876a2460ca307e2f601b9b892527e5",
      "file_hashes": {
        "AGENT-BRIEF.md": "sha256:1c71c747aa97d938f75ec7a4b8fe87451763b38a3ce6348acf2b222e5819b2e5",
        "OUT-OF-SCOPE.md": "sha256:8ed8cf27833444060c81b3961a83c0e3d8e6cf2fcb2ddf6f8b07c6655cbb0d85",
        "SKILL.md": "sha256:b819f0285e4e5814ac6472d0217f07dc9f23d2fdae3ebb0dd31d98360d8ac029"
      }
    },
    "verify": {
      "source": "github.com/facebook/react/.claude/skills/verify",
      "type": "github-subdir",
      "installed_at": "2026-05-09T17:36:02.927155266+02:00",
      "repo_url": "https://github.com/facebook/react.git",
      "subdir": ".claude/skills/verify",
      "version": "d5736f0",
      "tree_hash": "34f69a61c3ad7a4473c46238b8e3a3516a0bfd02",
      "file_hashes": {
        "SKILL.md": "sha256:070d8a87c34b661d98c7b8d72b4443706c4f78386647b115476d34121e70d0be"
      }
    },
    "write-a-skill": {
      "source": "github.com/mattpocock/skills/skills/productivity/write-a-skill",
      "type": "github-subdir",
      "installed_at": "2026-05-09T16:48:40.923469227+02:00",
      "repo_url": "https://github.com/mattpocock/skills.git",
      "subdir": "skills/productivity/write-a-skill",
      "version": "733d312",
      "tree_hash": "2f252b35aa238879afc5a230ac30343708dee0b3",
      "file_hashes": {
        "SKILL.md": "sha256:be8f20e66309258034b82a7db5040b03798aa40546f9d387662c2bd86be23123"
      }
    },
    "zoom-out": {
      "source": "github.com/mattpocock/skills/skills/engineering/zoom-out",
      "type": "github-subdir",
      "installed_at": "2026-05-09T16:48:40.93241483+02:00",
      "repo_url": "https://github.com/mattpocock/skills.git",
      "subdir": "skills/engineering/zoom-out",
      "version": "733d312",
      "tree_hash": "6ecebabdea814d12888f56a611da7bf182b5fb26",
      "file_hashes": {
        "SKILL.md": "sha256:2a6894c7f9b1c9c55f451c625a834c4f377e217b623a85280e55db5fe9cacf48"
      }
    }
  }
}
````

## File: .gitignore
````
# mkproject: these patterns mirror the _exclude list in copier.yml so
# Copier never renders them. This .gitignore catches anything that
# gets created post-generation by tools like td/skillshare/agentsmesh.

# env
.env
.envrc
.mcp.json
mcp.json
.agentsmesh/mcp.json
node_modules
tests

# docs, contex
docs/

.projscanrc.json
.projscan-cache
.projscan-memory
# agents
agentsmesh.local.yaml
.agentsmeshcache
.agentsmesh/.lock.tmp
.agentsmesh/packs/
./.agents/
!/.agents/skills/*
.pi/skills/*
/skills
.mux/
.claude/
.codex/
.opencode/
skills-lock.json
opencode.json
opencode.jsonc
CLAUDE.md

# todos
./.todos/
copier/
````

## File: README.md
````markdown
# pi-skillshare

> Search, install, and manage [skillshare](https://github.com/runkids/skillshare) AI agent skills — all from inside Pi.

## Requirements

- [Pi](https://earendil-works.github.io/pi/) (the coding agent harness this extension runs in)
- [skillshare CLI](https://github.com/runkids/skillshare) — `skillshare --version` must be on `PATH`

## Install

```bash
pi install npm:@rigerc/pi-skillshare
```

To develop locally, clone this repo, then:

```bash
pi install ./pi-skillshare
/reload
```

## Commands

| Command | Description |
|---------|-------------|
| `/skillshare [query]` | Tabbed TUI: search, installed skills, and status |
| `/skillshare-settings` | Configure defaults (hub mode, install target, check scope, search limit) |
| `/skillshare-sync [-p \| -g]` | Sync installed skills to configured targets |
| `/skillshare-update [-p \| -g]` | Check for updates, confirm, then apply them |
| `/skillshare-ui` | Launch the skillshare web UI in a browser |

### Scope flags (`-p` / `-g`)

`/skillshare-update` and `/skillshare-sync` accept `-p` (project) or `-g` (global) to override which scope they target. When omitted they fall back to the **Check/update scope** setting.

## `/skillshare` — Tabbed TUI

| Tab | Content |
|-----|---------|
| **Search** | Enter a query → multi-select results → install. Enter confirms, Space toggles. |
| **Installed** | Lists installed skills from `.skillshare/skills/` or `~/.config/skillshare/skills/`. `u` uninstalls, `U` updates all, `r` refreshes. |
| **Status** | Shows skill count, install mode, search source. `s` sync, `u` update, `d` doctor. |

### Key bindings

| Key | Action |
|-----|--------|
| `↑` / `↓` or `k` / `j` | Navigate lists |
| `←` / `→` or `Tab` / `Shift+Tab` | Switch tabs |
| `Space` | Toggle checkbox (search) / change value (settings) |
| `Enter` | Confirm selection / install |
| `Esc` or `Ctrl+C` | Close panel |

## `/skillshare-update` flow

1. **Check** — runs `skillshare check --json` to find outdated skills and repos
2. **Summary** — shows what needs updating (skills, tracked repos, stale skills)
3. **Confirm** — asks "Apply all updates now?" before touching anything
4. **Update** — runs `skillshare update` only if confirmed

## `/skillshare-settings`

| Setting | Values | Default | Effect |
|---------|--------|---------|--------|
| Search source | GitHub search / Community hub | GitHub search | Switches between `--hub` and direct GitHub search |
| Install target | Global / Project | Project | Where `skillshare install` puts new skills |
| Check/update scope | Global / Project | Project | Scope for `check`, `update`, and `sync` |
| Search result limit | 10 / 20 / 30 / 50 | 20 | Max results per search query |

All settings persist across sessions via `pi.appendEntry`.

## File structure

```
pi-skillshare/
├── package.json          # Pi package manifest
├── README.md             # This file
├── .gitignore
└── src/
    ├── index.ts          # Entry point — registers commands
    ├── panels.ts         # TUI components — TabBar, SearchPanel, InstalledPanel, StatusPanel, SettingsPanel
    └── utils.ts          # Shared helpers — CLI wrappers, error parsing, spinner, formatting
```

## Development

```bash
# Edit files in pi-skillshare/src/
pi install ./pi-skillshare
/reload
```

The extension uses the [Pi TUI](https://earendil-works.github.io/pi/docs/tui) for its interactive components.

## License

MIT
````

## File: .github/workflows/release.yml
````yaml
name: Release

on:
  push:
    branches: [master]
  workflow_dispatch:

concurrency:
  group: pi-skillshare-release
  cancel-in-progress: false

jobs:
  release-please:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    outputs:
      release_created: ${{ steps.rp.outputs.release_created }}
      tag_name: ${{ steps.rp.outputs.tag_name }}
    steps:
      - id: rp
        uses: googleapis/release-please-action@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          config-file: .github/release-please-config.json
          manifest-file: .github/release-please-manifest.json

  publish:
    needs: release-please
    if: needs.release-please.outputs.release_created == 'true'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v6

      - uses: actions/setup-node@v6
        with:
          node-version: '24'
          registry-url: https://registry.npmjs.org
          package-manager-cache: false

      - name: Install dependencies
        run: npm ci

      - name: Validate package contents
        run: npm pack --dry-run

      - name: Publish to npm
        run: npm publish --access public

      - name: Verify signatures
        run: npm audit signatures
````