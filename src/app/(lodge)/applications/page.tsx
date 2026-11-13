import { requireUser } from "../../../identity/session.ts";
import { ApplicationsDesk } from "./filters.tsx";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ entered?: string | string[] }>;
}) {
  const entered = first((await searchParams).entered) === "1";
  const email = (await requireUser()).email;
  return <ApplicationsDesk email={email} entered={entered} />;
}
