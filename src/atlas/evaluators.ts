import type { AtlasFlag, AtlasReason, Intent } from "./types";

export type Draft = {
  title: string;
  content: string;
  meta_title?: string;
  meta_description?: string;
  slug?: string;

  primary_intent: Intent;
  secondary_intent?: Intent;

  role: "pillar" | "cluster" | "support" | "unknown";
  cluster_id?: string;
  topic_key: string;
};

export type SimilarityMatch = {
  page_id: string;
  url: string;
  title?: string;
  intent?: Intent | "unknown";
  cluster?: string;
  role?: string;
  sim_score: number; // 0..1
  overlap_intent_score: number; // 0..1
};

export type Snapshot = {
  site_policies: any;
  content_registry: Array<{ topic_key: string; lock_mode: "strict" | "soft"; reference_url: string }>;
  cluster_history: Array<{ cluster_id: string; published_count_30d: number; cap_30d?: number; last_published_at?: string }>;
  top_matches: SimilarityMatch[];
  snapshot_quality?: "poor" | "normal"; // computed upstream
};

export type EvaluatorOutput = {
  score: number; // 0..100
  flags: AtlasFlag[];
  reasons: AtlasReason[];
  metrics: any;
};

const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function hasAny(text: string, patterns: RegExp[]) {
  const t = text.toLowerCase();
  return patterns.some((r) => r.test(t));
}

function percentFromBuckets(hit: boolean, good: number, mid: number, bad: number) {
  if (hit) return good;
  return mid > bad ? mid : bad;
}

// A — Intent evaluator (fixed scaling)
export function evalA(draft: Draft): EvaluatorOutput {
  const flags: AtlasFlag[] = [];
  const reasons: AtlasReason[] = [];
  const metrics: any = {};

  // A1 prerequisite
  if (!draft.primary_intent) {
    flags.push({ code: "INTENTION_MISSING", severity: "BLOCK_FLAG", gate: "SCORING" });
    reasons.push({
      rule_id: "A1_INTENT_PRESENT",
      dimension: "A",
      severity: "BLOCK_FLAG",
      message: "Intention principale non définie.",
      suggested_action: "Choisir 1 intention avant génération.",
      confidence: 0.95,
    });
    return { score: 0, flags, reasons, metrics: { intent_present: false } };
  }

  // A2 title ↔ intent alignment
  const title = draft.title || "";
  const intent = draft.primary_intent;

  const patternsByIntent: Record<Intent, RegExp[]> = {
    transactional: [/prix|acheter|devis|réserver|reservation|promo|offre|tarif/i],
    comparative: [/meilleur|top|avis|comparatif|vs/i],
    informational: [/comment|guide|définition|pourquoi|qu-est-ce|c'est quoi/i],
    support: [/problème|erreur|réparer|faq|dépanner|solution/i],
    navigational: [/.^/],
  };

  const hit = hasAny(title, patternsByIntent[intent] || []);
  const title_intent_confidence = intent === "navigational" ? 0.8 : hit ? 0.85 : 0.45;
  metrics.title_intent_confidence = title_intent_confidence;

  let a2_score = 0; // 0..100
  if (title_intent_confidence >= 0.75) a2_score = 100;
  else if (title_intent_confidence >= 0.5) {
    a2_score = 60;
    reasons.push({
      rule_id: "A2_TITLE_INTENT_ALIGNMENT",
      dimension: "A",
      severity: "WARN_SIGNAL",
      message: "Titre ne reflète pas clairement l’intention déclarée.",
      evidence: { title_intent_confidence },
      suggested_action: "Ajuster le H1/titre pour refléter l’intention.",
      confidence: 0.7,
    });
  } else {
    a2_score = 30;
    reasons.push({
      rule_id: "A2_TITLE_INTENT_ALIGNMENT",
      dimension: "A",
      severity: "REVIEW_FLAG",
      message: "Titre ne reflète pas l’intention déclarée → intention incertaine.",
      evidence: { title_intent_confidence },
      suggested_action: "Reformuler le H1/titre pour aligner intention et angle.",
      confidence: 0.78,
    });
  }

  // A3 body drift signals (MVP heuristic)
  const body = draft.content || "";
  const driftSignals: Record<Intent, RegExp[]> = {
    informational: [/acheter|prix|devis|promo|réserver/i],
    transactional: [/définition|guide|pourquoi|comment/i],
    support: [/acheter|promo|réserver/i],
    comparative: [/réserver|devis|acheter maintenant/i],
    navigational: [],
  };

  const driftHit = intent === "navigational" ? false : hasAny(body, driftSignals[intent] || []);
  metrics.intent_drift_hit = driftHit;

  let a3_score = 100;
  if (!driftHit) {
    a3_score = 100;
  } else {
    // treat as moderate drift (REVIEW/WARN); hard drift needs richer heuristic, kept MVP
    a3_score = 70;
    reasons.push({
      rule_id: "A3_BODY_INTENT_DRIFT",
      dimension: "A",
      severity: "WARN_SIGNAL",
      message: `Signaux de dérive d’intention détectés (intention=${intent}).`,
      evidence: { intent_drift_hit: driftHit },
      suggested_action: "Limiter les sections hors intention OU changer l’intention déclarée.",
      confidence: 0.65,
    });
  }

  const score = clamp100(0.4 * a2_score + 0.6 * a3_score);
  return { score, flags, reasons, metrics };
}

// B — Uniqueness/Cannibalization
export function evalB(draft: Draft, snap: Snapshot, cfg: any): EvaluatorOutput {
  const flags: AtlasFlag[] = [];
  const reasons: AtlasReason[] = [];
  const metrics: any = {};
  const top = snap.top_matches?.[0];
  const max_sim = top ? top.sim_score : 0;
  metrics.max_sim = max_sim;

  // strict duplication (post)
  const reg = snap.content_registry.find((r) => r.topic_key === draft.topic_key && r.lock_mode === "strict");
  if (reg) {
    flags.push({ code: "TOPIC_DUPLICATION_STRICT", severity: "BLOCK_FLAG", gate: "SCORING", related_urls: [reg.reference_url] });
    reasons.push({
      rule_id: "B3_TOPIC_KEY_DUP",
      dimension: "B",
      severity: "BLOCK_FLAG",
      message: `Sujet déjà couvert par une page de référence : ${reg.reference_url}.`,
      evidence: { topic_key: draft.topic_key, lock_mode: "strict" },
      suggested_action: `Basculer vers le workflow “update existing page” sur ${reg.reference_url}.`,
      confidence: 0.92,
    });
    return { score: 0, flags, reasons, metrics };
  }

  if (top) {
    if (max_sim >= cfg.similarity.high_post) {
      flags.push({ code: "HIGH_CANNIBALIZATION_POST", severity: "BLOCK_FLAG", gate: "SCORING", related_urls: [top.url] });
      reasons.push({
        rule_id: "B1_TOP_SIMILARITY",
        dimension: "B",
        severity: "BLOCK_FLAG",
        message: `Trop proche de ${top.url}.`,
        evidence: { similarity: max_sim, competing_page_id: top.page_id },
        suggested_action: `Enrichir ${top.url} (recommandé) ou différencier l’angle avec contrainte.`,
        confidence: 0.85,
      });
    } else if (max_sim >= cfg.similarity.medium_low && max_sim <= cfg.similarity.medium_high) {
      flags.push({ code: "MEDIUM_CANNIBALIZATION", severity: "REVIEW_FLAG", gate: "SCORING", related_urls: [top.url] });
      reasons.push({
        rule_id: "B1_TOP_SIMILARITY",
        dimension: "B",
        severity: "REVIEW_FLAG",
        message: `Risque de collision avec ${top.url}.`,
        evidence: { similarity: max_sim, competing_page_id: top.page_id },
        suggested_action: `Arbitrer : enrichir ${top.url} OU différencier l’angle.`,
        confidence: 0.78,
      });
    }

    const ov = top.overlap_intent_score;
    metrics.overlap_intent_score = ov;
    if (ov >= cfg.similarity.intent_overlap_reinforce && max_sim >= cfg.similarity.medium_low) {
      reasons.push({
        rule_id: "B2_INTENT_OVERLAP",
        dimension: "B",
        severity: max_sim >= cfg.similarity.high_post ? "BLOCK_FLAG" : "REVIEW_FLAG",
        message: `Même intention probable que ${top.url} → cannibalisation renforcée.`,
        evidence: { overlap_intent: ov, similarity: max_sim },
        suggested_action: "Changer l’angle ou choisir enrichissement de la page existante.",
        confidence: 0.8,
      });
    }
  }

  const scoreB = clamp100(100 * (1 - max_sim));
  return { score: scoreB, flags, reasons, metrics };
}

// C — Value density (normalized 0..100 subscores)
export function evalC(draft: Draft, cfg: any): EvaluatorOutput {
  const flags: AtlasFlag[] = [];
  const reasons: AtlasReason[] = [];
  const metrics: any = {};
  const t = draft.content.toLowerCase();

  // C1 QA coverage proxy -> 0..100
  const qaHits = [
    /étapes|step|comment faire|checklist/i,
    /erreurs|pièges|à éviter/i,
    /exemple|cas concret|scénario/i,
    /coût|prix|budget|tarif/i,
    /critères|comment choisir|points à vérifier/i,
  ].reduce((acc, r) => acc + (r.test(t) ? 1 : 0), 0);
  metrics.qa_hits = qaHits;

  let c1 = qaHits >= 4 ? 100 : qaHits === 3 ? 80 : qaHits === 2 ? 60 : qaHits === 1 ? 35 : 0;
  if (qaHits <= 1) {
    reasons.push({
      rule_id: "C1_QA_COVERAGE",
      dimension: "C",
      severity: "WARN_SIGNAL",
      message: "Couverture de réponses concrètes insuffisante.",
      evidence: { qa_hits: qaHits },
      suggested_action: "Ajouter étapes, erreurs, critères, coûts, exemples.",
      confidence: 0.7,
    });
  }

  // C2 examples -> 0..100
  const exampleCount = (t.match(/exemple|cas concret|scénario/g) || []).length;
  metrics.example_count = exampleCount;
  let c2 = exampleCount >= 2 ? 100 : exampleCount === 1 ? 60 : 0;
  if (exampleCount === 0) {
    reasons.push({
      rule_id: "C2_EXAMPLES_SPECIFICITY",
      dimension: "C",
      severity: "WARN_SIGNAL",
      message: "Aucun exemple concret détecté.",
      evidence: { example_count: 0 },
      suggested_action: "Ajouter au moins 2 exemples concrets adaptés au site.",
      confidence: 0.75,
    });
  }

  // C3 filler ratio -> 0..100 (higher filler => lower score)
  const fillerMarkers = [/dans cet article/i, /il est important de/i, /en conclusion/i, /de nos jours/i, /nous allons voir/i, /en somme/i];
  const fillerHits = fillerMarkers.reduce((acc, r) => acc + (r.test(t) ? 1 : 0), 0);
  const approxParagraphs = Math.max(1, (draft.content.match(/\n\n+/g) || []).length);
  const filler_ratio = Math.min(1, fillerHits / approxParagraphs);
  metrics.filler_ratio = filler_ratio;

  let c3 = 100 - Math.round(filler_ratio * 100);
  if (filler_ratio >= cfg.generic.filler_block_candidate) {
    c3 = 30;
    reasons.push({
      rule_id: "C3_FILLER_RATIO",
      dimension: "C",
      severity: "WARN_SIGNAL",
      message: "Ratio de paragraphes génériques élevé.",
      evidence: { filler_ratio },
      suggested_action: "Remplacer les formulations génériques par des éléments spécifiques + preuves.",
      confidence: 0.7,
    });
  } else if (filler_ratio >= cfg.generic.filler_warn) {
    c3 = 60;
  }

  const score = clamp100(0.4 * c1 + 0.3 * c2 + 0.3 * c3);
  return { score, flags, reasons, metrics };
}

// D — Ecosystem (site-new safe)
export function evalD(draft: Draft, snap: Snapshot, cfg: any): EvaluatorOutput {
  const flags: AtlasFlag[] = [];
  const reasons: AtlasReason[] = [];
  const metrics: any = {};

  const snapshotPoor = snap.snapshot_quality === "poor";
  // proxy: if snapshot is poor, we can't assert mismatch; we downgrade to REVIEW/WARN
  const theme_fit_score = snap.top_matches && snap.top_matches.length > 0 ? 0.7 : snapshotPoor ? 0.55 : 0.4;
  metrics.theme_fit_score = theme_fit_score;

  if (!snapshotPoor && theme_fit_score < cfg.ecosystem.theme_fit_block) {
    flags.push({ code: "SITE_ECOSYSTEM_MISMATCH", severity: "BLOCK_FLAG", gate: "SCORING" });
    reasons.push({
      rule_id: "D1_THEMATIC_FIT",
      dimension: "D",
      severity: "BLOCK_FLAG",
      message: "Incohérence thématique : risque de pollution de l’écosystème du site.",
      evidence: { theme_fit_score },
      suggested_action: "Repositionner l’angle dans un cluster existant OU abandonner le sujet.",
      confidence: 0.75,
    });
    return { score: 0, flags, reasons, metrics };
  }

  if (snapshotPoor && theme_fit_score < cfg.ecosystem.theme_fit_block) {
    flags.push({ code: "ANGLE_UNCERTAIN", severity: "REVIEW_FLAG", gate: "SCORING" });
    reasons.push({
      rule_id: "D1_THEMATIC_FIT",
      dimension: "D",
      severity: "REVIEW_FLAG",
      message: "Snapshot pauvre : fit thématique incertain → validation recommandée.",
      evidence: { theme_fit_score, snapshot_quality: "poor" },
      suggested_action: "Valider manuellement le fit thématique ou attendre un snapshot plus riche.",
      confidence: 0.7,
    });
  }

  if (draft.role === "pillar") {
    flags.push({ code: "PILLAR_CREATION", severity: "REVIEW_FLAG", gate: "SCORING" });
    reasons.push({
      rule_id: "D2_ROLE_COHERENCE",
      dimension: "D",
      severity: "REVIEW_FLAG",
      message: "Création de page pilier → validation humaine obligatoire.",
      suggested_action: "Faire valider la structure et la profondeur attendue d’une page pilier.",
      confidence: 0.9,
    });
  }

  const clusterId = draft.cluster_id;
  if (clusterId) {
    const ch = snap.cluster_history.find((c) => c.cluster_id === clusterId);
    if (ch) {
      const cap = ch.cap_30d ?? snap.site_policies?.cluster_caps?.[clusterId] ?? null;
      if (cap !== null && ch.published_count_30d >= cap) {
        flags.push({ code: "CLUSTER_SATURATING", severity: "WARN_SIGNAL", gate: "SCORING" });
        reasons.push({
          rule_id: "D3_CLUSTER_SATURATION",
          dimension: "D",
          severity: "WARN_SIGNAL",
          message: "Cluster proche ou au plafond → recommandation de replanification.",
          evidence: { cluster_id: clusterId, published_count_30d: ch.published_count_30d, cap_30d: cap },
          suggested_action: "Replanifier (DELAY) ou choisir un autre cluster moins saturé.",
          confidence: 0.8,
        });
      }
    }
  }

  const score = clamp100(theme_fit_score * 100);
  return { score, flags, reasons, metrics };
}

// E — Readability & credibility (block requires combination)
export function evalE(draft: Draft, snap: Snapshot, cfg: any): EvaluatorOutput {
  const flags: AtlasFlag[] = [];
  const reasons: AtlasReason[] = [];
  const metrics: any = {};
  const t = draft.content.toLowerCase();

  const roboticMarkers = [/dans cet article/i, /il est important de/i, /nous allons voir/i, /en conclusion/i];
  const roboticCount = roboticMarkers.reduce((acc, r) => acc + (r.test(t) ? 1 : 0), 0);
  metrics.robotic_marker_count = roboticCount;

  const repetitionProxy = Math.min(1, ((t.match(/il est important de/g) || []).length) / 5);
  const generic_score = Math.min(1, 0.5 * repetitionProxy + 0.5 * (roboticCount > 1 ? 0.7 : 0.3));
  metrics.generic_score = generic_score;

  // combination gate: generic + filler + low examples -> block
  const filler_ratio = snap?.top_matches ? undefined : undefined; // filler computed in C; we do not recompute here.
  const exampleCount = (t.match(/exemple|cas concret|scénario/g) || []).length;
  metrics.example_count = exampleCount;

  const genericBlockCandidate = generic_score >= cfg.generic.generic_block;
  const lowExamples = exampleCount === 0;
  const strongRobotic = roboticCount >= 2;

  if (genericBlockCandidate && (lowExamples || strongRobotic)) {
    flags.push({ code: "GENERIC_CONTENT", severity: "BLOCK_FLAG", gate: "SCORING" });
    reasons.push({
      rule_id: "E2_GENERIC_PATTERN",
      dimension: "E",
      severity: "BLOCK_FLAG",
      message: "Contenu jugé générique (patterns + faible crédibilité).",
      evidence: { generic_score, robotic_markers: roboticCount, example_count: exampleCount },
      suggested_action: "Ajouter nuances + objections + exemples concrets + vocabulaire métier. Réécrire les passages robotisés.",
      confidence: 0.8,
    });
    return { score: 0, flags, reasons, metrics };
  }

  if (generic_score >= cfg.generic.generic_review_low) {
    flags.push({ code: "LOW_EVIDENCE_DEPTH", severity: "REVIEW_FLAG", gate: "SCORING" });
    reasons.push({
      rule_id: "E2_GENERIC_PATTERN",
      dimension: "E",
      severity: "REVIEW_FLAG",
      message: "Crédibilité perfectible : signaux génériques détectés.",
      evidence: { generic_score, robotic_markers: roboticCount },
      suggested_action: "Renforcer expertise (nuances, objections, vocabulaire métier) + ajouter exemples.",
      confidence: 0.75,
    });
  }

  const score = clamp100((1 - generic_score) * 100);
  return { score, flags, reasons, metrics };
}

// F — SEO structure
export function evalF(draft: Draft): EvaluatorOutput {
  const flags: AtlasFlag[] = [];
  const reasons: AtlasReason[] = [];
  const metrics: any = {};

  const h1Count = (draft.content.match(/<h1[\s>]/gi) || []).length;
  metrics.h1_count = h1Count;

  if (h1Count > 1) {
    flags.push({ code: "STRUCTURE_WEAK", severity: "WARN_SIGNAL", gate: "SCORING" });
    reasons.push({
      rule_id: "F1_HN_HIERARCHY",
      dimension: "F",
      severity: "WARN_SIGNAL",
      message: "Plus d’un H1 détecté.",
      evidence: { h1_count: h1Count },
      suggested_action: "Conserver 1 seul H1, structurer ensuite en H2/H3.",
      confidence: 0.7,
    });
  }

  const vague = (draft.content.match(/<h2[^>]*>\s*(à savoir|conclusion|introduction)\s*<\/h2>/gi) || []).length;
  metrics.vague_h2 = vague;

  if (vague > 0) {
    flags.push({ code: "STRUCTURE_WEAK", severity: "WARN_SIGNAL", gate: "SCORING" });
    reasons.push({
      rule_id: "F2_HEADING_QUALITY",
      dimension: "F",
      severity: "WARN_SIGNAL",
      message: "Titres H2 trop vagues détectés.",
      evidence: { vague_h2: vague },
      suggested_action: "Remplacer les titres vagues par des titres informatifs.",
      confidence: 0.7,
    });
  }

  const hasLinks = /href=/.test(draft.content);
  metrics.has_links = hasLinks;
  if (!hasLinks) {
    flags.push({ code: "INTERNAL_LINK_OPPORTUNITY", severity: "INFO_SIGNAL", gate: "SCORING" });
    reasons.push({
      rule_id: "F3_INTERNAL_LINKING",
      dimension: "F",
      severity: "INFO_SIGNAL",
      message: "Aucun lien interne détecté.",
      suggested_action: "Ajouter 2–3 liens internes vers pages pertinentes.",
      confidence: 0.6,
    });
  }

  const score = clamp100(100 - (h1Count > 1 ? 15 : 0) - (vague > 0 ? 10 : 0) - (!hasLinks ? 5 : 0));
  return { score, flags, reasons, metrics };
}
