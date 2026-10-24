# Sorted Status Effects

> [!WARNING]
> ## 🤖 AI-coded fork: Foundry v13 / v14 compatibility patch
>
> **This is an unofficial fork of [ThreeHats/sorted-status-effects](https://github.com/ThreeHats/sorted-status-effects). Every change in this fork was written by an AI, Claude (Opus 5.5, made by Anthropic), at the fork owner's request.**
>
> - The changes were **not written or reviewed by the original author** (ThreeHats), and they were not written by a human programmer.
> - They were **tested only in a headless browser against a mocked Foundry v14 Token HUD**, not in a live Foundry game, and were not tested on Foundry v12 or earlier.
> - Please **do not report problems with this fork to the original author.** Open an issue on this fork instead.
>
> The AI-written changes are in the commit marked "AI-generated" in this repository's history. Everything else is the original 1.6.0 code.
>
> **What the AI changed**
> - Foundry v13+ renders the Token HUD with ApplicationV2, so the module's libWrapper hook on `TokenHUD.prototype._render` no longer exists. The HUD is now altered from the `renderTokenHUD` hook instead, and **libWrapper is no longer required**.
> - Render hooks now pass an `HTMLElement` rather than jQuery; the HUD and keybinding code handle both.
> - Uses the namespaced `foundry.utils.mergeObject`, `foundry.appv1.api.FormApplication` / `Dialog`, `foundry.applications.apps.FilePicker.implementation`, `foundry.utils.saveDataToFile` / `readTextFromFile` (falling back to the old globals).
> - The palette `display: flex` rule now applies only while the palette is open, so a closed palette stays hidden in v13+.
> - Effect names for search and sidebar tooltips are read from v13+ markup (`data-tooltip-text`), with a fallback to `CONFIG.statusEffects`.
> - Status effects that are hidden from a particular HUD (e.g. by `CONFIG.statusEffects[].hud.actorTypes`) keep their sort order and tags instead of being deleted.
> - Sort data is saved only by a GM and only when it changes, so players opening a Token HUD no longer hit permission errors.
> - The icon picker in "Configure Tags" now opens a file picker (it previously only listed a folder), plus small null-safety fixes in the T/Q keybindings.

![Foundry v13 | v14](https://img.shields.io/badge/foundry-v13%20%7C%20v14-orange) ![AI-coded fork](https://img.shields.io/badge/AI--coded%20fork-Claude-red)

A Foundry VTT module that enhances the Token HUD by adding the ability to sort and tag status effects, making them more organized and easier to filter.

![image](https://github.com/user-attachments/assets/65e39fb1-16ec-4b3d-80c6-c971727b5b8c)
(pictured is also Condition Lab & Triggler, Illandril's Token HUD Scaler, and Monk's Little Details)


## Features

### Status Effect Sorting
- Drag and drop sorting of status effects in the Token HUD
- Hold 'T' key and hover over status effects to reorder them
- Persistent sorting that saves between sessions
- Compatible with other modules that modify the Token HUD

### Status Effect Tagging
- Add custom tags to any status effect
- Press 'Q' while hovering over a status effect to open the tagging menu
- Filter visible status effects by clicking on tags
- Customize tag icons through the module settings
- Tags are visible in the Token HUD for quick filtering

### Status Effect Sidebar Modes
- "Active"
  - Active effects are pinned to the corner of the effects HUD
- "Tagged"
  - Tagged effects are only shown in the sidebar
- Change the orientation of the layout in the settings menu

## Installation

> **Note:** The manifest URL below installs the **original** module (v12), not this AI-patched fork. This fork has no published release; to use it, copy this repository's files into `Data/modules/sorted-status-effects`.

1. Inside Foundry VTT, select the Game Modules tab in the Configuration and Setup menu
2. Click the Install Module button and enter the following URL: https://github.com/ThreeHats/sorted-status-effects/releases/latest/download/module.json
3. Click Install and wait for installation to complete

## Required Modules
- None in this fork. (The original required [libWrapper](https://foundryvtt.com/packages/lib-wrapper); the AI-patched version no longer uses it.)

## Recommended Modules
- [Condition Lab & Triggler](https://foundryvtt.com/packages/condition-lab-triggler)
- [Illandril's Token HUD Scaler](https://foundryvtt.com/packages/illandril-token-hud-scale)
- [Status Icon Counters](https://foundryvtt.com/packages/statuscounter)
- [Visual Active Effects](https://foundryvtt.com/packages/visual-active-effects)

## Incompatibilities
- Any module that alters the token status HUD appearance may break the module.

## Usage

### Sorting Status Effects
1. Hover over the status effect you want to move
2. Hold the 'T' key (configurable in Foundry keybindings)
3. While still holding 'T', hover over the position where you want to place it
4. Release the 'T' key to drop the status effect in its new position

### Tagging Status Effects
1. Hover over a status effect
2. Press 'Q' (configurable in Foundry keybindings) to open the tagging menu
3. Check existing tags or create new ones
4. Click "Save Tags" to apply the changes

### Managing Tags
1. Open Foundry VTT settings
2. Navigate to Module Settings
3. Find "Sorted Status Effects" section
4. Click "Configure Tags"
5. Add, edit, or remove tags and their icons
6. Click "Save Changes" to apply

### Filtering by Tags
- Click on tag icons in the Token HUD to toggle visibility of associated status effects
- Status effects thats match any tag will be shown
- Status effects with no tags that are toggled on are hidden
- Status effects without any tags are shown no matter what

## Compatibility
- This fork: targets Foundry VTT v13 and v14 (AI-patched; tested only against a mocked v14 HUD, see the notice at the top)
- Original 1.6.0: tested with Foundry VTT v12
- Compatible with Token HUD Scale and Monk's Little Details modules

## Support

For problems with this AI-patched fork, open an issue on this fork, not on the original repository.
For the original module, see the [original GitHub repository](https://github.com/ThreeHats/sorted-status-effects).
Join the [discord](https://discord.gg/HUzEnZy8uJ) for extra support and discussions.

## License

This module is licensed under [GNU General Public License v3.0](https://github.com/ThreeHats/sorted-status-effects/blob/main/LICENSE).
