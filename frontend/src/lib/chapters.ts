/**
 * Chapter status only governs the public site. Inside admin every chapter is
 * operational, so pickers list them all — but say which ones aren't live yet.
 */
export function chapterOptionLabel(chapter: { name: string; status?: string | null }): string {
  const status = chapter.status ?? "active";
  return status === "active" ? chapter.name : `${chapter.name} (${status})`;
}
