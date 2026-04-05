/**
 * research-pipeline/src/synthesize.js
 * Loads scraped data and sends to MiniMax for AI synthesis into structured reports.
 * Uses Anthropic Messages API with MiniMax-M2.7 (model outputs thinking + text).
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');
const OUT_DIR = path.resolve(__dirname, '../output');

const VERTICALS = {
  'cad-3d-printing': 'CAD & 3D Printing',
  'dental-tech': 'Dental Technology',
  'manufacturing': 'Manufacturing & Machining',
  'ai-ml': 'AI & Machine Learning',
};

const VERTICAL_DESCRIPTIONS = {
  'cad-3d-printing': 'Latest developments in computer-aided design, 3D printing, additive manufacturing, and related tooling.',
  'dental-tech': 'Emerging technologies in dental labs, digital dentistry, 3D scanning, and dental manufacturing.',
  'manufacturing': 'CNC machining, manufacturing automation, industry 4.0, and precision engineering news.',
  'ai-ml': 'Machine learning research, AI tools, and automation relevant to software engineers and makers.',
};

async function getApiKey() {
  try {
    const envFile = path.resolve(__dirname, '../../.env');
    const content = await fs.readFile(envFile, 'utf-8');
    const match = content.match(/MINIMAX_API_KEY\s*=\s*(.+)/);
    return match ? match[1].trim() : null;
  } catch {
    return process.env.MINIMAX_API_KEY || null;
  }
}

async function synthesizeWithMiniMax(vertical, articles) {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error('MINIMAX_API_KEY not found');

  // Keep articles short so thinking trace doesn't eat all output tokens
  const topArticles = [...articles]
    .filter((a) => a.summary && a.summary.length > 50)
    .sort((a, b) => b.summary.length - a.summary.length)
    .slice(0, 3);

  const articleList = topArticles
    .map((a, i) => `${i + 1}. ${a.title} (${a.url}): ${a.summary.slice(0, 150)}`)
    .join('\n');

  const label = VERTICALS[vertical] || vertical;

  const prompt = `Tech report on: ${label}

${articleList}

Write a short markdown report: one headline sentence, 4 bullet key developments, one-sentence implications, list URLs. Be concise. Output markdown only.`;

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
  // MiniMax-M2.7 returns content array: [thinking?, text?]
  const textItem = data.content?.find((c) => c.type === 'text');
  if (!textItem) {
    throw new Error(`No text in response. Content: ${JSON.stringify(data.content)}`);
  }
  return textItem.text;
}

/**
 * Load latest raw JSON and synthesize all or specific vertical.
 */
export async function runSynthesize(vertical) {
  const files = (await fs.readdir(DATA_DIR))
    .filter((f) => f.startsWith('raw-') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) {
    throw new Error('No raw data found. Run scraper first.');
  }

  const latestRaw = path.join(DATA_DIR, files[0]);
  const raw = JSON.parse(await fs.readFile(latestRaw, 'utf-8'));

  console.log(`📄 Loaded: ${latestRaw}`);
  console.log(`📋 Verticals: ${Object.keys(raw).join(', ')}\n`);

  const verticalsToProcess = vertical ? [vertical] : Object.keys(raw);
  const reports = {};

  for (const v of verticalsToProcess) {
    const articles = raw[v] || [];
    console.log(`🤖 Synthesizing ${v} (${articles.length} articles)...`);
    try {
      const report = await synthesizeWithMiniMax(v, articles);
      reports[v] = report;
      console.log(`   ✅ ${report.length} chars generated\n`);
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}\n`);
      reports[v] = `## Error\n\nFailed to synthesize: ${err.message}`;
    }

    // Rate limit between verticals
    await new Promise((r) => setTimeout(r, 2000));
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().slice(0, 10);
  const outPath = path.join(OUT_DIR, `reports-${timestamp}.json`);
  await fs.writeFile(outPath, JSON.stringify(reports, null, 2));
  console.log(`💾 Reports saved to: ${outPath}`);
  return reports;
}

const vertical = process.argv[2];
runSynthesize(vertical)
  .then(() => {
    console.log('\n✅ Synthesis complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Synthesis error:', err.message);
    process.exit(1);
  });
