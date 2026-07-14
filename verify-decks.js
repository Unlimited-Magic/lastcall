#!/usr/bin/env node
// Verification script for LASTCALL deck data
// Run: node verify-decks.js
// Assertions: counts, drink-safety coverage, id uniqueness, type validity

import { readFileSync } from 'node:fs';

const FREE   = JSON.parse(readFileSync(new URL('./content/free-deck.json', import.meta.url)));
const MESSY  = JSON.parse(readFileSync(new URL('./content/messy-night.json', import.meta.url)));
const COUPLES= JSON.parse(readFileSync(new URL('./content/couples.json', import.meta.url)));

const VALID_TYPES = new Set(['truth','dare','vote','rule','everyone','targeted']);
let passed = 0;
let failed = 0;

function assert(label, condition, detail='') {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

function checkDeck(name, deck, expectedCount) {
  console.log(`\n[${name}]`);
  assert(`count >= ${expectedCount}`, deck.length >= expectedCount, `actual: ${deck.length}`);

  const ids = new Set();
  let drinkMissingZerop = [];
  let drinkMissingForfeit = [];
  let nonDrinkHasZerop = [];
  let nonDrinkHasForfeit = [];
  let badType = [];
  let missingId = [];

  for (const p of deck) {
    if (!p.id) missingId.push(JSON.stringify(p).slice(0,60));
    if (ids.has(p.id)) assert(`unique id ${p.id}`, false, 'duplicate id');
    ids.add(p.id);

    if (!VALID_TYPES.has(p.t)) badType.push(p.id);

    if (p.d) {
      if (!p.z) drinkMissingZerop.push(p.id);
      if (!p.f) drinkMissingForfeit.push(p.id);
    } else {
      if (p.z !== null && p.z !== undefined) nonDrinkHasZerop.push(p.id);
      if (p.f !== null && p.f !== undefined) nonDrinkHasForfeit.push(p.id);
    }
  }

  assert('no missing ids', missingId.length === 0, missingId.join(', '));
  assert('no invalid types', badType.length === 0, badType.join(', '));
  assert('drink prompts have zerop (100% coverage)', drinkMissingZerop.length === 0, drinkMissingZerop.join(', '));
  assert('drink prompts have forfeit (100% coverage)', drinkMissingForfeit.length === 0, drinkMissingForfeit.join(', '));
  assert('non-drink prompts have zerop=null', nonDrinkHasZerop.length === 0, nonDrinkHasZerop.join(', '));
  assert('non-drink prompts have forfeit=null', nonDrinkHasForfeit.length === 0, nonDrinkHasForfeit.join(', '));

  const byType = {};
  for (const p of deck) byType[p.t] = (byType[p.t]||0)+1;
  const drinkCount = deck.filter(p=>p.d).length;
  const nonDrinkCount = deck.filter(p=>!p.d).length;
  console.log(`  → by type: ${JSON.stringify(byType)}`);
  console.log(`  → drink prompts: ${drinkCount}, non-drink: ${nonDrinkCount}`);
}

checkDeck('FREE DECK (need ≥150)', FREE, 150);
checkDeck('MESSY NIGHT (need ≥200)', MESSY, 200);
checkDeck('COUPLES PREGAME (need ≥200)', COUPLES, 200);

// Cross-deck id uniqueness
const allIds = [...FREE, ...MESSY, ...COUPLES].map(p=>p.id);
const allIdSet = new Set(allIds);
console.log('\n[CROSS-DECK]');
assert('all ids unique across all decks', allIdSet.size === allIds.length, `total: ${allIds.length}, unique: ${allIdSet.size}`);

console.log(`\n${'─'.repeat(40)}`);
console.log(`TOTAL: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
