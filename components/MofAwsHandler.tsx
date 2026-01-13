const getMofJsonUrl = (): string => {
  return "/api/aws"; // Switch to a local json file (in /public) for testing
}

export async function fetchMofData(url?: string): Promise<MofEntry[]> {
  const finalUrl = url ?? getMofJsonUrl();
  const res = await fetch(finalUrl);

  if (!res.ok) {
    throw new Error(`Failed to fetch MOF JSON (${res.status}) from ${finalUrl}`);
  }

  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) {
    throw new Error("MOF JSON is not an array");
  }
  return data as MofEntry[];
}

export default getMofJsonUrl