/**
 * Shared utilities for the skillshare extension.
 * CLI wrappers, error parsing, spinner, etc.
 */

import { execFileSync, execFile, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SkillSearchResult {
	Name: string;
	Description: string;
	Source: string;
	Stars: number;
	Owner: string;
	Repo: string;
	Path: string;
	Tags?: string[];
	RiskScore?: number | null;
	RiskLabel?: string;
}

export interface InstalledSkill {
	name: string;
	source?: string;
	path: string;
}

export interface SkillshareConfig {
	hubMode: "github" | "community-hub";
	installMode: "project" | "global";
	operationScope: "project" | "global";
	searchLimit: number;
}

export const DEFAULT_CONFIG: SkillshareConfig = {
	hubMode: "github",
	installMode: "project",
	operationScope: "project",
	searchLimit: 20,
};

// ---------------------------------------------------------------------------
// Check types
// ---------------------------------------------------------------------------

export interface CheckRepoResult {
	name: string;
	status: string;
	behind: number;
	branch?: string;
	message?: string;
}

export interface CheckSkillResult {
	name: string;
	source: string;
	version: string;
	status: string;
	installed_at?: string;
}

export interface CheckOutput {
	tracked_repos: CheckRepoResult[];
	skills: CheckSkillResult[];
}

// ---------------------------------------------------------------------------
// CLI helpers
// ---------------------------------------------------------------------------

/** Check if the `skillshare` CLI is available on PATH. */
export function isSkillshareAvailable(): boolean {
	try {
		execFileSync("skillshare", ["--version"], { stdio: "ignore", timeout: 5000 });
		return true;
	} catch {
		return false;
	}
}

/** Get the skillshare CLI version. */
export function getSkillshareVersion(): string {
	try {
		return execFileSync("skillshare", ["--version"], {
			encoding: "utf-8",
			timeout: 5000,
		}).trim();
	} catch {
		return "unknown";
	}
}

/** Get project root (where .skillshare/ lives) by walking up at most 20 levels. */
export function getProjectRoot(cwd: string): string | null {
	let dir = cwd;
	for (let i = 0; i < 20; i++) {
		if (fs.existsSync(path.join(dir, ".skillshare"))) return dir;
		const parent = path.resolve(dir, "..");
		if (parent === dir) break;
		dir = parent;
	}
	return null;
}

/** Check whether project mode should be default. */
/** Resolve operation scope from CLI args (-p/-g) falling back to config. */
export function resolveScope(
	args: string | undefined,
	config: SkillshareConfig,
): "project" | "global" {
	if (!args) return config.operationScope;
	const parts = args.trim().split(/\s+/);
	for (const p of parts) {
		if (p === "-p" || p === "--project") return "project";
		if (p === "-g" || p === "--global") return "global";
	}
	return config.operationScope;
}

export function detectProjectMode(cwd: string): boolean {
	return getProjectRoot(cwd) !== null;
}

// ---------------------------------------------------------------------------
// Error parsing
// ---------------------------------------------------------------------------

function parseSkillshareError(stderr: string, stdout: string): string {
	const combined = stderr + "\n" + stdout;
	try {
		const parsed = JSON.parse(stdout.trim()) as { error?: string };
		if (parsed.error) {
			const e = parsed.error;
			if (
				e.includes("requires authentication") ||
				e.includes("401") ||
				e.includes("Not Found")
			) {
				return (
					"GitHub authentication required. Run:\n" +
					"  gh auth login\n" +
					"Or set:\n" +
					"  export GITHUB_TOKEN=ghp_your_token_here"
				);
			}
			if (e.includes("rate limit") || e.includes("403")) {
				return (
					"GitHub API rate limit exceeded. Wait or set GITHUB_TOKEN:\n" +
					"  export GITHUB_TOKEN=ghp_your_token_here"
				);
			}
			return e;
		}
	} catch {
		/* not JSON */
	}

	const lower = combined.toLowerCase();
	if (lower.includes("command not found") || lower.includes("not recognized")) {
		return "The skillshare CLI is not installed or not on PATH.\n  Install: https://github.com/runkids/skillshare";
	}
	if (lower.includes("requires authentication") || lower.includes("401")) {
		return (
			"GitHub authentication required. Run:\n" +
			"  gh auth login\n" +
			"Or set:\n" +
			"  export GITHUB_TOKEN=ghp_your_token_here"
		);
	}
	if (lower.includes("rate limit") || lower.includes("403")) {
		return (
			"GitHub API rate limit exceeded. Wait or set GITHUB_TOKEN:\n" +
			"  export GITHUB_TOKEN=ghp_your_token_here"
		);
	}
	if (lower.includes("network") || lower.includes("timed out") || lower.includes("econnrefused")) {
		return "Network error: could not reach GitHub. Check your internet connection.";
	}
	const lines = combined.split("\n").filter((l) => l.trim());
	return lines.length > 0 ? lines.slice(0, 5).join("\n") : "Unknown error";
}

/** Convert exec error to a user-friendly Error using parseSkillshareError. */
function toSkillshareError(err: unknown): Error {
	if (err && typeof err === "object" && "stderr" in err) {
		const e = err as { stderr?: string; stdout?: string };
		const stderr = typeof e.stderr === "string" ? e.stderr : "";
		const stdout = typeof e.stdout === "string" ? e.stdout : "";
		return new Error(parseSkillshareError(stderr, stdout));
	}
	const message = err instanceof Error ? err.message : String(err);
	return new Error(parseSkillshareError(message, ""));
}

function rethrowExecError(err: unknown): never {
	if (err && typeof err === "object" && "stderr" in err) {
		const e = err as { stderr?: string; stdout?: string };
		const stderr = typeof e.stderr === "string" ? e.stderr : "";
		const stdout = typeof e.stdout === "string" ? e.stdout : "";
		throw new Error(parseSkillshareError(stderr, stdout));
	}
	const message = err instanceof Error ? err.message : String(err);
	throw new Error(`Search failed: ${parseSkillshareError(message, "")}`);
}

function parseSearchOutput(stdout: string): SkillSearchResult[] {
	const trimmed = stdout.trim();
	if (!trimmed) return [];
	const parsed = JSON.parse(trimmed);
	if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.error) {
		throw new Error(parseSkillshareError("", trimmed));
	}
	if (Array.isArray(parsed)) return parsed as SkillSearchResult[];
	return [];
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

function buildSearchArgs(
	query: string,
	limit: number,
	hubMode: SkillshareConfig["hubMode"],
): string[] {
	const safeLimit = String(Math.max(1, Math.min(100, limit)));
	const args = ["search", query, "--json", "--limit", safeLimit];
	if (hubMode === "community-hub") {
		args.push("--hub");
	}
	return args;
}

/** Sync search (no spinner). */
/** Async search (enables spinner in command handler). */
export async function searchSkillsAsync(
	query: string,
	limit: number,
	hubMode: SkillshareConfig["hubMode"],
): Promise<SkillSearchResult[]> {
	return new Promise((resolve, reject) => {
		execFile(
			"skillshare",
			buildSearchArgs(query, limit, hubMode),
			{
				encoding: "utf-8",
				timeout: 30_000,
				maxBuffer: 10 * 1024 * 1024,
			},
			(err, stdout) => {
				if (err) {
					(err as any).stdout = stdout ?? "";
					(err as any).stderr = (err as any).stderr ?? "";
					try {
						rethrowExecError(err);
					} catch (e) {
						reject(e);
					}
				} else {
					try {
						resolve(parseSearchOutput(stdout ?? ""));
					} catch (e) {
						reject(e);
					}
				}
			},
		);
	});
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

export function installSkill(source: string, projectMode: boolean): string {
	const args = ["install", source];
	if (projectMode) args.push("-p");
	else args.push("-g");
	args.push("-y");

	const tryExec = (extraArgs: string[] = []): string => {
		return execFileSync("skillshare", [...args, ...extraArgs], {
			encoding: "utf-8",
			timeout: 120_000,
			maxBuffer: 10 * 1024 * 1024,
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
	};

	try {
		return tryExec();
	} catch (err: unknown) {
		if (err && typeof err === "object" && "stderr" in err) {
			const e = err as { stderr?: string; stdout?: string };
			const stderr = typeof e.stderr === "string" ? e.stderr : "";
			const stdout = typeof e.stdout === "string" ? e.stdout : "";
			const combined = (stderr + "\n" + stdout).toLowerCase();
			if (combined.includes("already exists") || combined.includes("already installed")) {
				throw new Error(
					`"${source}" is already installed. Use --update to refresh, or uninstall first.`,
				);
			}
			if (combined.includes("blocked") || combined.includes("audit")) {
				try {
					return tryExec(["--force"]);
				} catch {
					/* fall through */
				}
			}
			throw new Error(parseSkillshareError(stderr, stdout));
		}
		const message = err instanceof Error ? err.message : String(err);
		throw new Error(parseSkillshareError(message, ""));
	}
}

// ---------------------------------------------------------------------------
// List installed skills
// ---------------------------------------------------------------------------

/** List installed skills by reading the skillshare skills directory. */
export function listInstalledSkills(projectMode: boolean): InstalledSkill[] {
	const baseDir = projectMode
		? (() => {
				const root = getProjectRoot(process.cwd());
				return root ? path.join(root, ".skillshare", "skills") : null;
			})()
		: path.join(os.homedir(), ".config", "skillshare", "skills");

	if (!baseDir || !fs.existsSync(baseDir)) return [];

	try {
		return fs
			.readdirSync(baseDir, { withFileTypes: true })
			.filter((d) => d.isDirectory())
			.map((d) => ({
				name: d.name,
				path: path.join(baseDir, d.name),
			}));
	} catch {
		return [];
	}
}

// ---------------------------------------------------------------------------
// Sync / Update / Uninstall / Doctor
// ---------------------------------------------------------------------------

export function syncSkills(projectMode: boolean): string {
	const args = ["sync"];
	if (projectMode) args.push("-p");
	try {
		return execFileSync("skillshare", args, {
			encoding: "utf-8",
			timeout: 60_000,
			maxBuffer: 10 * 1024 * 1024,
		}).trim();
	} catch (err: unknown) {
		throw toSkillshareError(err);
	}
}

export function updateSkills(projectMode: boolean): string {
	const args = ["update"];
	if (projectMode) args.push("-p");
	try {
		return execFileSync("skillshare", args, {
			encoding: "utf-8",
			timeout: 120_000,
			maxBuffer: 10 * 1024 * 1024,
		}).trim();
	} catch (err: unknown) {
		throw toSkillshareError(err);
	}
}

export function uninstallSkill(name: string, projectMode: boolean): string {
	const args = ["uninstall", name];
	if (projectMode) args.push("-p");
	try {
		return execFileSync("skillshare", args, {
			encoding: "utf-8",
			timeout: 30_000,
			maxBuffer: 10 * 1024 * 1024,
		}).trim();
	} catch (err: unknown) {
		throw toSkillshareError(err);
	}
}

export function checkSkills(projectMode: boolean): CheckOutput {
	const args = ["check", "--json"];
	if (projectMode) args.push("-p");
	try {
		const stdout = execFileSync("skillshare", args, {
			encoding: "utf-8",
			timeout: 30_000,
			maxBuffer: 10 * 1024 * 1024,
		}).trim();
		if (!stdout) return { tracked_repos: [], skills: [] };
		return JSON.parse(stdout) as CheckOutput;
	} catch (err: unknown) {
		throw toSkillshareError(err);
	}
}

export function runDoctor(): string {
	try {
		return execFileSync("skillshare", ["doctor"], {
			encoding: "utf-8",
			timeout: 30_000,
			maxBuffer: 10 * 1024 * 1024,
		}).trim();
	} catch (err: unknown) {
		throw toSkillshareError(err);
	}
}

/** Track the currently running UI process so we can kill it before spawning a new one. */
let uiProcess: ReturnType<typeof spawn> | null = null;

export function openUI(cwd: string): { url: string } {
	// Kill previous instance if still running
	if (uiProcess && !uiProcess.killed) {
		try {
			uiProcess.kill();
		} catch {
			/* process already dead */
		}
	}

	uiProcess = spawn("skillshare", ["ui", "--port", "19420"], {
		cwd,
		detached: true,
		stdio: "ignore",
	});
	uiProcess.unref();

	// Track exit to clean up reference
	uiProcess.on("exit", () => {
		uiProcess = null;
	});

	return { url: "http://127.0.0.1:19420" };
}

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function startSpinner(
	setStatus: (msg: string) => void,
	prefix: string,
): () => void {
	let frame = 0;
	const id = setInterval(() => {
		setStatus(`${SPINNER_FRAMES[frame]} ${prefix}`);
		frame = (frame + 1) % SPINNER_FRAMES.length;
	}, 150);
	setStatus(`${SPINNER_FRAMES[0]} ${prefix}`);
	return () => {
		clearInterval(id);
	};
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatStars(stars: number): string {
	return stars > 0
		? stars >= 1000
			? `${(stars / 1000).toFixed(1)}k`
			: String(stars)
		: "";
}
