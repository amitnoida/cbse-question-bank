// Match the server's bounded feedback endpoint without weakening its access checks.
export async function fetchFeedbackInBatches<T>(
  questionIds: number[],
  readBatch: (ids: number[]) => Promise<T[]>
): Promise<T[]> {
  const ids = [...new Set(questionIds)];
  const result: T[] = [];
  for (let offset = 0; offset < ids.length; offset += 60) {
    result.push(...await readBatch(ids.slice(offset, offset + 60)));
  }
  return result;
}
