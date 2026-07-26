import "server-only";
import { getPayStubs, getDocuments, getPlaidConnections } from "@/lib/data";
import { getPeople, type Person } from "@/lib/people";
import { stubsByMonth } from "@/lib/model/engine";

// ===========================================================================
// Finances split by person, and combined.
//
// Two people bring separate income, statements and accounts. The household
// total is what the plan runs on, but each partner needs to see their own
// contribution without arithmetic. Every figure here is derived from records
// actually attributed to that person — nothing is apportioned or guessed.
// ===========================================================================

export interface PersonFinances {
  person: Person;
  stubCount: number;
  documentCount: number;
  bankCount: number;
  totalNet: number;
  totalGross: number;
  monthsLogged: number;
  /** Mean take-home across the months this person actually logged. */
  avgMonthlyNet: number | null;
  /** Share of household net income, 0..1. Null when the household has none. */
  shareOfNet: number | null;
  lastPayDate: string | null;
}

export interface HouseholdFinances {
  people: PersonFinances[];
  combined: {
    totalNet: number;
    totalGross: number;
    stubCount: number;
    monthsLogged: number;
    avgMonthlyNet: number | null;
  };
  /** True once more than one person has actually logged something. */
  hasSplit: boolean;
}

export async function getHouseholdFinances(
  householdId: string,
  currentUserId: string,
): Promise<HouseholdFinances> {
  const [people, stubs, docs, banks] = await Promise.all([
    getPeople(householdId, currentUserId),
    getPayStubs(householdId),
    getDocuments(householdId),
    getPlaidConnections(householdId),
  ]);

  const householdNet = stubs.reduce(
    (sum, s) => sum + (Number(s.net_amount) || 0),
    0,
  );

  const perPerson: PersonFinances[] = people.map((person) => {
    const mine = stubs.filter((s) => s.member_user_id === person.userId);
    const months = stubsByMonth(mine);
    const totalNet = mine.reduce((sum, s) => sum + (Number(s.net_amount) || 0), 0);
    const totalGross = mine.reduce(
      (sum, s) => sum + (Number(s.gross_amount) || 0),
      0,
    );

    return {
      person,
      stubCount: mine.length,
      documentCount: docs.filter((d) => d.uploaded_by === person.userId).length,
      bankCount: banks.filter((b) => b.owner_user_id === person.userId).length,
      totalNet: Math.round(totalNet),
      totalGross: Math.round(totalGross),
      monthsLogged: months.length,
      avgMonthlyNet:
        months.length > 0
          ? Math.round(months.reduce((s, m) => s + m.net, 0) / months.length)
          : null,
      shareOfNet: householdNet > 0 ? totalNet / householdNet : null,
      lastPayDate: mine[0]?.pay_date ?? null,
    };
  });

  const combinedMonths = stubsByMonth(stubs);

  return {
    people: perPerson,
    combined: {
      totalNet: Math.round(householdNet),
      totalGross: Math.round(
        stubs.reduce((sum, s) => sum + (Number(s.gross_amount) || 0), 0),
      ),
      stubCount: stubs.length,
      monthsLogged: combinedMonths.length,
      avgMonthlyNet:
        combinedMonths.length > 0
          ? Math.round(
              combinedMonths.reduce((s, m) => s + m.net, 0) /
                combinedMonths.length,
            )
          : null,
    },
    hasSplit: perPerson.filter((p) => p.stubCount > 0).length > 1,
  };
}
