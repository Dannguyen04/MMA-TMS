import { ClearanceCell } from "@/components/domain/clearance-validity";
import { FighterIdentity } from "@/components/domain/fighter-identity";
import { HealthStatusBadge } from "@/components/domain/status-badges";
import { EmptyState } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { routes } from "@/lib/routes";
import type { FighterHealthSummary } from "@/lib/services/medical";
import { ActiveInjuryCell, FollowUpCell } from "./patient-cells";
import { PatientCard } from "./patient-card";

export interface RosterHealthBoardProps {
    summaries: FighterHealthSummary[];
    /** Server time (ISO). */
    now: string;
    warningDays: number;
}

/** Every assigned fighter at a glance: identity, health, clearance and validity, open injury and next follow-up. */
export function RosterHealthBoard({ summaries, now, warningDays }: RosterHealthBoardProps) {
    if (summaries.length === 0) {
        return (
            <EmptyState
                compact
                title="No fighters assigned yet"
                description="When an administrator assigns fighters to you, their health and clearance appear here."
            />
        );
    }

    return (
        <>
            <div className="hidden md:block">
                <Table caption="Roster health board">
                    <THead>
                        <tr>
                            <TH>Fighter</TH>
                            <TH>Health</TH>
                            <TH>Medical Clearance</TH>
                            <TH>Active injury</TH>
                            <TH>Next follow-up</TH>
                        </tr>
                    </THead>
                    <TBody>
                        {summaries.map((summary) => (
                            <TR key={summary.fighter.id}>
                                <TD className="min-w-56">
                                    <FighterIdentity fighter={summary.fighter} size="sm" href={routes.doctor.fighter(summary.fighter.id)} />
                                </TD>
                                <TD>
                                    <HealthStatusBadge status={summary.fighter.healthStatus} size="sm" />
                                </TD>
                                <TD className="min-w-48">
                                    <ClearanceCell clearance={summary.clearance} state={summary.clearanceState} now={now} warningDays={warningDays} />
                                </TD>
                                <TD className="min-w-44">
                                    <ActiveInjuryCell injuries={summary.activeInjuries} />
                                </TD>
                                <TD className="min-w-36">
                                    <FollowUpCell followUp={summary.nextFollowUp} />
                                </TD>
                            </TR>
                        ))}
                    </TBody>
                </Table>
            </div>
            <ul className="grid grid-cols-1 gap-3 px-4 pb-4 md:hidden">
                {summaries.map((summary) => (
                    <li key={summary.fighter.id} className="min-w-0">
                        <PatientCard summary={summary} href={routes.doctor.fighter(summary.fighter.id)} now={now} warningDays={warningDays} />
                    </li>
                ))}
            </ul>
        </>
    );
}
