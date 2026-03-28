module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/node:buffer [external] (node:buffer, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:buffer", () => require("node:buffer"));

module.exports = mod;
}),
"[externals]/events [external] (events, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("events", () => require("events"));

module.exports = mod;
}),
"[externals]/process [external] (process, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("process", () => require("process"));

module.exports = mod;
}),
"[externals]/net [external] (net, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("net", () => require("net"));

module.exports = mod;
}),
"[externals]/tls [external] (tls, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("tls", () => require("tls"));

module.exports = mod;
}),
"[externals]/timers [external] (timers, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("timers", () => require("timers"));

module.exports = mod;
}),
"[externals]/stream [external] (stream, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("stream", () => require("stream"));

module.exports = mod;
}),
"[externals]/buffer [external] (buffer, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("buffer", () => require("buffer"));

module.exports = mod;
}),
"[externals]/string_decoder [external] (string_decoder, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("string_decoder", () => require("string_decoder"));

module.exports = mod;
}),
"[externals]/crypto [external] (crypto, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("crypto", () => require("crypto"));

module.exports = mod;
}),
"[externals]/zlib [external] (zlib, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("zlib", () => require("zlib"));

module.exports = mod;
}),
"[externals]/util [external] (util, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("util", () => require("util"));

module.exports = mod;
}),
"[externals]/url [external] (url, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("url", () => require("url"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/lib/utils.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "FILTER_DEFS",
    ()=>FILTER_DEFS,
    "PARSE_BOOL",
    ()=>PARSE_BOOL,
    "PARSE_NUMBER",
    ()=>PARSE_NUMBER,
    "STREAM_TO_STRING",
    ()=>STREAM_TO_STRING
]);
const FILTER_DEFS = {
    // search query across multiple fields (special)
    searchQuery: {
        kind: "search",
        param: "searchQuery"
    },
    // numeric thresholds
    minSurfaceArea: {
        kind: "numberMin",
        param: "minSurfaceArea",
        field: "bet_surface_area_m2g"
    },
    minPoreDiameter: {
        kind: "numberMin",
        param: "minPoreDiameter",
        field: "pore_diameter_A"
    },
    minTgaTemp: {
        kind: "numberMin",
        param: "minTgaTemp",
        field: "tga_decomposition_temp_c"
    },
    maxTemperature: {
        kind: "numberMax",
        param: "maxTemperature",
        field: "temperature_c"
    },
    maxTime: {
        kind: "numberMax",
        param: "maxTime",
        field: "time_h"
    },
    // booleans
    waterStable: {
        kind: "boolean",
        param: "waterStable",
        field: "water_stable"
    },
    airStable: {
        kind: "boolean",
        param: "airStable",
        field: "air_stable"
    },
    // equals filters
    topology: {
        kind: "stringEq",
        param: "topology",
        field: "topology_code"
    },
    metal: {
        kind: "stringEq",
        param: "metal",
        field: "metal_1_abbr"
    }
};
const PARSE_NUMBER = (v)=>{
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};
const PARSE_BOOL = (v)=>{
    if (!v) return false;
    const s = v.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes" || s === "on";
};
async function STREAM_TO_STRING(stream) {
    if (stream?.transformToString) return await stream.transformToString();
    const chunks = [];
    for await (const chunk of stream)chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks).toString("utf-8");
}
}),
"[project]/app/api/mysql/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "runtime",
    ()=>runtime
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$mysql2$2f$promise$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/mysql2/promise.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-route] (ecmascript)");
;
;
;
const runtime = "nodejs";
// ---- MySQL pool (reused across requests) ----
const pool = globalThis.__mofPool ?? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$mysql2$2f$promise$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: Number(process.env.MYSQL_PORT),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
globalThis.__mofPool = pool;
// Build a BOOLEAN MODE fulltext query like: "+foo* +bar*"
function toBooleanFulltext(q) {
    const terms = q.toLowerCase().match(/[a-z0-9]+/g) ?? [];
    return terms.length ? terms.map((t)=>`+${t}*`).join(" ") : "";
}
// Used for 'metal' filter in 'metal_1' column
function metalRegex(symbol) {
    // roughly: (^|[^A-Za-z])Fe([^a-z]|$)
    // MySQL REGEXP uses ICU in 8.0; this should work.
    const safe = symbol.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    return `(^|[^A-Za-z])${safe}([^a-z]|$)`;
}
function buildWhere(p) {
    const clauses = [];
    const params = [];
    // special: doi exact
    const doiParam = p.get("doi");
    if (doiParam) {
        const want = decodeURIComponent(doiParam);
        clauses.push("doi = ?");
        params.push(want);
    }
    // special: searchQuery (FULLTEXT)
    const q = (p.get(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["FILTER_DEFS"].searchQuery.param) ?? "").trim();
    if (q) {
        const bq = toBooleanFulltext(q);
        const orParts = [];
        if (bq) {
            orParts.push(`MATCH(mof_name, metal_1, metal_1_abbr, linker_1, linker_1_abbr) AGAINST (? IN BOOLEAN MODE)`);
            params.push(bq);
        }
        // fallback for identifier-like searches
        orParts.push(`LOWER(mof_name) LIKE ?`);
        params.push(`%${q.toLowerCase()}%`);
        orParts.push(`LOWER(linker_1_abbr) LIKE ?`);
        params.push(`%${q.toLowerCase()}%`);
        clauses.push(`(${orParts.join(" OR ")})`);
    }
    for (const def of Object.values(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["FILTER_DEFS"])){
        if (def.kind === "search") continue;
        const raw = p.get(def.param);
        if (def.kind === "boolean") {
            const want = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PARSE_BOOL"])(raw);
            if (want && def.field) {
                clauses.push(`${def.field} = 1`);
            }
        }
        if (def.kind === "stringEq") {
            if (!raw) continue;
            // special: metal filter (symbol inside metal_1 precursor string)
            if (def.param === __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["FILTER_DEFS"].metal.param) {
                clauses.push(`metal_1 REGEXP ?`);
                params.push(metalRegex(raw));
            } else if (def.field) {
                clauses.push(`${def.field} = ?`);
                params.push(raw);
            }
        }
        if (def.kind === "numberMin") {
            const min = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PARSE_NUMBER"])(raw);
            if (min != null && def.field) {
                if (min === 0) continue;
                clauses.push(`${def.field} >= ?`);
                params.push(min);
            }
        }
        if (def.kind === "numberMax") {
            const max = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PARSE_NUMBER"])(raw);
            if (max != null && def.field) {
                if (max === 0) continue;
                clauses.push(`${def.field} <= ?`);
                params.push(max);
            }
        }
    }
    const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    return {
        whereSql,
        params
    };
}
async function GET(req) {
    try {
        const url = new URL(req.url);
        const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
        const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get("pageSize") ?? "9")));
        const offset = (page - 1) * pageSize;
        const { whereSql, params } = buildWhere(url.searchParams);
        // total count
        const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM mof_entry ${whereSql}`, params);
        const total = Number(countRows?.[0]?.total ?? 0);
        // data page
        const selectCols = `
			id, doi, mof_name, mof_description,
			metal_1, metal_1_abbr, linker_1, linker_1_abbr,
			topology_code, solvent_main,
			temperature_c, time_h, yield_percent,
			bet_surface_area_m2g, pore_diameter_A, tga_decomposition_temp_c,
			water_stable, air_stable,
			crystal_morphology, crystal_form,
			status, synthesis_procedure, activation_procedure
		`;
        const [data] = await pool.query(`SELECT ${selectCols}
			 FROM mof_entry
			 ${whereSql}
			 ORDER BY id DESC
			 LIMIT ? OFFSET ?`, [
            ...params,
            pageSize,
            offset
        ]);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            total,
            page,
            pageSize,
            data
        }, {
            headers: {
                "Cache-Control": "public, s-maxage=60, stale-while-revalidate=86400"
            }
        });
    } catch (err) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "Failed to serve MOF dataset",
            detail: err?.message ?? String(err)
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__52ac5a85._.js.map