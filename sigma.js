// watameln 2026
// This script is designed to delete all denied submissions from a specific guild in a system that has an API for managing user guilds and their submissions. It fetches all submissions, filters out the denied ones, and then attempts to delete each of them while handling rate limits and logging the results.


// Configuration: Set the guild ID for which you want to delete denied submissions. Make sure to replace the placeholder with your actual guild ID.
const GUILD_ID = "1234567890"; // Replace with your guild ID


// Don't change below unless you know what you're doing, as this is the core logic of the script that handles fetching submissions, filtering denied ones, and deleting them while managing rate limits and logging results.
const Sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const response = await fetch(`/api/v1/user-guilds/${GUILD_ID}/sections/submissions`, { // Fetch all submissions for the guild
	method: "GET",
	credentials: "include",
	headers: {
		"accept": "*/*",
	},
});

const data = await response.json(); // Parse the response as JSON to get the data object, which should contain the submissions and other related information.

const findArrays = value => { // Recursively find all arrays in the object and return them in a flat array.
	const arrays = [];

	const walk = v => {
		if (Array.isArray(v)) {
			arrays.push(v);
			for (const item of v) walk(item);
			return;
		}

		if (v && typeof v === "object") {
			for (const key in v) walk(v[key]);
		}
	};

	walk(value); // Start the recursive walk with the initial value

	return arrays;
};

const submissions = findArrays(data)
	.sort((a, b) => b.length - a.length)
	.find(arr => arr.some(v => v && typeof v === "object" && v.id && v.status));

if (!submissions) {
	throw new Error("Could not find submissions array."); // This should never happen, but just in case the API response changes significantly.
}

const denied = submissions.filter(v => v.status?.state === 3); // Status 3 is denied
const ids = denied.map(v => v.id); // Extract IDs of denied submissions
const total = ids.length; // Total number of denied submissions

console.log(`Deleting ${total} denied submissions...`); // Log the total number of denied submissions to be deleted

let deleted = 0; // Counter for successful deletions, used for logging the final results at the end of the process.
let failed = 0; // Counters for successful deletions and failures, used for logging the final results at the end of the process.

for (let i = 0; i < ids.length; i++) { // Loop through each ID and attempt to delete the corresponding submission
	const id = ids[i];
	const current = i + 1;

	const deleteResponse = await fetch(
		`/api/v1/user-guilds/${GUILD_ID}/sections/submissions/${id}/delete`, // API endpoint to delete a specific submission by ID
		{
			method: "POST",
			credentials: "include",
			headers: {
				"accept": "*/*",
			},
		},
	);

	const text = await deleteResponse.text().catch(() => ""); // Attempt to read the response text for logging purposes, but if it fails (eg. due to a network error), just use an empty string instead.

	if (deleteResponse.ok) {
		deleted++;
		console.log(`[DELETED] ${id} ${current}/${total}`); // Log the successful deletion with the ID and current progress
	} else {
		failed++;
		console.warn(`[FAILED] ${id} ${current}/${total} | HTTP ${deleteResponse.status} | ${text}`); // Log the failure with the ID, current progress, HTTP status code, and response text for debugging purposes
	}

	if (deleteResponse.status === 429) {
		console.warn(`Rate limited at ${current}/${total}. Waiting 30 seconds...`);
		await Sleep(30000); // If we hit a rate limit, wait for 30 seconds before continuing to avoid further rate limits.
	} else {
		await Sleep(750); // Sleep for 750ms between requests to avoid hitting rate limits, but if we do hit a rate limit, wait for 30 seconds before continuing.
	}
}

console.log(`Done: Deleted denied submissions: ${deleted}/${total}. Failed: ${failed}/${total}.`); // Log the final results of the deletion process, including how many were successfully deleted and how many failed.
