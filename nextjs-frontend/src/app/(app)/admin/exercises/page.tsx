import { Dumbbell, ExternalLink } from "lucide-react";
import type { Metadata } from "next";

import { countLabel, splitAround } from "@/components/admin/admin-format";
import { Term } from "@/components/domain/term-hint";
import { AddExerciseButton, StarterLibraryImport } from "@/components/training/exercise-library-actions";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { Pagination, Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/session";
import { exerciseCategoryLabel } from "@/lib/domain/labels";
import { EXERCISE_CATEGORY_FOR, SERVICE_EXERCISE_CATEGORIES, type ServiceExerciseCategory } from "@/lib/domain/training-contract";
import { missingStarterExercises, STARTER_EXERCISES } from "@/lib/domain/training-templates";
import { getTranslator } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n/translate";
import { paginate, parseEnum } from "@/lib/query";
import { routes } from "@/lib/routes";
import { listExerciseCatalog } from "@/lib/services/training";
import { param } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("screens.admin.meta.exercises") };
}

const PAGE_SIZE = 20;

const categoryLabel = (t: Translator, category: ServiceExerciseCategory) => exerciseCategoryLabel(t, EXERCISE_CATEGORY_FOR[category]);

export default async function AdminExercisesPage({ searchParams }: PageProps<"/admin/exercises">) {
    await requireRole("admin");
    const { t, locale } = await getTranslator();
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
    const [descriptionBefore, descriptionAfter] = splitAround(t("screens.admin.exercises.description"), "term");

    return (
        <>
            <PageHeader
                title={t("screens.admin.meta.exercises")}
                description={
                    <>
                        {descriptionBefore}
                        <Term term="exerciseLibrary" locale={locale}>
                            {t("screens.admin.exercises.libraryTerm")}
                        </Term>
                        {descriptionAfter}
                    </>
                }
                actions={<AddExerciseButton />}
            />
            <div className="flex flex-col gap-6">
                <StarterLibraryImport missing={missing} total={STARTER_EXERCISES.length} />

                <div className="flex flex-col gap-4">
                    <FilterBar
                        label={t("screens.admin.exercises.filter")}
                        filters={[
                            { type: "search", name: "q", label: t("screens.admin.exercises.search"), placeholder: t("screens.admin.exercises.searchPlaceholder") },
                            {
                                type: "select",
                                name: "category",
                                label: t("screens.admin.exercises.categories"),
                                options: SERVICE_EXERCISE_CATEGORIES.map((value) => ({ value, label: categoryLabel(t, value) })),
                            },
                        ]}
                    />
                    <Card className="overflow-hidden">
                        <CardHeader
                            title={
                                filtered
                                    ? countLabel(t, "screens.admin.count.matchingExercises", exercises.length)
                                    : countLabel(t, "screens.admin.count.exercises", library.length)
                            }
                            description={
                                filtered
                                    ? t("screens.admin.exercises.outOf", { exercises: countLabel(t, "screens.admin.count.exercises", library.length) })
                                    : t("screens.admin.exercises.sorted")
                            }
                            icon={<Dumbbell />}
                        />
                        {page.total === 0 ? (
                            <CardContent>
                                {filtered ? (
                                    <EmptyState
                                        compact
                                        title={t("screens.admin.exercises.noMatchTitle")}
                                        description={t("screens.admin.exercises.noMatchDescription")}
                                        action={
                                            <ButtonLink href={pathname} variant="secondary" size="sm">
                                                {t("screens.admin.common.clearFilters")}
                                            </ButtonLink>
                                        }
                                    />
                                ) : (
                                    <EmptyState
                                        compact
                                        icon={<Dumbbell />}
                                        title={t("screens.admin.exercises.emptyTitle")}
                                        description={t("screens.admin.exercises.emptyDescription")}
                                    />
                                )}
                            </CardContent>
                        ) : (
                            <div className="border-t border-border">
                                <Table caption={t("screens.admin.exercises.caption")}>
                                    <THead>
                                        <tr>
                                            <TH>{t("screens.admin.exercises.exercise")}</TH>
                                            <TH>{t("screens.admin.exercises.category")}</TH>
                                            <TH>{t("screens.admin.exercises.muscleGroups")}</TH>
                                            <TH>
                                                <span className="sr-only">{t("screens.admin.common.video")}</span>
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
                                                <TD className="whitespace-nowrap text-fg-muted">{categoryLabel(t, exercise.category)}</TD>
                                                <TD className="min-w-40 text-[13px] text-fg-muted">
                                                    {exercise.targetMuscleGroups.length > 0 ? (
                                                        exercise.targetMuscleGroups.join(", ")
                                                    ) : (
                                                        <span className="text-fg-subtle">{t("screens.admin.common.notSet")}</span>
                                                    )}
                                                </TD>
                                                <TD className="text-right whitespace-nowrap">
                                                    {exercise.videoUrl && (
                                                        <a
                                                            href={exercise.videoUrl}
                                                            target="_blank"
                                                            rel="noreferrer noopener"
                                                            className="inline-flex items-center gap-1 text-[13px] font-medium text-primary-soft-fg hover:underline"
                                                        >
                                                            {t("screens.admin.common.video")}
                                                            <ExternalLink aria-hidden className="size-3.5" />
                                                            <span className="sr-only">{t("screens.admin.exercises.videoFor", { name: exercise.name })}</span>
                                                        </a>
                                                    )}
                                                </TD>
                                            </TR>
                                        ))}
                                    </TBody>
                                </Table>
                                <Pagination
                                    page={page.page}
                                    pageCount={page.pageCount}
                                    total={page.total}
                                    pageSize={PAGE_SIZE}
                                    pathname={pathname}
                                    searchParams={params}
                                    itemLabel={t("screens.admin.exercises.itemLabel")}
                                    locale={locale}
                                />
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </>
    );
}
