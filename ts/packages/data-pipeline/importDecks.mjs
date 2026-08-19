#!/usr/bin/env node
// Import real tournament decklists from limitlesstcg.com into ts/data/decks/.
//
//   node packages/data-pipeline/importDecks.mjs [--tournaments 8] [--top 4] [--refresh]
//
// Requires data/cards.json (run importCards.mjs first) to resolve set code +
// collector number to a card id and to verify every card is in the legal pool.
// ponytail: regex over the HTML, no playwright — the pages are server-rendered.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CACHE = path.join(ROOT, 'data/.cache');
const SITE = 'https://limitlesstcg.com';
const UA = 'Mozilla/5.0 (compatible; ptcg-sim-deck-importer/1.0)';
const REFRESH = process.argv.includes('--refresh');
const N_TOURNAMENTS = Number(argValue('--tournaments') ?? 8);
const TOP_N = Number(argValue('--top') ?? 4);

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function fetchText(urlPath) {
  const cached = path.join(CACHE, `limitless${urlPath.replace(/\//g, '_')}.html`);
  if (!REFRESH && fs.existsSync(cached)) return fs.readFileSync(cached, 'utf8');
  const res = await fetch(SITE + urlPath, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} fetching ${urlPath}`);
  const text = await res.text();
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(cached, text);
  return text;
}

const pool = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/cards.json'), 'utf8'));
const byId = new Map(pool.cards.map((c) => [c.id, c]));
const setIdByCode = new Map(
  Object.entries(pool.sets).map(([setId, s]) => [s.ptcgoCode, setId])
);
// Fallback for reprints whose printing is not in the pool (e.g. energy from a
// set we don't carry): resolve by name to any legal card with that name.
const byName = new Map();
for (const c of pool.cards) if (!byName.has(c.name)) byName.set(c.name, c);

function resolveCard(setCode, number, name) {
  const setId = setIdByCode.get(setCode);
  const direct = setId && byId.get(`${setId}-${number}`);
  if (direct && direct.name === name) return direct;
  return byName.get(name) ?? byName.get(name.replace(/^Basic /, '')) ?? byName.get(`Basic ${name}`) ?? null;
}

function parseTournaments(html) {
  const rows = [...html.matchAll(
    /<tr data-date="([^"]+)"[^>]*data-name="([^"]+)" data-format="([^"]+)"[^>]*data-players="(\d*)"[\s\S]{0,400}?href="\/tournaments\/(\d+)"/g
  )];
  return rows
    .map(([, date, name, format, players, id]) => ({ id, date, name, format, players: Number(players) }))
    .filter((t) => t.format === 'standard')
    .sort((a, b) => b.date.localeCompare(a.date));
}

function parseDecklists(html) {
  const blocks = html.split('<div class="tournament-decklist">').slice(1);
  return blocks.map((block) => {
    const toggle = /<div class="decklist-toggle"[^>]*>([^<]+)</.exec(block)?.[1].trim() ?? '';
    const [, placement, player] = /^(\S+)\s+(.*)$/.exec(toggle) ?? [, '', toggle];
    const archetype = /<div class="decklist-title">\s*([^<]+)/.exec(block)?.[1].trim() ?? 'Unknown';
    const cards = [...block.matchAll(
      /data-set="([A-Z0-9]+)" data-number="(\d+)"[\s\S]{0,200}?<span class="card-count">(\d+)<\/span>\s*<span class="card-name">([^<]+)<\/span>/g
    )].map(([, set, number, count, name]) => ({ set, number, count: Number(count), name }));
    return { placement, player, archetype, cards };
  });
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const tournaments = parseTournaments(await fetchText('/tournaments')).slice(0, N_TOURNAMENTS);
const outDir = path.join(ROOT, 'data/decks');
fs.mkdirSync(outDir, { recursive: true });

const written = [];
const skipped = [];

for (const t of tournaments) {
  let html;
  try {
    html = await fetchText(`/tournaments/${t.id}/decklists`);
  } catch (e) {
    console.warn(`skip ${t.name}: ${e.message}`);
    continue;
  }
  for (const deck of parseDecklists(html).slice(0, TOP_N)) {
    const ids = [];
    const unresolved = [];
    for (const entry of deck.cards) {
      const card = resolveCard(entry.set, entry.number, entry.name);
      if (!card) {
        unresolved.push(`${entry.set} ${entry.number} ${entry.name}`);
        continue;
      }
      for (let i = 0; i < entry.count; i++) ids.push(card.id);
    }
    const name = `${slug(deck.archetype)}-${slug(t.name)}-${slug(deck.placement)}`;
    if (unresolved.length || ids.length !== 60) {
      skipped.push({ name, size: ids.length, unresolved });
      continue;
    }
    fs.writeFileSync(
      path.join(outDir, `${name}.json`),
      JSON.stringify(
        {
          name: deck.archetype,
          player: deck.player,
          placement: deck.placement,
          tournament: t.name,
          date: t.date,
          source: `${SITE}/tournaments/${t.id}/decklists`,
          cards: ids,
        },
        null,
        1
      )
    );
    written.push(name);
  }
}

// Mirror to the UI's static dir so the browser build serves the same decks.
const uiDir = path.join(ROOT, 'packages/ui/public/decks');
fs.mkdirSync(uiDir, { recursive: true });
for (const name of written) {
  fs.copyFileSync(path.join(outDir, `${name}.json`), path.join(uiDir, `${name}.json`));
}
fs.writeFileSync(path.join(uiDir, 'index.json'), JSON.stringify(written, null, 1));
fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(written, null, 1));

console.log(`tournaments: ${tournaments.length}  decks written: ${written.length}`);
for (const s of skipped) console.warn(`skipped ${s.name}: ${s.size} cards, unresolved ${JSON.stringify(s.unresolved)}`);
