export async function resolveLinkerInput(input: string): Promise<LinkerResolveResponse> {
	const query = input.trim();
	if (!query) {
		return {
			query,
			normalizedQuery: "",
			inputMode: "alias",
			matched: false,
			canonicalSmilesHash: null,
			canonicalSmiles: null,
			displayName: null,
			aliases: [],
			suggestions: [],
		};
	}

	const res = await fetch(`/api/linker?q=${encodeURIComponent(query)}`, {
		method: "GET",
		headers: {
			Accept: "application/json",
		},
	});

	const data = (await res.json()) as LinkerResolveResponse & { error?: string };
	if (!res.ok) {
		throw new Error(data.error ?? `Failed to resolve linker (${res.status})`);
	}

	return data;
}
