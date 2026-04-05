/**
 * research-pipeline/src/run.js
 * Full pipeline: scrape → synthesize → output.
 * Uses OpenClaw agent for synthesis (MiniMax-M2 model).
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');
const OUT_DIR = path.resolve(__dirname, '../output');

async function getLatestRawFile() {
  const files = (await fs.readdir(DATA_DIR))
    .filter((f) => f.startsWith('raw-') && f.endsWith('.json'))
    .sort()
    .reverse();
  if (files.length === 0) throw new Error('No raw data. Run scraper first.');
  return path.join(DATA_DIR, files[0]);
}

async function loadArticles() {
  const rawPath = await getLatestRawFile();
  return JSON.parse(await fs.readFile(rawPath, 'utf-8'));
}

async function saveReports(reports) {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().slice(0, 10);
  const outPath = path.join(OUT_DIR, `reports-${timestamp}.json`);
  await fs.writeFile(outPath, JSON.stringify(reports, null, 2));
  return outPath;
}

async function synthesizeWithAgent(vertical, articles) {
  const VERTICALS = {
    'cad-3d-printing': 'CAD & 3D Printing',
    'dental-tech': 'Dental Technology',
    'manufacturing': 'Manufacturing & Machining',
    'ai-ml': 'AI & Machine Learning',
  };

  const label = VERTICALS[vertical] || vertical;

  // Top articles by content quality
  const topArticles = [...articles]
    .filter((a) => a.summary && a.summary.length > 50)
    .sort((a, b) => b.summary.length - a.summary.length)
    .slice(0, 8);

  const articleList = topArticles
    .map((a, i) => `${i + 1}. **${a.title}** (${a.source})\n   ${a.summary.slice(0, 400)}`)
    .join('\n\n');

  const prompt = `You are a technical research assistant. Synthesize these recent articles into a concise markdown report for a senior software engineer and technical maker.

**Topic:** ${label}

**Source Articles:**
${articleList}

Write a structured markdown report with:
- **Headline** — One compelling trend (1 sentence)
- **Summary** — 3-4 sentence overview
- **Key Developments** — 3-5 bullets
- **Implications** — What this means for engineers/makers
- **Sources** — All URLs listed

Be factual, dense, no fluff. Output only the markdown report nothing else.`;

  const promptFile = path.join(OUT_DIR, `prompt-${vertical}.md`);
  await fs.writeFile(promptFile, prompt);

  return new Promise((resolve, reject) => {
    const proc = spawn('openclaw', [
      'agent',
      'run',
      '--model', 'minimax/MiniMax-M2',
      '--no-stream',
      promptFile,
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120000,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code !== 0 && code !== null) {
        console.warn(`⚠️ openclaw exit code: ${code}`);
        console.warn(stderr.slice(-500));
      }
      // Extract markdown content (strip any non-markdown prefix)
      const lines = stdout.split('\n');
      const startIdx = lines.findIndex((l) => l.startsWith('#') || l.startsWith('**'));
      resolve(startIdx >= 0 ? lines.slice(startIdx).join('\n') : stdout);
    });

    proc.on('error', reject);
  });
}

export async function runPipeline(vertical) {
  console.log('📥 Loading scraped data...');
  const raw = await loadArticles();

  const verticalsToProcess = vertical ? [vertical] : Object.keys(raw);
  const reports = {};

  for (const v of verticalsToProcess) {
    const articles = raw[v] || [];
    console.log(`🤖 Synthesizing ${v} (${articles.length} articles)...`);
    try {
      const report = await synthesizeWithAgent(v, articles);
      reports[v] = report;
      console.log(`   ✅ ${report.length} chars`);
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
      reports[v] = `## Error\n\nFailed to synthesize: ${err.message}`;
    }

    // Rate limit between verticals
    await new Promise((r) => setTimeout(r, 3000));
  }

  const outPath = await saveReports(reports);
  console.log(`\n💾 Reports saved: ${outPath}`);
  return reports;
}

const vertical = process.argv[2];
runPipeline(vertical)
  .then(() => { console.log('✅ Pipeline complete'); process.exit(0); })
  .catch((err) => { console.error('❌ Pipeline error:', err.message); process.exit(1); });
