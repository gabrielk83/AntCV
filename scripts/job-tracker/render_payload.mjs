// Headless byte-exact payload builder: runs the app's OWN buildPayload
// (pwa/antcv-docx-client.js) in Node with a localStorage shim seeded from a
// captured settings fixture, so the docx-worker payload is identical to what
// the PWA would send for the same sections + settings. Reads a JSON job on
// stdin ({sections:{cv,cl}, personalInfo, styleConfig, doc, meta, language,
// photo}) and writes the built payload JSON to stdout.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const SETTINGS = process.env.ANTCV_SETTINGS || `${process.env.HOME || process.env.USERPROFILE}/.antcv/export_settings.json`;
const MODULE = process.env.ANTCV_DOCX_CLIENT; // path to a .mjs copy of antcv-docx-client.js

// --- localStorage shim from the captured settings fixture ---
const store = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
globalThis.localStorage = {
  getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  key: (i) => Object.keys(store)[i] ?? null,
  get length() { return Object.keys(store).length; },
};
// --- minimal DOM/window shims (buildPayload uses these only inside helpers) ---
globalThis.window = globalThis;
globalThis.document = {
  createElement: () => ({ style: {}, getContext: () => null, setAttribute() {}, appendChild() {} }),
  querySelector: () => null, querySelectorAll: () => [],
  getElementById: () => null, documentElement: { style: {} }, body: { style: {} },
};
globalThis.location = { href: 'https://antcv.pages.dev/', origin: 'https://antcv.pages.dev', pathname: '/' };
try { Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node-harness', language: 'en' }, configurable: true }); } catch (_) {}
if (!globalThis.fetch) { try { globalThis.fetch = () => Promise.reject(new Error('fetch disabled')); } catch (_) {} }

const mod = await import(pathToFileURL(MODULE).href);
const job = JSON.parse(fs.readFileSync(0, 'utf8')); // stdin
const payload = mod.buildPayload(job);
process.stdout.write(JSON.stringify(payload));
