import assert from "node:assert/strict";
import test from "node:test";
import { classifyMail, type MailMessage } from "../../src/lodge/classify.ts";
import { reviewStages } from "../../src/lodge/stages.ts";

function message(
  subject: string,
  snippet = "",
  fromAddress = "jobs@acme.com",
): MailMessage {
  return {
    id: "m",
    fromName: "Hiring",
    fromAddress,
    subject,
    snippet,
    url: "https://mail.google.com/mail/u/0/#all/m",
    at: new Date("2026-11-01T15:00:00Z"),
  };
}

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

test("a company domain and an offer subject become one offer", () => {
  const row = classifyMail(message("Your offer for the Design role"));
  assert.equal(row?.company, "Acme");
  assert.equal(row?.role, "Design");
  assert.equal(row?.stage, "offer");
  assert.equal(row?.needsReview, false);
  assert.equal(row?.positive, true);
});

test("application-shaped mail without a template asks for review", () => {
  const row = classifyMail(
    message("About your application", "We would like a little more time."),
  );
  assert.equal(row?.needsReview, true);
  assert.equal(row?.stage, "applied");
  assert.equal(row?.positive, false);
});

test("ordinary mail is skipped", () => {
  assert.equal(
    classifyMail(message("Lunch tomorrow", "See you at noon")),
    null,
  );
});

test("interest mail is not an application unless it names your application", () => {
  assert.equal(
    classifyMail(
      message(
        "Thank you for your interest in Kohl's!",
        "You can review your application in the portal.",
        "alerts@careers.kohls.com",
      ),
    ),
    null,
  );
});

test("a job board digest is not an application", () => {
  assert.equal(
    classifyMail(
      message(
        "Data Science Intern jobs in New York, NY, posted November 22",
        "CapitalG and NYU Langone Health are hiring now",
        "lensa24@lensa.com",
      ),
    ),
    null,
  );
  assert.equal(
    classifyMail(
      message(
        "Would you pass a System Design interview today?",
        "The loop evolved.",
        "fahim.u@educative.io",
      ),
    ),
    null,
  );
});

test("an IBM intern offer is one summer application, not a rejection", () => {
  const row = classifyMail(
    message(
      "RE: Intern Data Scientist 2027 Offer: Question About Start Date",
      "Unfortunately, May 24 is the only cohort start date available for our interns",
      "belindaw@ibm.com",
    ),
  );
  assert.equal(row?.company, "IBM");
  assert.equal(row?.role, "Intern Data Scientist");
  assert.equal(row?.stage, "offer");
  assert.equal(row?.cycle, "Summer 2027");
  assert.equal(
    classifyMail(
      message(
        "Intern Data Scientist 2027 Offer: Question About Start Date",
        "Thank you for the offer to join IBM",
        "peguerojoshua67@gmail.com",
      ),
      "peguerojoshua67@gmail.com",
    ),
    null,
  );
});

test("retail offers and newsletters are not applications", () => {
  assert.equal(
    classifyMail(
      message(
        "LAST CHANCE to use your offer",
        "Today only",
        "hollister@em.hollisterco.com",
      ),
    ),
    null,
  );
  assert.equal(
    classifyMail(
      message(
        "Would you pass a System Design interview today?",
        "The loop evolved.",
        "fahim.u@educative.io",
      ),
    ),
    null,
  );
});

test("a season in either order and an employer in the subject are kept", () => {
  const interview = classifyMail(
    message(
      "Zimmer Biomet Careers: Interview Confirmation for 2027 Summer Intern, Data Mesh Platform",
      "Your interview is confirmed.",
      "interview@scheduling.zimmerbiomet.com",
    ),
  );
  assert.equal(interview?.company, "Zimmer Biomet");
  assert.equal(interview?.cycle, "Summer 2027");
  assert.equal(interview?.stage, "interview-not-done");
  const fall = classifyMail(
    message(
      "Code2Career Fall'26 Application Status Update",
      "We received your application",
      "jobs@projectbasta.com",
    ),
  );
  assert.equal(fall?.cycle, "Fall 2026");
});

test("a named season becomes the cycle filter", () => {
  const row = classifyMail(
    message(
      "Thank you for applying to the Technology Internship for Summer 2027",
      "We received your application",
      "jobs@amway.com",
    ),
  );
  assert.equal(row?.cycle, "Summer 2027");
  assert.equal(row?.stage, "applied");
});
