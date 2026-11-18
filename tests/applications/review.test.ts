import assert from "node:assert/strict";
import test from "node:test";
import {
  applications,
  parseReviews,
  reviewStages,
  withReviews,
} from "../../src/fixtures/applications.ts";

test("the wheel lists one stop for each capability-map stage", () => {
  assert.deepEqual(
    reviewStages.map((stage) => stage.id),
    [
      "applied",
      "oa-not-done",
      "interview-not-done",
      "in-progress",
      "offer",
      "rejected",
    ],
  );
});

test("a saved choice updates the row and leaves the fixture alone", () => {
  const source = applications.find((item) => item.id === "browser-company");
  assert.equal(source?.stageUnchanged, true);

  const confirmed = withReviews(applications, {
    "browser-company": { kind: "confirm", stage: "interview-not-done" },
  });
  assert.equal(confirmed[0]?.id, "browser-company");
  assert.equal(confirmed[0]?.stage, "interview-not-done");
  assert.equal(confirmed[0]?.stageLabel, "Interview not done");
  assert.equal(confirmed[0]?.event, "Stage confirmed by you");
  assert.equal(confirmed[0]?.time, "Just now");
  assert.equal(confirmed[0]?.stageUnchanged, false);
  assert.equal(source?.stage, "applied");
  assert.equal(source?.stageUnchanged, true);

  const stayed = withReviews(applications, {
    "browser-company": { kind: "stay" },
  });
  assert.equal(stayed[4]?.id, "browser-company");
  assert.equal(stayed[4]?.stage, "applied");
  assert.equal(stayed[4]?.stageUnchanged, false);
});

test("review storage ignores a template-shaped payload", () => {
  assert.deepEqual(
    parseReviews({
      "browser-company": {
        kind: "confirm",
        stage: "offer",
        template: "shared",
      },
      other: { kind: "nope" },
    }),
    { "browser-company": { kind: "confirm", stage: "offer" } },
  );
});
