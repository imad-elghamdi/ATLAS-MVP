export type Decision = "BLOCK" | "REVIEW" | "PASS";

export type FlagSeverity = "BLOCK" | "REVIEW" | "WARN" | "INFO";

export type AtlasFlag = {
  code: string;
  severity: FlagSeverity;
  message: string;
};

export type AtlasReason = {
  message: string;
  action?: string;
};

export type AtlasMetadata = {
  ruleset_version: string;
  inputs_hash: string;
  timestamp: string;
};

export type AtlasDecisionPayload = {
  decision: Decision;
  score_total?: number;
  scores?: Partial<Record<"A" | "B" | "C" | "D" | "E" | "F", number>>;
  flags?: AtlasFlag[];
  reasons: AtlasReason[];
  metadata: AtlasMetadata;
  gate?: string; // pour Precheck (ex: G2)
  gate_label?: string; // label humain (fourni par API, pas calculé)
};
