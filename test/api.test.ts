import request from "supertest";
import createApp from "../src/app";

test("GET /v1/rulesets/current returns v1.0", async () => {
  const app = createApp();
  const res = await request(app)
    .get("/v1/rulesets/current")
    .set("Authorization","Bearer dev")
    .expect(200);
  expect(res.body.active).toBe("atlas.v1.0");
  expect(res.body.ruleset.version).toBe("v1.0");
});
