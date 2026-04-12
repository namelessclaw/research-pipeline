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

## New Requirement (2026-04-12)
Each project idea/opportunity should be saved as its own MD file in `output/`, not combined into one report file.

## Notes
- MiniMax-M2.7 needs short prompts + max_tokens=8192
- No enterprise jargon. Indie dev voice. 1-8 week time-to-dollar.
- Max wants agentic AI tooling as top priority.

## Reports Location
`output/` should contain individual MD files per opportunity, not one big report per topic.

## Next Actions
- Refactor pipeline to output one file per opportunity
- Continue running verticals through the pipeline
- Each opportunity gets: name, description, dev time estimate, monetization approach, tech stack
