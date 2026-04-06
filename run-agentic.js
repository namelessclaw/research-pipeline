#!/usr/bin/env node
/**
 * Research pipeline — Passive Income Opportunities vertical
 * Burns MiniMax credits via web search + LLM synthesis.
 * Output: concrete, surprising income/project ideas with specific why-this-works reasoning.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Config ---
const VERTICAL_LABEL = 'Agentic Workflows & AI Automation Opportunities 2026';
const OUT_DIR = path.resolve(__dirname, 'output');

// Web search queries targeting agentic workflow opportunities
const SEARCHES = [
  'agentic AI workflows automation tools 2026',
  'AI agent orchestration platforms opportunities 2026',
  'autonomous AI agents business applications 2026',
  'AI multi-agent systems enterprise use cases 2026',
  'no-code AI workflow automation platforms 2026',
  'AI agents replacing traditional software workflows 2026',
  'autonomous agents SaaS business model 2026',
  'AI agent API platforms developer tools 2026',
];

// --- MiniMax API ---
async function getApiKey() {
  const envPath = path.resolve(__dirname, '../../.env');
  try {
    const content = await fs.readFile(envPath, 'utf-8');
    const match = content.match(/MINIMAX_API_KEY\s*=\s*(.+)/);
    return match ? match[1].trim() : null;
  } catch {
    return process.env.MINIMAX_API_KEY || null;
  }
}

async function synthesizeWithMiniMax(articles) {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error('MINIMAX_API_KEY not found');

  const articleList = articles
    .map((a, i) => `${i + 1}. ${a.title}: ${a.snippet}`)
    .join('\n');

  const prompt = `You are a startup scout writing for ONE specific reader: a solo indie developer with limited time, no sales team, and no budget for enterprise software. No MBA jargon. No six-figure consulting deals. No enterprise sales cycles.

SOURCES:
${articleList}

TASK: Write a concise markdown report that:
1. Names the single most compelling agentic AI opportunity for a solo indie dev right now (1 sentence — specific, surprising, under-the-radar)
2. Lists exactly 3 concrete opportunities, each with:
   - What it is (specific — what you'd actually build)
   - Why it works (the actual mechanism — why someone pays)
   - Estimated time to first dollar (realistic for solo dev, nights/weekends)
   - Key risk or bottleneck (real one, not generic "need users")
3. Closes with 1 sentence on the single most important agentic AI trend for indie devs in 2026

Rules: Plain English. No "leverage", no "synergy". If a normal person wouldn't say it, don't write it. Output markdown only.`;

  const response = await fetch('https://api.minimax.io/anthropic/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'MiniMax-M2.7',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 8192,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`MiniMax API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const textItem = data.content?.find((c) => c.type === 'text');
  if (!textItem) throw new Error(`No text in response: ${JSON.stringify(data.content)}`);
  return textItem.text;
}

// --- Web Search via openclaw agent run --local ---
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runWebSearch(query) {
  return new Promise((resolve, reject) => {
    const message = `Search the web for: "${query}"\n\nReturn the top 5 results with title, URL, and a 2-sentence snippet of what each result is about. Format as:\n1. [Title] - [URL] - [2-sentence snippet]\n\nBe concise. Output only the formatted results, no preamble.`;
    
    const sessionId = `research-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const proc = spawn('openclaw', ['agent', '--local', '--session-id', sessionId, '-m', message, '--timeout', '60'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 90000,
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code !== 0 && code !== null) console.warn('⚠️ search exit:', code, stderr.slice(-200));
      resolve(stdout.trim());
    });
    proc.on('error', reject);
  });
}

// --- Main ---
async function main() {
  console.log(`🔍 Researching: ${VERTICAL_LABEL}\n`);
  const allResults = [];

  for (let i = 0; i < SEARCHES.length; i++) {
    const q = SEARCHES[i];
    console.log(`[${i + 1}/${SEARCHES.length}] Searching: "${q}"`);
    try {
      const result = await runWebSearch(q);
      console.log(`  → Got ${result.length} chars`);
      if (result.length > 30) {
        allResults.push({ title: q, snippet: result.slice(0, 500) });
      }
    } catch (err) {
      console.warn(`  ⚠️ Search failed: ${err.message}`);
    }
    await sleep(2500);
  }

  // Deduplicate + clean
  const seen = new Set();
  const unique = allResults.filter((a) => {
    if (seen.has(a.title)) return false;
    seen.add(a.title);
    return a.snippet.length > 50;
  });

  console.log(`\n🤖 Synthesizing from ${unique.length} search queries...`);
  const report = await synthesizeWithMiniMax(unique);

  // Save
  await fs.mkdir(OUT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().slice(0, 10);
  const outPath = path.join(OUT_DIR, `agentic-workflows-${timestamp}.md`);
  await fs.writeFile(outPath, `# ${VERTICAL_LABEL}\n\n${report}\n\n---\nGenerated: ${new Date().toISOString()}\nSources: ${SEARCHES.join(', ')}`);
  console.log(`\n💾 Report saved: ${outPath}`);
  console.log('\n--- REPORT PREVIEW ---');
  console.log(report.slice(0, 1500));
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
