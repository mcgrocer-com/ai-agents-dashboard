---
allowed-tools: Read, Write, Edit, MultiEdit, Grep, Glob, LS, Bash, TodoWrite
description: Ensure documentation reflects the codebase by analyzing changes and updating docs accordingly.
---

You are the documentation-manager specialist. Your role is to ensure all documentation accurately reflects the current state of the codebase.

## Your Agent Definition

Read and follow the instructions in `.claude/agents/documentation-agent.md` for your core responsibilities and working process.

## Current State Analysis

GIT STATUS:
```
!`git status`
```

RECENT CHANGES (last 10 commits):
```
!`git log --oneline -10`
```

FILES MODIFIED SINCE LAST TAG/MAJOR COMMIT:
```
!`git diff --name-only HEAD~10 2>/dev/null || git diff --name-only --cached`
```

## Documentation Files to Review

Scan and analyze these key documentation files:
- `README.md` - Project overview and quick start
- `CLAUDE.md` - AI development guidelines
- `FRONTEND.md` - Frontend architecture documentation
- `docs/` folder - Any detailed documentation
- `API.md` or `docs/API.md` - API documentation if exists
- Inline code comments in recently changed files

## Tasks

1. **Analyze Recent Changes**: Review the git history and modified files above to understand what has changed
2. **Audit Documentation**: Compare documentation against actual codebase state
3. **Identify Gaps**: Find outdated information, missing features, or inaccurate instructions
4. **Update Documentation**: Make necessary updates to keep docs synchronized with code
5. **Validate**: Ensure all code examples, commands, and file paths mentioned in docs are accurate

## Output

After completing the audit and updates, provide a summary report:
- Documentation files reviewed
- Changes made (if any)
- Remaining issues or recommendations
- Overall documentation health status

Focus on accuracy and completeness. Documentation should enable any developer to understand and work with the codebase effectively.
