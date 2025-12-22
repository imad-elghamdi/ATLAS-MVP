import { AtlasDecisionPayload } from "./types";

export const mockSiteList = [
  {
    id: "site_1",
    domain: "example.com",
    cms: "WordPress",
    language: "FR",
    timezone: "UTC+1",
    last_verdict: "REVIEW" as const,
    policies: ["High-stakes SEO", "Cap : 2 publications / semaine", "Cap : 1 / cluster"],
    ruleset: "ATLAS v1.0",
  },
];

export const mockPrecheckBlock: AtlasDecisionPayload = {
  decision: "BLOCK",
  gate: "G2",
  gate_label: "Duplication thématique détectée",
  reasons: [
    { message: "Sujet déjà couvert sur le site" },
    { message: "Collision stricte topic_key" },
    { message: "Risque de cannibalisation SEO" },
  ],
  metadata: {
    ruleset_version: "ATLAS v1.0",
    inputs_hash: "9c2f…a71d",
    timestamp: "2025-12-10T14:32:00Z",
  },
};

export const mockScoreReview: AtlasDecisionPayload = {
  decision: "REVIEW",
  score_total: 72,
  scores: { A: 85, B: 78, C: 64, D: 58, E: 42, F: 76 },
  flags: [{ code: "REVIEW_FLAG", severity: "REVIEW", message: "Risque de recouvrement partiel" }],
  reasons: [{ message: "Risque de recouvrement partiel avec une page existante" }],
  metadata: {
    ruleset_version: "ATLAS v1.0",
    inputs_hash: "9c2f…a71d",
    timestamp: "2025-12-10T14:32:00Z",
  },
};
