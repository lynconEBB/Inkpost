// fetch for /api/** (D41, D42): JSON in and out, and errors as the Problem Details the API sends.

/** A failed call: the status, and the Problem Details' title, detail and, on a 400, field errors. */
export class ApiError extends Error {
	constructor({ status, title, detail = null, errors = [] }) {
		super(detail ?? title);
		this.name = "ApiError";
		this.status = status;
		this.title = title;
		this.detail = detail;
		this.errors = errors;
	}
}

/**
 * Calls the API and returns the parsed JSON, or null for a 204. `json` is sent as JSON, `body` as it is
 * (a FormData). Any other status throws an ApiError.
 *
 * Redirects are not followed: when the Cloudflare Access session (D16) expires, API calls are redirected
 * to its login page, which would otherwise end in a confusing network error.
 */
export async function api(path, { method = "GET", json, body } = {}) {
	const headers = { Accept: "application/json, application/problem+json" };
	if (json !== undefined) {
		headers["Content-Type"] = "application/json";
		body = JSON.stringify(json);
	}
	let response;
	try {
		response = await fetch(path, { method, headers, body, redirect: "manual" });
	} catch {
		throw new ApiError({ status: 0, title: "Can't reach the server. Check the connection and try again." });
	}
	if (response.type === "opaqueredirect") {
		throw new ApiError({ status: 0, title: "Your session expired, reload the page." });
	}
	if (response.status === 204) {
		return null;
	}
	if (response.ok) {
		return response.json();
	}
	throw await problemOf(response);
}

/** A body that isn't Problem Details (e.g. a proxy's error page) leaves just the status. */
async function problemOf(response) {
	let problem = {};
	try {
		problem = await response.json();
	} catch {
		// Not JSON.
	}
	return new ApiError({
		status: response.status,
		title: problem.title ?? (response.statusText || `Error ${response.status}`),
		detail: problem.detail ?? null,
		errors: Array.isArray(problem.errors) ? problem.errors : [],
	});
}
