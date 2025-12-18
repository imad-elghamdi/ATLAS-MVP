import { Router } from "express";
import { z } from "zod";
import { Errors } from "./http/errors";
import { pool } from "./db/client";
import ruleset_v1 from "../rulesets/atlas.v1.0.json";
import { normalizeTopicKey } from "./atlas/topicKey";
import type { Intent } from "./atlas/types";
import { precheck, computeAtlasScore } from "./atlas/gates";

const activeRuleset = ruleset_v1 as any;

const intentEnum = z.enum(["informational","comparative","transactional","navigational","support"]);

function snapshotQuality(topMatchesLen: number) {
  return topMatchesLen <= 0 ? "poor" : "normal";
}

export function buildRoutes() {
  const r = Router();

  // --- rulesets ---
  r.get("/v1/rulesets/current", (_req, res) => {
    res.json({ active: "atlas.v1.0", ruleset: activeRuleset });
  });

  // --- minimal site create (utility) ---
  r.post("/v1/sites", async (req, res, next) => {
    try {
      const schema = z.object({
        workspace_id: z.string().uuid(),
        cms_type: z.enum(["wordpress","shopify"]),
        locale: z.string().default("fr-FR"),
        timezone: z.string().default("Europe/Paris"),
        seo_plugin: z.string().optional(),
        policies: z.record(z.any()).optional()
      });
      const body = schema.parse(req.body);
      const q = await pool.query(
        "insert into sites(workspace_id,cms_type,locale,timezone,seo_plugin,policies) values($1,$2,$3,$4,$5,$6) returning *",
        [body.workspace_id, body.cms_type, body.locale, body.timezone, body.seo_plugin || null, body.policies ? JSON.stringify(body.policies) : "{}"]
      );
      res.status(201).json(q.rows[0]);
    } catch (e: any) {
      next(Errors.validation(e?.errors || e));
    }
  });

  // --- snapshot pages upsert ---
  r.post("/v1/snapshot/pages/upsert", async (req, res, next) => {
    try {
      const schema = z.object({
        site_id: z.string().uuid(),
        url: z.string().min(1),
        slug: z.string().optional(),
        title: z.string().optional(),
        h1: z.string().optional(),
        status: z.enum(["live","draft","archived"]).optional(),
        last_modified_at: z.string().datetime().optional(),
        cluster_id: z.string().optional(),
        role: z.enum(["pillar","cluster","support","unknown"]).optional(),
        primary_intent: intentEnum.optional(),
        topic_key: z.string().optional()
      });
      const body = schema.parse(req.body);

      const q = await pool.query(
        `insert into site_pages(site_id,url,slug,title,h1,status,last_modified_at,cluster_id,role,primary_intent,topic_key)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         on conflict (site_id,url) do update set
           slug=excluded.slug,
           title=excluded.title,
           h1=excluded.h1,
           status=excluded.status,
           last_modified_at=excluded.last_modified_at,
           cluster_id=excluded.cluster_id,
           role=excluded.role,
           primary_intent=excluded.primary_intent,
           topic_key=excluded.topic_key
         returning *`,
        [
          body.site_id,
          body.url,
          body.slug || null,
          body.title || null,
          body.h1 || null,
          body.status || "live",
          body.last_modified_at ? new Date(body.last_modified_at) : null,
          body.cluster_id || null,
          body.role || "unknown",
          body.primary_intent || "unknown",
          body.topic_key || null
        ]
      );
      res.status(200).json(q.rows[0]);
    } catch (e: any) {
      next(Errors.validation(e?.errors || e));
    }
  });

  // --- registry upsert ---
  r.post("/v1/registry/upsert", async (req, res, next) => {
    try {
      const schema = z.object({
        site_id: z.string().uuid(),
        topic_key: z.string().min(1),
        reference_page_id: z.string().uuid(),
        primary_intent: intentEnum,
        cluster_id: z.string().optional(),
        lock_mode: z.enum(["strict","soft"]).default("strict")
      });
      const body = schema.parse(req.body);

      const q = await pool.query(
        `insert into content_registry(site_id,topic_key,reference_page_id,primary_intent,cluster_id,lock_mode)
         values($1,$2,$3,$4,$5,$6)
         on conflict (site_id, topic_key) do update set
           reference_page_id=excluded.reference_page_id,
           primary_intent=excluded.primary_intent,
           cluster_id=excluded.cluster_id,
           lock_mode=excluded.lock_mode
         returning *`,
        [body.site_id, body.topic_key, body.reference_page_id, body.primary_intent, body.cluster_id || null, body.lock_mode]
      );
      res.status(200).json(q.rows[0]);
    } catch (e: any) {
      next(Errors.validation(e?.errors || e));
    }
  });

  // --- atlas events append (append-only) ---
  r.post("/v1/atlas/events/append", async (req, res, next) => {
    try {
      const schema = z.object({
        site_id: z.string().uuid(),
        draft_id: z.string().uuid().optional(),
        job_id: z.string().optional(),
        event_type: z.enum(["SCORE_COMPUTED","DECISION_MADE","GATE_BLOCKED","GATE_DELAYED","GATE_REVIEW"]),
        payload: z.record(z.any()).default({})
      });
      const body = schema.parse(req.body);

      const q = await pool.query(
        `insert into atlas_events(site_id,draft_id,job_id,event_type,payload) values($1,$2,$3,$4,$5) returning *`,
        [body.site_id, body.draft_id || null, body.job_id || null, body.event_type, JSON.stringify(body.payload)]
      );
      res.status(201).json(q.rows[0]);
    } catch (e: any) {
      next(Errors.validation(e?.errors || e));
    }
  });

  r.get("/v1/atlas/events", async (req, res, next) => {
    try {
      const schema = z.object({
        site_id: z.string().uuid(),
        draft_id: z.string().uuid().optional(),
        limit: z.coerce.number().int().min(1).max(200).default(50)
      });
      const qv = schema.parse(req.query);
      const q = await pool.query(
        `select * from atlas_events where site_id=$1 and ($2::uuid is null or draft_id=$2) order by created_at desc limit $3`,
        [qv.site_id, qv.draft_id || null, qv.limit]
      );
      res.json(q.rows);
    } catch (e:any) {
      next(Errors.validation(e?.errors || e));
    }
  });

  // --- atlas precheck (G0-G3 only) ---
  r.post("/v1/atlas/precheck", async (req, res, next) => {
    try {
      const schema = z.object({
        site_id: z.string().uuid(),
        primary_intent: intentEnum.optional(),
        primary_keyword: z.string().min(1),
        cluster_id: z.string().optional(),
        locale: z.string().default("fr-FR")
      });
      const body = schema.parse(req.body);

      const topic_key = normalizeTopicKey(body.primary_keyword, (body.primary_intent as Intent) || "informational", body.locale);

      // snapshot fetch: registry + cluster_history + top_matches placeholder (provided by caller or computed elsewhere)
      const [siteQ, regQ, clusterQ] = await Promise.all([
        pool.query("select * from sites where id=$1", [body.site_id]),
        pool.query(
          `select cr.topic_key, cr.lock_mode, sp.url as reference_url
           from content_registry cr
           join site_pages sp on sp.id = cr.reference_page_id
           where cr.site_id=$1`, [body.site_id]
        ),
        pool.query("select cluster_id, published_count_30d, cap_30d, last_published_at from cluster_history where site_id=$1", [body.site_id])
      ]);

      if (siteQ.rowCount === 0) throw Errors.notFound("Site not found");

      // MVP: allow client to pass top_matches externally; if absent, empty list
      const top_matches = (req.body?.top_matches || []) as any[];

      const snap = {
        site_policies: siteQ.rows[0].policies || {},
        content_registry: regQ.rows,
        cluster_history: clusterQ.rows,
        top_matches,
        snapshot_quality: snapshotQuality(top_matches.length)
      };

      const out = precheck({ primary_intent: body.primary_intent, topic_key, cluster_id: body.cluster_id }, snap as any, activeRuleset);

      // append events for gate outcomes (optional minimal)
      const eventType = out.decision === "BLOCK" ? "GATE_BLOCKED" : out.decision === "DELAY" ? "GATE_DELAYED" : out.decision === "REVIEW" ? "GATE_REVIEW" : null;
      if (eventType) {
        await pool.query(
          "insert into atlas_events(site_id,event_type,payload) values($1,$2,$3)",
          [body.site_id, eventType, JSON.stringify({ decision: out.decision, gates: out.gates, ruleset_version: activeRuleset.version })]
        );
      }

      res.json({ ruleset: "atlas.v1.0", topic_key, ...out });
    } catch (e: any) {
      if (e?.status) return next(e);
      next(Errors.validation(e?.errors || e));
    }
  });

  // --- atlas score (A-F + G4-G6 only) ---
  r.post("/v1/atlas/score", async (req, res, next) => {
    try {
      const schema = z.object({
        site_id: z.string().uuid(),
        title: z.string().min(1),
        content: z.string().min(1),
        meta_title: z.string().optional(),
        meta_description: z.string().optional(),
        slug: z.string().optional(),
        primary_intent: intentEnum,
        secondary_intent: intentEnum.optional(),
        role: z.enum(["pillar","cluster","support","unknown"]).default("unknown"),
        cluster_id: z.string().optional(),
        primary_keyword: z.string().min(1),
        locale: z.string().default("fr-FR"),
        top_matches: z.array(z.object({
          page_id: z.string(),
          url: z.string(),
          sim_score: z.number().min(0).max(1),
          overlap_intent_score: z.number().min(0).max(1)
        })).default([])
      });
      const body = schema.parse(req.body);

      const topic_key = normalizeTopicKey(body.primary_keyword, body.primary_intent as Intent, body.locale);

      const [siteQ, regQ, clusterQ] = await Promise.all([
        pool.query("select * from sites where id=$1", [body.site_id]),
        pool.query(
          `select cr.topic_key, cr.lock_mode, sp.url as reference_url
           from content_registry cr
           join site_pages sp on sp.id = cr.reference_page_id
           where cr.site_id=$1`, [body.site_id]
        ),
        pool.query("select cluster_id, published_count_30d, cap_30d, last_published_at from cluster_history where site_id=$1", [body.site_id])
      ]);
      if (siteQ.rowCount === 0) throw Errors.notFound("Site not found");

      // persist draft first
      const d = await pool.query(
        `insert into drafts(site_id,title,content,meta_title,meta_description,slug,primary_intent,secondary_intent,role,cluster_id,topic_key,generation_version)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *`,
        [
          body.site_id, body.title, body.content,
          body.meta_title || null, body.meta_description || null, body.slug || null,
          body.primary_intent, body.secondary_intent || null,
          body.role, body.cluster_id || null, topic_key,
          "atlas.v1.0"
        ]
      );

      const snap = {
        site_policies: siteQ.rows[0].policies || {},
        content_registry: regQ.rows,
        cluster_history: clusterQ.rows,
        top_matches: body.top_matches,
        snapshot_quality: snapshotQuality(body.top_matches.length)
      };

      const out = computeAtlasScore(
        {
          title: body.title,
          content: body.content,
          meta_title: body.meta_title,
          meta_description: body.meta_description,
          slug: body.slug,
          primary_intent: body.primary_intent as Intent,
          secondary_intent: body.secondary_intent as Intent | undefined,
          role: body.role,
          cluster_id: body.cluster_id,
          topic_key
        } as any,
        snap as any,
        activeRuleset
      );

      // persist atlas_scores
      await pool.query(
        `insert into atlas_scores(draft_id,ruleset_version,score_total,score_a,score_b,score_c,score_d,score_e,score_f,flags,reasons,inputs_hash)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          d.rows[0].id,
          out.ruleset_version,
          out.score_total,
          out.scores_dimensions.A,
          out.scores_dimensions.B,
          out.scores_dimensions.C,
          out.scores_dimensions.D,
          out.scores_dimensions.E,
          out.scores_dimensions.F,
          JSON.stringify(out.flags),
          JSON.stringify(out.reasons),
          out.inputs_hash
        ]
      );

      // append events: SCORE_COMPUTED + DECISION_MADE
      await pool.query(
        "insert into atlas_events(site_id,draft_id,event_type,payload) values($1,$2,$3,$4)",
        [body.site_id, d.rows[0].id, "SCORE_COMPUTED", JSON.stringify({ ruleset_version: out.ruleset_version, inputs_hash: out.inputs_hash, score_total: out.score_total, scores: out.scores_dimensions, flags: out.flags })]
      );
      await pool.query(
        "insert into atlas_events(site_id,draft_id,event_type,payload) values($1,$2,$3,$4)",
        [body.site_id, d.rows[0].id, "DECISION_MADE", JSON.stringify({ decision: out.decision, reasons: out.reasons, ruleset_version: out.ruleset_version, inputs_hash: out.inputs_hash })]
      );

      res.status(201).json({ ruleset: "atlas.v1.0", draft_id: d.rows[0].id, topic_key, ...out });
    } catch (e: any) {
      if (e?.status) return next(e);
      next(Errors.validation(e?.errors || e));
    }
  });

  return r;
}
