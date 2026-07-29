// JD-FETCH-JSONLD-001 — SEO career SPAs (SAP SuccessFactors RMK, Workday, Phenom…) render
// the JD only via JS, so the server HTML body is a shell — but they embed the full posting
// as a schema.org JobPosting in <script type="application/ld+json"> for Google Jobs. The
// text extractor strips <script>, so that description was invisible. extractJobPostingJsonLd
// recovers it. These tests lock the parser's shapes (plain node, @graph, @type array).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractJobPostingJsonLd } from '../src/fetch-jd-url.js';

const LONG = 'We are hiring an Associate Project Manager for Program Excellence in Soeborg. '
  + 'You will coordinate cross-functional programme milestones, run the change-control board, '
  + 'and report status to stakeholders. Requirements: 3+ years in project coordination, ASPICE '
  + 'familiarity, and strong written communication. Danish work authorisation required.';

function page(jsonld) {
  return `<!doctype html><html><head><title>Career Opportunities</title>`
    + `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>`
    + `</head><body><div id="app"></div></body></html>`;
}

test('extracts description + title + company from a plain JobPosting node', () => {
  const r = extractJobPostingJsonLd(page({
    '@context': 'https://schema.org', '@type': 'JobPosting', title: 'Associate Project Manager',
    description: '<p>' + LONG + '</p>', hiringOrganization: { '@type': 'Organization', name: 'Terma A/S' },
    jobLocation: { address: { addressLocality: 'Søborg', addressCountry: 'DK' } },
  }));
  assert.ok(r, 'found a JobPosting');
  assert.match(r.description, /Associate Project Manager|change-control board/);
  assert.ok(r.description.length >= 220);
  assert.equal(r.title, 'Associate Project Manager');
  assert.equal(r.company, 'Terma A/S');
  assert.match(r.location, /Søborg/);
  assert.ok(!/<p>/.test(r.description), 'HTML in description is converted to text');
});

test('finds the JobPosting inside an @graph array', () => {
  const r = extractJobPostingJsonLd(page({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', name: 'Careers' },
      { '@type': 'JobPosting', title: 'PM', description: LONG, hiringOrganization: { name: 'Terma' } },
    ],
  }));
  assert.ok(r);
  assert.equal(r.company, 'Terma');
});

test('handles @type given as an array', () => {
  const r = extractJobPostingJsonLd(page({ '@type': ['JobPosting', 'Thing'], title: 'PM', description: LONG }));
  assert.ok(r);
});

test('returns null when there is no JobPosting', () => {
  assert.equal(extractJobPostingJsonLd(page({ '@type': 'WebSite', name: 'x' })), null);
  assert.equal(extractJobPostingJsonLd('<html><body>no ld+json here</body></html>'), null);
});

test('returns null when the JobPosting description is too short (title-only shell)', () => {
  assert.equal(extractJobPostingJsonLd(page({ '@type': 'JobPosting', title: 'PM', description: 'Apply now' })), null);
});

test('does not throw on malformed JSON-LD', () => {
  const html = '<script type="application/ld+json">{ not valid json </script>';
  assert.equal(extractJobPostingJsonLd(html), null);
});
