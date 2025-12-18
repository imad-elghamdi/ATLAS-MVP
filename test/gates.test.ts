import ruleset from "../rulesets/atlas.v1.0.json";
import { gateG0, gateG2, gateG1, computeAtlasScore } from "../src/atlas/gates";

test("G0 blocks if intent missing", () => {
  const out = gateG0({});
  expect(out.decision).toBe("BLOCK");
  expect(out.flags[0].code).toBe("INTENTION_MISSING");
});

test("G2 blocks strict duplication", () => {
  const topic_key = "tk";
  const out = gateG2(topic_key, [{ topic_key, lock_mode:"strict", reference_url:"https://site/page" } as any]);
  expect(out.decision).toBe("BLOCK");
  expect(out.flags[0].code).toBe("TOPIC_DUPLICATION_STRICT");
});

test("G1 uses high_pre", () => {
  const cfg:any = ruleset;
  // sim_score above high_pre must BLOCK
  const out = gateG1({ url:"https://x", sim_score: cfg.similarity.high_pre + 0.01, overlap_intent_score:0.5 }, cfg);
  expect(out.decision).toBe("BLOCK");
  expect(out.flags[0].code).toBe("HIGH_CANNIBALIZATION_PRE");
});

test("G5 override BLOCK on duplication/intention missing even if score_total high", () => {
  const cfg:any = ruleset;

  const draft:any = {
    title: "Guide",
    content: "<article><h1>Guide</h1><p>Exemple cas concret. Étapes. Critères. Prix.</p></article>",
    primary_intent: "informational",
    role: "unknown",
    topic_key: "topic-1"
  };

  const snap:any = {
    site_policies: { high_stakes: false },
    content_registry: [{ topic_key: "topic-1", lock_mode:"strict", reference_url:"https://site/existing" }],
    cluster_history: [],
    top_matches: [],
    snapshot_quality: "normal"
  };

  const out = computeAtlasScore(draft, snap, cfg);
  // even if content is good, duplication strict must force BLOCK
  expect(out.score_total).toBeGreaterThan(0);
  expect(out.decision).toBe("BLOCK");
  expect(out.flags.some((f:any)=>f.code==="TOPIC_DUPLICATION_STRICT")).toBe(true);
});
