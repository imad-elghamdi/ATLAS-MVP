export type Severity = "BLOCK_FLAG" | "REVIEW_FLAG" | "WARN_SIGNAL" | "INFO_SIGNAL";
export type Gate = "G0" | "G1" | "G2" | "G3" | "G4" | "G5" | "G6" | "SCORING";

export type Intent = "informational" | "comparative" | "transactional" | "navigational" | "support";

export type AtlasFlagCode =
  | "INTENTION_MISSING"
  | "TOPIC_DUPLICATION_STRICT"
  | "HIGH_CANNIBALIZATION_PRE"
  | "OVERPUBLISHING_HARD"
  | "GENERIC_CONTENT"
  | "SITE_ECOSYSTEM_MISMATCH"
  | "HIGH_CANNIBALIZATION_POST"
  | "INTENTION_DRIFT"
  | "MEDIUM_CANNIBALIZATION"
  | "PILLAR_CREATION"
  | "HIGH_STAKES_SITE"
  | "ANGLE_UNCERTAIN"
  | "LOW_EVIDENCE_DEPTH"
  | "STRUCTURE_WEAK"
  | "INTERNAL_LINK_OPPORTUNITY"
  | "CLUSTER_SATURATING";

export type AtlasFlag = {
  code: AtlasFlagCode;
  severity: Severity;
  gate: Gate;
  details?: any;
  related_urls?: string[];
};

export type AtlasReason = {
  rule_id: string;
  dimension?: "A" | "B" | "C" | "D" | "E" | "F";
  severity: Severity;
  message: string;
  evidence?: any;
  suggested_action: string;
  confidence: number; // 0..1
};

export type AtlasScoringOutput = {
  ruleset_version: string;
  inputs_hash: string;
  timestamp: string;

  score_total: number;
  scores_dimensions: { A: number; B: number; C: number; D: number; E: number; F: number };

  flags: AtlasFlag[];
  reasons: AtlasReason[];

  decision: "BLOCK" | "REVIEW" | "PASS" | "PREMIUM";
};
