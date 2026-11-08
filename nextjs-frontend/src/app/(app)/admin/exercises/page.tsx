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
import { getTranslator } from "@/lib/i18n/server";
import { EXERCISE_CATEGORY_LABELS } from "@/lib/domain/labels";
import { EXERCISE_CATEGORY_FOR, SERVICE_EXERCISE_CATEGORIES, type ServiceExerciseCategory } from "@/lib/domain/training-contract";
import { missingStarterExercises, STARTER_EXERCISES } from "@/lib/domain/training-templates";
import { plural } from "@/lib/i18n/translate";
import { paginate, parseEnum } from "@/lib/query";
import { routes } from "@/lib/routes";
import { listExerciseCatalog } from "@/lib/services/training";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Exercise library" };

const PAGE_SIZE = 20;

const categoryLabel = (category: ServiceExerciseCategory) => EXERCISE_CATEGORY_LABELS[EXERCISE_CATEGORY_FOR[category]];

export default async function AdminExercisesPage({ searchParams }: PageProps<"/admin/exercises">) {
    const { t } = await getTranslator();
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
                title={t("screens.misc.adminPages.exercises.title")}
                description={
                    <>
                        {t("adminBody.exercises.leadBefore")}
                        <Term term="exerciseLibrary">{t("adminBody.exercises.library")}</Term>
                        {t("adminBody.exercises.leadAfter")}
                    </>
                }
                actions={<AddExerciseButton />}
            />
            <div className="flex flex-col gap-6">
                <StarterLibraryImport missing={missing} total={STARTER_EXERCISES.length} />

                <div className="flex flex-col gap-4">
                    <FilterBar
                        label={t("adminBody.exercises.filter")}
                        filters={[
                            { type: "search", name: "q", label: t("adminBody.exercises.search"), placeholder: t("adminBody.exercises.placeholder") },
                            { type: "select", name: "category", label: t("adminBody.exercises.categories"), options: SERVICE_EXERCISE_CATEGORIES.map((value) => ({ value, label: categoryLabel(value) })) },
                        ]}
                    />
                    <Card className="overflow-hidden">
                        <CardHeader
                            title={filtered ? plural(t, "adminBody.exercises.matching", exercises.length) : plural(t, "adminBody.exercises.count", library.length)}
                            description={filtered ? t("adminBody.exercises.outOf", { n: library.length }) : t("adminBody.exercises.sorted")}
                            icon={<Dumbbell />}
                        />
                        {page.total === 0 ? (
                            <CardContent>
                                {filtered ? (
                                    <EmptyState
                                        compact
                                        title={t("screens.misc.adminPages.exercises.noneMatch")}
                                        description={t("screens.misc.adminPages.exercises.tryAnother")}
                                        action={
                                            <ButtonLink href={pathname} variant="secondary" size="sm">
                                                {t("adminBody.exercises.clear")}
                                            </ButtonLink>
                                        }
                                    />
                                ) : (
                                    <EmptyState
                                        compact
                                        icon={<Dumbbell />}
                                        title={t("screens.misc.adminPages.exercises.empty")}
                                        description={t("adminBody.exercises.importHint")}
                                    />
                                )}
                            </CardContent>
                        ) : (
                            <div className="border-t border-border">
                                <Table caption={t("adminBody.exercises.caption")}>
                                    <THead>
                                        <tr>
                                            <TH>{t("adminBody.exercises.exercise")}</TH>
                                            <TH>{t("adminBody.exercises.category")}</TH>
                                            <TH>{t("adminBody.exercises.muscles")}</TH>
                                            <TH>
                                                <span className="sr-only">{t("adminBody.exercises.video")}</span>
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
                                                    {exercise.targetMuscleGroups.length > 0 ? exercise.targetMuscleGroups.join(", ") : <span className="text-fg-subtle">{t("adminBody.exercises.notSet")}</span>}
                                                </TD>
                                                <TD className="text-right whitespace-nowrap">
                                                    {exercise.videoUrl && (
                                                        <a
                                                            href={exercise.videoUrl}
                                                            target="_blank"
                                                            rel="noreferrer noopener"
                                                            className="inline-flex items-center gap-1 text-[13px] font-medium text-primary-soft-fg hover:underline"
                                                        >
                                                            {t("adminBody.exercises.video")}
                                                            <ExternalLink aria-hidden className="size-3.5" />
                                                            <span className="sr-only">{t("adminBody.exercises.opens", { name: exercise.name })}</span>
                                                        </a>
                                                    )}
                                                </TD>
                                            </TR>
                                        ))}
                                    </TBody>
                                </Table>
                                <Pagination page={page.page} pageCount={page.pageCount} total={page.total} pageSize={PAGE_SIZE} pathname={pathname} searchParams={params} itemLabel={t("adminBody.exercises.item")} />
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </>
    );
}
