import crypto from "crypto";
import type { AtlasFlag, AtlasReason, AtlasScoringOutput } from "./types";
import type { Draft, Snapshot } from "./evaluators";
import { evalA, evalB, evalC, evalD, evalE, evalF } from "./evaluators";

export type PrecheckInput = {
  primary_intent?: any;
  topic_key: string;
  cluster_id?: string;
};

export type PrecheckOutput = {
  decision: "PASS" | "REVIEW" | "BLOCK" | "DELAY";
  gates: Array<{ gate: "G0" | "G1" | "G2" | "G3"; decision: "PASS" | "REVIEW" | "BLOCK" | "DELAY"; flags: AtlasFlag[]; reasons: AtlasReason[] }>;
};

export function hashInputs(obj: any) {
  const s = JSON.stringify(obj);
  return crypto.createHash("sha256").update(s).digest("hex");
}

export function gateG0(input: { primary_intent?: string }): { decision: "PASS" | "BLOCK"; flags: AtlasFlag[]; reasons: AtlasReason[] } {
  if (!input.primary_intent) {
    return {
      decision: "BLOCK",
      flags: [{ code: "INTENTION_MISSING", severity: "BLOCK_FLAG", gate: "G0" }],
      reasons: [
        {
          rule_id: "G0_INTENT_GATE",
          severity: "BLOCK_FLAG",
          message: "Intention principale non définie.",
          suggested_action: "Choisir 1 intention avant génération.",
          confidence: 0.95,
        },
      ],
    };
  }
  return { decision: "PASS", flags: [], reasons: [] };
}

export function gateG1(
  similarityTop: { url: string; sim_score: number; overlap_intent_score: number } | undefined,
  cfg: any
): { decision: "PASS" | "REVIEW" | "BLOCK"; flags: AtlasFlag[]; reasons: AtlasReason[] } {
  if (!similarityTop) return { decision: "PASS", flags: [], reasons: [] };
  const { url, sim_score, overlap_intent_score } = similarityTop;

  // MUST: use high_pre
  if (sim_score >= cfg.similarity.high_pre) {
    return {
      decision: "BLOCK",
      flags: [{ code: "HIGH_CANNIBALIZATION_PRE", severity: "BLOCK_FLAG", gate: "G1", related_urls: [url], details: { sim_score, overlap_intent_score } }],
      reasons: [
        {
          rule_id: "G1_COLLISION_GATE",
          severity: "BLOCK_FLAG",
          message: `Collision forte détectée avant génération avec ${url}.`,
          evidence: { similarity: sim_score, overlap_intent: overlap_intent_score },
          suggested_action: `Enrichir ${url} OU définir une sous-page avec angle imposé/validé.`,
          confidence: 0.85,
        },
      ],
    };
  }

  if (sim_score >= cfg.similarity.medium_low) {
    return {
      decision: "REVIEW",
      flags: [{ code: "MEDIUM_CANNIBALIZATION", severity: "REVIEW_FLAG", gate: "G1", related_urls: [url], details: { sim_score, overlap_intent_score } }],
      reasons: [
        {
          rule_id: "G1_COLLISION_GATE",
          severity: "REVIEW_FLAG",
          message: `Collision moyenne détectée avant génération avec ${url}.`,
          evidence: { similarity: sim_score, overlap_intent: overlap_intent_score },
          suggested_action: `Arbitrer : enrichir ${url} OU différencier l’angle.`,
          confidence: 0.78,
        },
      ],
    };
  }

  return { decision: "PASS", flags: [], reasons: [] };
}

export function gateG2(
  topic_key: string,
  registry: Array<{ topic_key: string; lock_mode: "strict" | "soft"; reference_url: string }>
): { decision: "PASS" | "BLOCK"; flags: AtlasFlag[]; reasons: AtlasReason[] } {
  const hit = registry.find((r) => r.topic_key === topic_key && r.lock_mode === "strict");
  if (!hit) return { decision: "PASS", flags: [], reasons: [] };

  return {
    decision: "BLOCK",
    flags: [{ code: "TOPIC_DUPLICATION_STRICT", severity: "BLOCK_FLAG", gate: "G2", related_urls: [hit.reference_url], details: { topic_key } }],
    reasons: [
      {
        rule_id: "G2_DUPLICATION_GATE",
        severity: "BLOCK_FLAG",
        message: `Sujet déjà couvert (registry strict) : ${hit.reference_url}.`,
        evidence: { topic_key },
        suggested_action: `Basculer vers workflow “update existing page” sur ${hit.reference_url}.`,
        confidence: 0.92,
      },
    ],
  };
}

export function gateG3(cluster_id: string | undefined, snap: Snapshot, cfg: any): { decision: "PASS" | "DELAY" | "BLOCK"; flags: AtlasFlag[]; reasons: AtlasReason[] } {
  if (!cluster_id) return { decision: "PASS", flags: [], reasons: [] };

  const ch = snap.cluster_history.find((c) => c.cluster_id === cluster_id);
  if (!ch) return { decision: "PASS", flags: [], reasons: [] };

  const cap = ch.cap_30d ?? snap.site_policies?.cluster_caps?.[cluster_id] ?? null;
  if (cap === null) return { decision: "PASS", flags: [], reasons: [] };

  if (ch.published_count_30d >= cap) {
    const hard = snap.site_policies?.hard_cap ?? cfg.cluster.default_hard_cap;
    if (hard) {
      return {
        decision: "BLOCK",
        flags: [{ code: "OVERPUBLISHING_HARD", severity: "BLOCK_FLAG", gate: "G3", details: { cluster_id, cap_30d: cap, published_count_30d: ch.published_count_30d } }],
        reasons: [
          {
            rule_id: "G3_SURPUBLICATION",
            severity: "BLOCK_FLAG",
            message: "Plafond de publication cluster dépassé (hard cap).",
            evidence: { cluster_id, cap_30d: cap, published_count_30d: ch.published_count_30d },
            suggested_action: "Replanifier au-delà de la fenêtre ou choisir un autre cluster.",
            confidence: 0.85,
          },
        ],
      };
    }

    return {
      decision: "DELAY",
      flags: [{ code: "CLUSTER_SATURATING", severity: "WARN_SIGNAL", gate: "G3", details: { cluster_id, cap_30d: cap, published_count_30d: ch.published_count_30d } }],
      reasons: [
        {
          rule_id: "G3_SURPUBLICATION",
          severity: "WARN_SIGNAL",
          message: "Cluster au plafond : replanification recommandée (DELAY).",
          evidence: { cluster_id, cap_30d: cap, published_count_30d: ch.published_count_30d },
          suggested_action: "Replanifier à une date ultérieure ou sélectionner un autre cluster.",
          confidence: 0.8,
        },
      ],
    };
  }

  return { decision: "PASS", flags: [], reasons: [] };
}

export function precheck(input: PrecheckInput, snap: Snapshot, ruleset: any): PrecheckOutput {
  // STRICT: only G0-G3 (no evaluators)
  const g0 = gateG0({ primary_intent: input.primary_intent });
  const g1 = gateG1(snap.top_matches?.[0] ? { url: snap.top_matches[0].url, sim_score: snap.top_matches[0].sim_score, overlap_intent_score: snap.top_matches[0].overlap_intent_score } : undefined, ruleset);
  const g2 = gateG2(input.topic_key, snap.content_registry);
  const g3 = gateG3(input.cluster_id, snap, ruleset);

  const gates = [
    { gate: "G0" as const, decision: g0.decision, flags: g0.flags, reasons: g0.reasons },
    { gate: "G1" as const, decision: g1.decision, flags: g1.flags, reasons: g1.reasons },
    { gate: "G2" as const, decision: g2.decision, flags: g2.flags, reasons: g2.reasons },
    { gate: "G3" as const, decision: g3.decision, flags: g3.flags, reasons: g3.reasons },
  ];

  // decision aggregation: BLOCK > DELAY > REVIEW > PASS
  const decision =
    gates.some((g) => g.decision === "BLOCK") ? "BLOCK" :
    gates.some((g) => g.decision === "DELAY") ? "DELAY" :
    gates.some((g) => g.decision === "REVIEW") ? "REVIEW" : "PASS";

  return { decision, gates };
}

export function computeAtlasScore(draft: Draft, snap: Snapshot, ruleset: any): AtlasScoringOutput {
  // STRICT: evaluators + G4-G6 only
  const A = evalA(draft);
  const B = evalB(draft, snap, ruleset);
  const C = evalC(draft, ruleset);
  const D = evalD(draft, snap, ruleset);
  const E = evalE(draft, snap, ruleset);
  const F = evalF(draft);

  const scores = { A: A.score, B: B.score, C: C.score, D: D.score, E: E.score, F: F.score };
  const score_total =
    ruleset.weights.A * scores.A +
    ruleset.weights.B * scores.B +
    ruleset.weights.C * scores.C +
    ruleset.weights.D * scores.D +
    ruleset.weights.E * scores.E +
    ruleset.weights.F * scores.F;

  const flags = [...A.flags, ...B.flags, ...C.flags, ...D.flags, ...E.flags, ...F.flags];
  const reasons = [...A.reasons, ...B.reasons, ...C.reasons, ...D.reasons, ...E.reasons, ...F.reasons];

  // G4 thresholds
  let decision: AtlasScoringOutput["decision"];
  if (score_total < ruleset.thresholds.score_gate.block_lt) decision = "BLOCK";
  else if (score_total < ruleset.thresholds.score_gate.review_lt) decision = "REVIEW";
  else if (score_total < ruleset.thresholds.score_gate.pass_lt) decision = "PASS";
  else decision = "PREMIUM";

  // G5 hard-block override (must include duplication + intent missing)
  const hardBlockCodes = new Set([
    "INTENTION_MISSING",
    "TOPIC_DUPLICATION_STRICT",
    "HIGH_CANNIBALIZATION_POST",
    "GENERIC_CONTENT",
    "SITE_ECOSYSTEM_MISMATCH",
    "INTENTION_DRIFT"
  ]);
  const hardBlock = flags.some((f) => f.severity === "BLOCK_FLAG" && hardBlockCodes.has(f.code));
  if (hardBlock) decision = "BLOCK";

  // G6 human validation
  const forceReview = !!snap.site_policies?.high_stakes || flags.some((f) => f.code === "PILLAR_CREATION" || f.code === "HIGH_STAKES_SITE" || f.code === "ANGLE_UNCERTAIN");
  if (forceReview && decision !== "BLOCK") decision = "REVIEW";

  // explainability guarantee: any BLOCK_FLAG => at least one BLOCK reason with suggested_action
  const hasBlockFlag = flags.some((f) => f.severity === "BLOCK_FLAG");
  if (hasBlockFlag) {
    const hasActionable = reasons.some((r) => r.severity === "BLOCK_FLAG" && !!r.suggested_action);
    if (!hasActionable) {
      reasons.push({
        rule_id: "ATLAS_BUG_MISSING_REASON",
        severity: "BLOCK_FLAG",
        message: "Blocage sans reason actionnable (bug).",
        suggested_action: "Corriger l’engine : chaque BLOCK_FLAG doit produire une reason actionnable.",
        confidence: 1,
      } as any);
    }
  }

  const inputs_hash = hashInputs({ draft, snap, ruleset_version: ruleset.version });
  return {
    ruleset_version: ruleset.version,
    inputs_hash,
    timestamp: new Date().toISOString(),
    score_total: Math.round(score_total),
    scores_dimensions: scores,
    flags,
    reasons,
    decision,
  };
}
