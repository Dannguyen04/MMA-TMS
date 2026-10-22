import { Dumbbell, ExternalLink } from "lucide-react";
import type { Metadata } from "next";

import { Term } from "@/components/domain/term-hint";
import { AddExerciseButton, StarterLibraryImport } from "@/components/training/exercise-library-actions";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { Pagination, Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/session";
import { EXERCISE_CATEGORY_LABELS } from "@/lib/domain/labels";
import { EXERCISE_CATEGORY_FOR, SERVICE_EXERCISE_CATEGORIES, type ServiceExerciseCategory } from "@/lib/domain/training-contract";
import { missingStarterExercises, STARTER_EXERCISES } from "@/lib/domain/training-templates";
import { pluralize } from "@/lib/format";
import { paginate, parseEnum } from "@/lib/query";
import { routes } from "@/lib/routes";
import { listExerciseCatalog } from "@/lib/services/training";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Exercise library" };

const PAGE_SIZE = 20;

const categoryLabel = (category: ServiceExerciseCategory) => EXERCISE_CATEGORY_LABELS[EXERCISE_CATEGORY_FOR[category]];

export default async function AdminExercisesPage({ searchParams }: PageProps<"/admin/exercises">) {
    await requireRole("admin");
    const params = await searchParams;
    const pathname = routes.admin.exercises;
    const search = param(params.q)?.trim() || undefined;
    const category = parseEnum(param(params.category), SERVICE_EXERCISE_CATEGORIES);
    const filtered = Boolean(search || category);

    // The service filters by name and category itself; the starter check needs the whole library.
    const [exercises, everything] = await Promise.all([listExerciseCatalog({ search, category }), filtered ? listExerciseCatalog() : null]);
    const library = everything ?? exercises;
    const missing = missingStarterExercises(library).map((exercise) => exercise.name);
    const page = paginate(exercises, param(params.page), PAGE_SIZE);

    return (
        <>
            <PageHeader
                title="Exercise library"
                description={
                    <>
                        The shared <Term term="exerciseLibrary">library</Term> coaches build training plans from. Coaches pick from it; only administrators add to it.
                    </>
                }
                actions={<AddExerciseButton />}
            />
            <div className="flex flex-col gap-6">
                <StarterLibraryImport missing={missing} total={STARTER_EXERCISES.length} />

                <div className="flex flex-col gap-4">
                    <FilterBar
                        label="Filter exercises"
                        filters={[
                            { type: "search", name: "q", label: "Search exercises", placeholder: "Search by name" },
                            { type: "select", name: "category", label: "Categories", options: SERVICE_EXERCISE_CATEGORIES.map((value) => ({ value, label: categoryLabel(value) })) },
                        ]}
                    />
                    <Card className="overflow-hidden">
                        <CardHeader
                            title={filtered ? pluralize(exercises.length, "matching exercise") : pluralize(library.length, "exercise")}
                            description={filtered ? `Out of ${pluralize(library.length, "exercise")} in the library.` : "Sorted by name."}
                            icon={<Dumbbell />}
                        />
                        {page.total === 0 ? (
                            <CardContent>
                                {filtered ? (
                                    <EmptyState
                                        compact
                                        title="No exercises match these filters"
                                        description="Try another name or category."
                                        action={
                                            <ButtonLink href={pathname} variant="secondary" size="sm">
                                                Clear filters
                                            </ButtonLink>
                                        }
                                    />
                                ) : (
                                    <EmptyState
                                        compact
                                        icon={<Dumbbell />}
                                        title="The library is empty"
                                        description="Import the starter library above for the exercises the plan templates use, or add your own."
                                    />
                                )}
                            </CardContent>
                        ) : (
                            <div className="border-t border-border">
                                <Table caption="Exercises in the library">
                                    <THead>
                                        <tr>
                                            <TH>Exercise</TH>
                                            <TH>Category</TH>
                                            <TH>Muscle groups</TH>
                                            <TH>
                                                <span className="sr-only">Video</span>
                                            </TH>
                                        </tr>
                                    </THead>
                                    <TBody>
                                        {page.items.map((exercise) => (
                                            <TR key={exercise.id}>
                                                <TD className="min-w-64">
                                                    <p className="font-medium text-fg">{exercise.name}</p>
                                                    {exercise.description && <p className="mt-0.5 line-clamp-2 max-w-xl text-[13px] text-fg-muted">{exercise.description}</p>}
                                                </TD>
                                                <TD className="whitespace-nowrap text-fg-muted">{categoryLabel(exercise.category)}</TD>
                                                <TD className="min-w-40 text-[13px] text-fg-muted">
                                                    {exercise.targetMuscleGroups.length > 0 ? exercise.targetMuscleGroups.join(", ") : <span className="text-fg-subtle">Not set</span>}
                                                </TD>
                                                <TD className="text-right whitespace-nowrap">
                                                    {exercise.videoUrl && (
                                                        <a
                                                            href={exercise.videoUrl}
                                                            target="_blank"
                                                            rel="noreferrer noopener"
                                                            className="inline-flex items-center gap-1 text-[13px] font-medium text-primary-soft-fg hover:underline"
                                                        >
                                                            Video
                                                            <ExternalLink aria-hidden className="size-3.5" />
                                                            <span className="sr-only">for {exercise.name} (opens in a new tab)</span>
                                                        </a>
                                                    )}
                                                </TD>
                                            </TR>
                                        ))}
                                    </TBody>
                                </Table>
                                <Pagination page={page.page} pageCount={page.pageCount} total={page.total} pageSize={PAGE_SIZE} pathname={pathname} searchParams={params} itemLabel="exercises" />
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </>
    );
}
