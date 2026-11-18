import { deskStatus, reviewFrame } from "../../../fixtures/applications.ts";
import { requireUser } from "../../../identity/session.ts";
import { ApplicationsDesk } from "./filters.tsx";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    entered?: string | string[];
    review?: string | string[];
    status?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const entered = first(params.entered) === "1";
  const email = (await requireUser()).email;
  return (
    <ApplicationsDesk
      email={email}
      entered={entered}
      review={reviewFrame(first(params.review))}
      status={deskStatus(first(params.status))}
    />
  );
}
