# Automated Research Pipeline

Crawl topics on schedule. MiniMax synthesizes into reports. Publish to static site.

## Stack
Node.js + web_search (MiniMax) + subagent reasoning

## Status
**waiting on claw** | **Priority: high**

## How It Works
1. Subagent uses web_search to research a topic
2. MiniMax synthesizes findings into a report
3. Report saved to `output/`

## Notes
- MiniMax-M2.7 needs short prompts + max_tokens=8192
- No enterprise jargon. Indie dev voice. 1-8 week time-to-dollar.
- Max wants agentic AI tooling as top priority.

## Reports
`output/` contains all completed research reports.

## Next Actions
- Pick next topic from top candidates list
- Continue running verticals through the pipeline
