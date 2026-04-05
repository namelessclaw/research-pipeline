/**
 * research-pipeline/src/scraper.js
 * Fetches content from configured RSS feeds and web sources.
 */

import Parser from 'rss-parser';
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');

// Source configurations per vertical/topic
const SOURCES = {
  'cad-3d-printing': {
    label: 'CAD & 3D Printing',
    feeds: [
      'https://www.hackster.io/feed',
      'https://blog.sketchfab.com/feed/',
      'https://www.3dhubs.com/blog/feed/',
      'https://all3dp.com/feed/',
    ],
    pages: [
      'https://www.engineering.com/3DPrinting/',
    ],
  },
  'dental-tech': {
    label: 'Dental Technology',
    feeds: [
      'https://www.dentistrytoday.com/feed/',
      'https://www.dentaltown.com/blogs/rss',
    ],
    pages: [],
  },
  'manufacturing': {
    label: 'Manufacturing & Machining',
    feeds: [
      'https://www.mmsonline.com/feed',
      'https://www.manufacturingengineering.org/rss.xml',
    ],
    pages: [],
  },
  'ai-ml': {
    label: 'AI & Machine Learning',
    feeds: [
      'https://huggingface.co/blog/feed.xml',
      'https://arxiv.org/rss/cs.AI',
    ],
    pages: [],
  },
};

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'ResearchPipeline/1.0 (Max Personal AI Agent)',
  },
});

/**
 * Fetch and parse an RSS feed, returning array of article objects.
 */
async function fetchFeed(feedUrl) {
  try {
    const feed = await parser.parseURL(feedUrl);
    return feed.items.slice(0, 10).map((item) => ({
      title: item.title || 'No title',
      url: item.link || item.guid || '',
      published: item.pubDate || item.isoDate || null,
      summary: item.contentSnippet || item.content || item.summary || '',
      source: feed.title || new URL(feedUrl).hostname,
    }));
  } catch (err) {
    console.warn(`⚠️  Failed to fetch feed: ${feedUrl} — ${err.message}`);
    return [];
  }
}

/**
 * Fetch and extract main content from a web page.
 */
async function fetchPage(pageUrl) {
  try {
    const { data } = await axios.get(pageUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'ResearchPipeline/1.0 (Max Personal AI Agent)',
      },
    });
    const $ = cheerio.load(data);
    // Remove scripts, styles, nav, footer
    $('script, style, nav, footer, header, aside, .ad, .advertisement, .sidebar').remove();
    const title = $('h1').first().text().trim() || $('title').text().trim();
    const text = $('article, main, .content, #content')
      .find('p')
      .slice(0, 20)
      .text()
      .replace(/\s+/g, ' ')
      .trim();
    return {
      title,
      url: pageUrl,
      published: null,
      summary: text.slice(0, 500),
      source: new URL(pageUrl).hostname,
    };
  } catch (err) {
    console.warn(`⚠️  Failed to fetch page: ${pageUrl} — ${err.message}`);
    return null;
  }
}

/**
 * Main scraper — fetches all sources for all verticals.
 * Returns a map of vertical -> article array.
 */
export async function runScraper(verticals = Object.keys(SOURCES)) {
  const results = {};

  for (const vertical of verticals) {
    const config = SOURCES[vertical];
    if (!config) {
      console.warn(`⚠️ Unknown vertical: ${vertical}`);
      continue;
    }

    console.log(`\n📡 Scraping: ${config.label}`);
    const articles = [];

    // RSS feeds
    for (const feedUrl of config.feeds) {
      const items = await fetchFeed(feedUrl);
      articles.push(...items);
      console.log(`   ✓ ${new URL(feedUrl).hostname}: ${items.length} items`);
    }

    // Web pages
    for (const pageUrl of config.pages) {
      const item = await fetchPage(pageUrl);
      if (item) {
        articles.push(item);
        console.log(`   ✓ ${new URL(pageUrl).hostname}: 1 page`);
      }
    }

    results[vertical] = articles;
    console.log(`   → ${articles.length} total articles`);
  }

  // Save raw data
  await fs.mkdir(DATA_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(DATA_DIR, `raw-${timestamp}.json`);
  await fs.writeFile(outPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Raw data saved to: ${outPath}`);

  return results;
}

// Run if called directly
const verticals = process.argv.slice(2);
runScraper(verticals.length > 0 ? verticals : undefined)
  .then((data) => {
    console.log('\n✅ Scraper complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Scraper error:', err);
    process.exit(1);
  });
