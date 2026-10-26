export function fighterIdFromActivatedUser(user: {
  role: string;
  profile: { id?: string } | null;
}): string | null {
  if (user.role !== "FIGHTER") return null;
  const id = user.profile?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/** Null when the fighter profile id is unknown, so the screen cannot open a blank assignment. */
export function assignDoctorHref(fighterId: string | null | undefined): string | null {
  if (!fighterId) return null;
  return `/quan-tri/phan-cong-bac-si?fighterId=${encodeURIComponent(fighterId)}`;
}
