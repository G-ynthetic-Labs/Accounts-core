// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * What a person is shown before they choose whether a probe may count: what it collects, why, what it never
 * collects, and every count it can make. As data for a screen, and as plain text for a printout or an export.
 *
 * Spec: docs/design.md § Telemetry › Disclosure · POL-DOCS-002 (every document a person reads exports as PDF, Word,
 * Google Docs and plain text)
 * Source of truth: the probe's own disclosure and metrics (adapter-lib)
 * @feature accounts-telemetry
 * @address telemetry.probe.disclosure
 *
 * How it works. `disclosureOf` copies the probe's words and lists each metric with its description and the values
 * its attribute can take; nothing is added or reworded, so what the person reads is what the probe declared.
 * `disclosureText` lays the same out as plain text in a fixed order; a product turns that into its PDF and Word
 * exports.
 */
import type { TelemetryProbe } from 'adapter-lib/telemetry-contract';

/** One count a probe can make, as the person sees it. */
export interface DisclosedMetric {
  readonly name: string;
  readonly description: string;
  readonly attributes: readonly string[];
}

/** What the person is shown about one probe. */
export interface Disclosure {
  readonly probe: string;
  readonly version: number;
  readonly title: string;
  readonly collects: string;
  readonly why: string;
  readonly never: readonly string[];
  readonly metrics: readonly DisclosedMetric[];
}

/** The disclosure of a probe (see the header). Pure. */
export function disclosureOf(p: TelemetryProbe): Disclosure {
  return Object.freeze({
    probe: p.id, version: p.version, title: p.title, collects: p.disclosure.collects, why: p.disclosure.why,
    never: Object.freeze([...p.disclosure.never]),
    metrics: Object.freeze(Object.entries(p.metrics).map(([name, m]) => Object.freeze({ name, description: m.description, attributes: Object.freeze([...(m.attributes ?? [])]) }))),
  });
}

/** The disclosure as plain text (see the header). Pure. */
export function disclosureText(d: Disclosure): string {
  const lines = [
    d.title, '',
    `What it counts: ${d.collects}`,
    `Why: ${d.why}`, '',
    'It never collects:', ...d.never.map((n) => `- ${n}`), '',
    'Every count it can make:',
    ...d.metrics.map((m) => `- ${m.description}${m.attributes.length > 0 ? ` (${m.attributes.join(', ')})` : ''}`), '',
    'Only counts leave this computer, added up across everyone who said yes, and only when a person sends them.',
    `Probe ${d.probe}, version ${d.version}.`,
  ];
  return `${lines.join('\n')}\n`;
}
