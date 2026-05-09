/**
 * Skillshare Extension — Main Entry Point
 *
 * Provides:
 *   /skillshare [query]      – tabbed TUI: search, installed, status
 *   /skillshare-settings     – standalone settings panel
 *   /skillshare-sync         – one-shot sync
 *   /skillshare-update       – one-shot update
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { matchesKey, Key } from "@earendil-works/pi-tui";
import type { SkillshareConfig } from "./utils";
import { DEFAULT_CONFIG, isSkillshareAvailable, detectProjectMode, resolveScope } from "./utils";
import {
	TabBar,
	SKILLSHARE_TABS,
	type TabId,
	SearchPanel,
	InstalledPanel,
	StatusPanel,
	SettingsPanel,
	type SearchPanelCallbacks,
} from "./panels";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** Current configuration, loaded from session or defaults. */
let config: SkillshareConfig = { ...DEFAULT_CONFIG };

// Detect project mode from filesystem on first load
config.installMode = detectProjectMode(process.cwd()) ? "project" : "global";

// ---------------------------------------------------------------------------
// Entry Point
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
	// Restore saved config from session
	pi.on("session_start", async (_event, ctx) => {
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type === "custom" && entry.customType === "skillshare-config") {
				const saved = entry.data as SkillshareConfig | undefined;
				if (saved?.hubMode && saved?.installMode && saved?.searchLimit) {
					config = { ...saved };
				}
			}
		}
	});

	// Persist config
	function saveConfig() {
		pi.appendEntry<SkillshareConfig>("skillshare-config", { ...config });
	}

	// ── /skillshare — Main tabbed panel (search / installed / status) ───

	pi.registerCommand("skillshare", {
		description:
			"Search, install, and manage skillshare skills. " +
			"Usage: /skillshare [query]",
		handler: async (args, ctx: ExtensionCommandContext) => {
			if (!isSkillshareAvailable()) {
				ctx.ui.notify(
					"skillshare CLI not found. Install from https://github.com/runkids/skillshare",
					"error",
				);
				return;
			}

			if (!ctx.hasUI) {
				ctx.ui.notify("/skillshare requires interactive mode", "error");
				return;
			}

			// Prompt for query if none provided
			let initialQuery = args?.trim() || "";
			if (!initialQuery) {
				const input = await ctx.ui.input(
					"Search skillshare for:",
					"Enter a keyword, skill name, or leave empty to browse popular skills",
				);
				if (input === undefined || input === null) {
					ctx.ui.notify("Search cancelled", "info");
					return;
				}
				initialQuery = input;
			}

			// Shared callbacks
			const callbacks: SearchPanelCallbacks = {
				onNotify: (msg, type) => ctx.ui.notify(msg, type),
				onSetStatus: (msg) => ctx.ui.setStatus("skillshare", msg),
				onClearStatus: () => ctx.ui.setStatus("skillshare", ""),
				onClose: () => { /* handled by custom() */ },
				onRequestRender: () => { /* set below */ },
			};

			await ctx.ui.custom<void>(
				(_tui, theme, _kb, done) => {
					let currentTab: TabId = "search";

					const tabBar = new TabBar(theme, SKILLSHARE_TABS, (tab) => {
						currentTab = tab;
						_tui.requestRender();
					});

					const searchPanel = new SearchPanel(
						config,
						theme,
						{
							...callbacks,
							onRequestRender: () => _tui.requestRender(),
						},
						initialQuery,
					);

					const installedPanel = new InstalledPanel(config, theme, {
						...callbacks,
						onRequestRender: () => _tui.requestRender(),
					});

					const statusPanel = new StatusPanel(config, theme, {
						...callbacks,
						onRequestRender: () => _tui.requestRender(),
					});

					const component = {
						render(width: number): string[] {
							const lines: string[] = [];
							lines.push(...tabBar.render(width));
							lines.push("");
							switch (currentTab) {
								case "search":
									lines.push(...searchPanel.render(width));
									break;
								case "installed":
									lines.push(...installedPanel.render(width));
									break;
								case "status":
									lines.push(...statusPanel.render(width));
									break;
							}
							return lines;
						},

						handleInput(data: string) {
							if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
								done();
								return;
							}

							const prevTab = currentTab;
							tabBar.handleInput(data);

							if (currentTab !== prevTab) {
								_tui.requestRender();
								return;
							}

							switch (currentTab) {
								case "search":
									searchPanel.handleInput(data);
									break;
								case "installed":
									installedPanel.handleInput(data);
									break;
								case "status":
									statusPanel.handleInput(data);
									break;
							}
							_tui.requestRender();
						},

						invalidate() {
							tabBar.invalidate();
							searchPanel.invalidate();
							installedPanel.invalidate();
							statusPanel.invalidate();
						},
					};

					return component;
				},
			);
		},
	});

	// ── /skillshare-settings — Standalone settings panel ────────────────

	pi.registerCommand("skillshare-settings", {
		description: "Configure skillshare extension defaults (hub mode, install target, search limit)",
		handler: async (_args, ctx: ExtensionCommandContext) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("/skillshare-settings requires interactive mode", "error");
				return;
			}

			await ctx.ui.custom<void>(
				(_tui, theme, _kb, done) => {
					const settingsPanel = new SettingsPanel(config, theme, {
						onConfigChange: (newConfig) => {
							config = newConfig;
							saveConfig();
							ctx.ui.notify("Settings updated", "info");
						},
						onNotify: (msg, type) => ctx.ui.notify(msg, type),
						onRequestRender: () => _tui.requestRender(),
					});

					const component = {
						render(width: number): string[] {
							const lines: string[] = [];

							// Title
							lines.push(theme.fg("accent", theme.bold(" Skillshare Settings")));
							lines.push(theme.fg("borderMuted", "─".repeat(width)));
							lines.push("");

							// Settings panel body
							lines.push(...settingsPanel.render(width));

							// Footer
							lines.push("");
							lines.push(theme.fg("borderMuted", "─".repeat(width)));
							lines.push(
								`  ${theme.fg("dim", "Esc close")}`,
							);

							return lines;
						},

						handleInput(data: string) {
							if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
								done();
								return;
							}
							settingsPanel.handleInput(data);
							_tui.requestRender();
						},

						invalidate() {
							settingsPanel.invalidate();
						},
					};

					return component;
				},
			);
		},
	});

	// ── /skillshare-sync — One-shot sync ─────────────────────────────

	pi.registerCommand("skillshare-sync", {
		description:
			"Sync installed skills to configured targets. " +
			"Usage: /skillshare-sync [-p | -g]",
		handler: async (args, ctx: ExtensionCommandContext) => {
			if (!isSkillshareAvailable()) {
				ctx.ui.notify(
					"skillshare CLI not found. Install from https://github.com/runkids/skillshare",
					"error",
				);
				return;
			}

			const projectMode = resolveScope(args, config) === "project";
			ctx.ui.setStatus("skillshare", "Syncing skills...");

			try {
				const { syncSkills } = await import("./utils");
				const output = syncSkills(projectMode);
				ctx.ui.setStatus("skillshare", "");
				ctx.ui.notify("Sync completed", "success");
				console.log(`skillshare sync:\n${output}`);
			} catch (err: unknown) {
				ctx.ui.setStatus("skillshare", "");
				ctx.ui.notify(
					`Sync failed: ${err instanceof Error ? err.message : String(err)}`,
					"error",
				);
			}
		},
	});

	// ── /skillshare-update — One-shot update ──────────────────────────

	pi.registerCommand("skillshare-update", {
		description:
			"Check for updates then apply them. " +
			"Usage: /skillshare-update [-p | -g]",
		handler: async (args, ctx: ExtensionCommandContext) => {
			if (!isSkillshareAvailable()) {
				ctx.ui.notify(
					"skillshare CLI not found. Install from https://github.com/runkids/skillshare",
					"error",
				);
				return;
			}

			const projectMode = resolveScope(args, config) === "project";

			// Step 1: Check for updates first
			ctx.ui.setStatus("skillshare", "Checking for updates...");

			let checkResult;
			try {
				const { checkSkills } = await import("./utils");
				checkResult = checkSkills(projectMode);
			} catch (err: unknown) {
				ctx.ui.setStatus("skillshare", "");
				ctx.ui.notify(
					`Check failed: ${err instanceof Error ? err.message : String(err)}`,
					"error",
				);
				return;
			}

			ctx.ui.setStatus("skillshare", "");

			// Summarise results
			const updatable = checkResult.skills.filter(
				(s: any) => s.status === "update_available"
			);
			const stale = checkResult.skills.filter(
				(s: any) => s.status === "stale"
			);
			const reposBehind = checkResult.tracked_repos.filter(
				(r: any) => r.status === "behind"
			);
			const upToDateCount =
				checkResult.skills.filter((s: any) => s.status === "up_to_date").length;

			if (updatable.length === 0 && reposBehind.length === 0 && stale.length === 0) {
				if (checkResult.skills.length === 0 && checkResult.tracked_repos.length === 0) {
					ctx.ui.notify("No skills installed — nothing to check", "info");
				} else {
					ctx.ui.notify(
						`All ${upToDateCount} skills are up to date`,
						"success",
					);
				}
				return;
			}

			// Build summary message
			let summary = "";
			if (updatable.length > 0) {
				summary += `\n  Updates available (${updatable.length}):`;
				for (const s of updatable.slice(0, 6)) {
					summary += `\n    \u2022 ${s.name}`;
				}
				if (updatable.length > 6) {
					summary += `\n    ... and ${updatable.length - 6} more`;
				}
			}
			if (reposBehind.length > 0) {
				summary += `\n  Tracked repos behind (${reposBehind.length}):`;
				for (const r of reposBehind) {
					summary += `\n    \u2022 ${r.name} (${r.behind} commit(s))`;
				}
			}
			if (stale.length > 0) {
				summary += `\n  Stale skills (${stale.length}):`;
				for (const s of stale.slice(0, 4)) {
					summary += `\n    \u2022 ${s.name}`;
				}
				if (stale.length > 4) {
					summary += `\n    ... and ${stale.length - 4} more (use --prune to remove)`;
				}
			}

			ctx.ui.notify(`Changes detected:${summary}`, "info");

			// Step 2: Ask for confirmation
			const confirmed = await ctx.ui.confirm(
				"Apply all updates now?",
				"Yes",
				"No",
			);

			if (!confirmed) {
				ctx.ui.notify("Update cancelled", "info");
				return;
			}

			// Step 3: Run update
			ctx.ui.setStatus("skillshare", "Updating skills...");

			try {
				const { updateSkills } = await import("./utils");
				const output = updateSkills(projectMode);
				ctx.ui.setStatus("skillshare", "");
				ctx.ui.notify("Update completed", "success");
				console.log(`skillshare update:\n${output}`);
			} catch (err: unknown) {
				ctx.ui.setStatus("skillshare", "");
				ctx.ui.notify(
					`Update failed: ${err instanceof Error ? err.message : String(err)}`,
					"error",
				);
			}
		},
	});

	// ── /skillshare-ui — Launch web UI ─────────────────────────────

	pi.registerCommand("skillshare-ui", {
		description: "Open the skillshare web UI in a browser",
		handler: async (_args, ctx: ExtensionCommandContext) => {
			if (!isSkillshareAvailable()) {
				ctx.ui.notify(
					"skillshare CLI not found. Install from https://github.com/runkids/skillshare",
					"error",
				);
				return;
			}

			ctx.ui.setStatus("skillshare", "Starting web UI...");

			try {
				const { openUI } = await import("./utils");
				const { url } = openUI(process.cwd());
				ctx.ui.setStatus("skillshare", "");
				ctx.ui.notify("Skillshare web UI starting at " + url, "success");
			} catch (err: unknown) {
				ctx.ui.setStatus("skillshare", "");
				ctx.ui.notify(
					"Failed to start UI: " + (err instanceof Error ? err.message : String(err)),
					"error",
				);
			}
		},
	});
}
