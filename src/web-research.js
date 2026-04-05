/**
 * research-pipeline/src/web-research.js
 * Uses web_search to research income opportunities, then synthesizes with MiniMax.
 * Burns MiniMax credits productively to discover monetizable ideas.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../output');

// Verticals to research — areas where Max has expertise
const VERTICALS = [
  {
    id: 'micro-saas-niches',
    label: 'Micro-SaaS Niches for Software Developers',
    searches: [
      'micro saas business ideas 2026 solo developer',
      'niche SaaS products profitable 2025 2026',
      'small saas ideas indie hackers successful',
    ],
  },
  {
    id: 'cad-3d-printing-opportunities',
    label: 'CAD & 3D Printing Income Opportunities',
    searches: [
      'CAD freelancer rates 2025 2026',
      '3D printing services demand 2026',
      'Onshape Fusion 360 freelancer opportunities',
    ],
  },
  {
    id: 'ai-automation-services',
    label: 'AI Automation Services (N8N, Make.com, Zapier)',
    searches: [
      'N8N automation services freelance 2025',
      'AI automation agency business model 2026',
      'workflow automation freelancer rates',
    ],
  },
  {
    id: 'dental-tech-consultancy',
    label: 'Dental Lab Tech & Digital Dentistry',
    searches: [
      'dental lab software needs 2025 2026',
      'digital dentistry opportunities dental labs',
      'dental CAD CAM freelancer rates',
    ],
  },
];

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

async function runWebResearch() {
  const results = {};
  
  for (const vertical of VERTICALS) {
    console.log(`\n🔍 Researching: ${vertical.label}`);
    const searchResults = [];
    
    for (const query of vertical.searches) {
      try {
        // We'll capture the web search via a subprocess calling the web_search tool
        // But since we can't call tools from Node, we'll simulate with fetch to a search API
        // Actually, let's use the browser/web search approach via exec
        console.log(`   Searching: ${query}`);
        
        // Use web_search via a helper script
        const searchResult = await execWebSearch(query);
        searchResults.push(...searchResult);
        
        // Rate limit between searches
        await sleep(1500);
      } catch (err) {
        console.warn(`   ⚠️ Search failed: ${err.message}`);
      }
    }
    
    results[vertical.id] = {
      label: vertical.label,
      query_count: vertical.searches.length,
      findings: searchResults,
    };
    
    console.log(`   → ${searchResults.length} findings`);
    
    // Rate limit between verticals
    await sleep(2000);
  }
  
  return results;
}

async function execWebSearch(query) {
  // Use node's exec to call a simple fetch-based search
  // We'll use DuckDuckGo's HTML scrape since we don't have API keys
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (ResearchPipeline/1.0)',
    },
  });
  
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  
  const html = await response.text();
  
  // Parse results from DuckDuckGo HTML
  const results = [];
  const resultRegex = /<a class="result__a" href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]{0,200}?<a class="result__snippet"[^>]*>([^<]+)<\/a/g;
  let match;
  let count = 0;
  
  while ((match = resultRegex.exec(html)) !== null && count < 5) {
    results.push({
      url: match[1],
      title: match[2].replace(/<[^>]+>/g, '').trim(),
      snippet: match[3].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim(),
    });
    count++;
  }
  
  return results;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function synthesizeFindings(apiKey, findings) {
  if (!apiKey) throw new Error('MINIMAX_API_KEY not found');
  
  const allFindings = Object.entries(findings)
    .flatMap(([id, data]) => {
      const items = data.findings || [];
      return items.map((f) => `- ${f.title}: ${f.snippet} (${f.url})`);
    })
    .join('\n');
  
  const prompt = `You are a business analyst specializing in income opportunities for solo software developers and freelancers.

Based on these web search findings, identify 5-8 specific, actionable income opportunities Max could pursue. Consider his background:
- Senior software developer (10+ years)
- CAD, 3D modeling, and technical skills
- Works at a dental lab software company (Dandy)
- Has homelab self-hosting experience
- Can build micro-SaaS, automations, and custom tools

Search Findings:
${allFindings}

Output a markdown report with:
## Identified Income Opportunities

For each opportunity:
- **Name:** Short name
- **Why it works:** 2 sentences on why Max is positioned for this
- **Revenue model:** How it makes money (subscription, one-time, service)
- **Next step:** First concrete action to validate this opportunity

Be specific. No generic advice. Focus on his actual skills and existing infrastructure.`;

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
  if (!textItem) throw new Error('No text in response');
  return textItem.text;
}

async function main() {
  console.log('🚀 Starting Web Research Pipeline\n');
  console.log('='.repeat(50));
  
  // Run research
  const findings = await runWebResearch();
  
  // Save raw findings
  await fs.mkdir(OUT_DIR, { recursive: true });
  const rawPath = path.join(OUT_DIR, `research-raw-${Date.now()}.json`);
  await fs.writeFile(rawPath, JSON.stringify(findings, null, 2));
  console.log(`\n💾 Raw findings saved to: ${rawPath}`);
  
  // Synthesize with MiniMax
  console.log('\n🤖 Synthesizing with MiniMax...');
  const apiKey = await getApiKey();
  
  try {
    const report = await synthesizeFindings(apiKey, findings);
    
    const reportPath = path.join(OUT_DIR, `income-opportunities-${new Date().toISOString().slice(0,10)}.md`);
    await fs.writeFile(reportPath, report);
    console.log(`\n✅ Report saved to: ${reportPath}`);
    console.log('\n' + '='.repeat(50));
    console.log(report);
  } catch (err) {
    console.error('\n❌ Synthesis failed:', err.message);
    console.log('\nRaw findings still available at:', rawPath);
  }
}

main().catch(console.error);
