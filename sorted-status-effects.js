// AI-CODED: This file was modified by an AI (Claude Opus 5.5, Anthropic) for Foundry v13/v14 compatibility.
// These changes were not written or reviewed by the original author. See the notice in README.md.
import { registerKeybinds, onEffectKeyDown, onEffectKeyUp, onTagKeyDown } from "./scripts/keybindings.js";
import { TagConfigurationDialog } from "./scripts/tag-configuration-dialog.js";
import { ImportExportDialog } from "./scripts/import-export-dialog.js";

let sortedStatusEffects = {};
let shownTags = [];
let debug = false;

// Foundry v13+ moved the V1 application classes into namespaces; fall back to the old globals on older cores.
const FormApplicationV1 = foundry.appv1?.api?.FormApplication ?? globalThis.FormApplication;
const DialogV1 = foundry.appv1?.api?.Dialog ?? globalThis.Dialog;

/** Read a setting from another module without throwing if that module doesn't register it. */
function safeSetting(moduleId, key) {
    try {
        return game.settings.get(moduleId, key);
    } catch (e) {
        return undefined;
    }
}

/** True when Monk's Little Details is active and altering the token HUD. */
function monksAlterHud() {
    return !!game.modules.get('monks-little-details')?.active && !!safeSetting('monks-little-details', 'alter-hud');
}

/** Look up a status effect's configured name (CONFIG.statusEffects is an array in older cores, a record in newer ones). */
function configStatusName(statusId) {
    if (!statusId) return '';
    try {
        const effects = CONFIG.statusEffects;
        const list = Array.isArray(effects) ? effects : Object.values(effects ?? {});
        const cfg = list.find(e => e?.id === statusId) ?? effects?.[statusId];
        const name = cfg?.name ?? cfg?.label;
        return name ? game.i18n.localize(name) : '';
    } catch (e) {
        return '';
    }
}

/** All status ids currently configured, or null if they can't be determined. */
function configStatusIds() {
    try {
        const effects = CONFIG.statusEffects;
        if (!effects) return null;
        if (Array.isArray(effects)) return new Set(effects.map(e => e?.id).filter(Boolean));
        return new Set(Object.entries(effects).map(([key, e]) => e?.id ?? key));
    } catch (e) {
        return null;
    }
}

/** Get the status id of a status icon element (v12 and v13+ markup). */
export function getStatusId(icon) {
    if (!icon) return undefined;
    const el = icon instanceof HTMLElement ? icon : icon[0];
    if (!el) return undefined;
    return el.dataset.statusId || el.dataset.effectId
        || el.children[0]?.dataset?.statusId || el.children[0]?.dataset?.effectId;
}

/** Get a human-readable name for a status icon element (v12 and v13+ markup). */
export function getEffectName(icon) {
    const el = icon instanceof HTMLElement ? icon : icon?.[0];
    if (!el) return '';
    const fromDom = el.querySelector('.effect-name')?.textContent?.trim()
        || el.dataset.tooltipText
        || el.dataset.tooltip
        || el.getAttribute('aria-label')
        || el.getAttribute('alt');
    if (fromDom) return fromDom;
    const statusId = getStatusId(el);
    const fromClt = game.clt?.conditions?.find?.(cond => cond.id === statusId)?.name;
    return fromClt || configStatusName(statusId) || '';
}

export class SortedStatusEffects {
    static init() {
        console.log('Sorted Status Effects | Initializing Sorted Status Effects module');
        // Register settings
        game.settings.register('sorted-status-effects', 'sortedStatusEffects', {
            name: 'Sorted Status Effects',
            scope: 'world',
            config: false,
            type: Object,
            default: undefined
        });
        game.settings.register('sorted-status-effects', 'statusEffectsTags', {
            name: 'Tags',
            scope: 'world',
            config: false,
            type: Object,
            default: undefined
        });
        game.settings.register('sorted-status-effects', 'tagIcons', {
            name: 'Tag Icons',
            scope: 'world',
            config: false,
            type: Object,
            default: {}
        });
        game.settings.register('sorted-status-effects', 'layoutOrientation', {
            name: 'Layout Orientation',
            scope: 'world',
            config: true,
            type: String,
            choices: {
                'horizontal': 'Horizontal',
                'vertical': 'Vertical'
            },
            default: 'horizontal'
        });
        game.settings.register('sorted-status-effects', 'statusHudSidebarMode', {
            name: 'Status HUD Sidebar Mode',
            scope: 'world',
            config: true,
            type: String,
            choices: {
                'tags': 'Tagged Effects',
                'active': 'Active Effects'
            },
            default: 'tags'
        });
        game.settings.register('sorted-status-effects', 'sidebarOpacity', {
            name: 'Sidebar Opacity',
            hint: 'Controls the opacity of the status effects sidebar (0.1-1.0)',
            scope: 'world',
            config: true,
            type: Number,
            range: {
                min: 0.1,
                max: 1.0,
                step: 0.1
            },
            default: 1.0
        });
        game.settings.register('sorted-status-effects', 'sidebarMaxColumns', {
            name: 'Sidebar Max Columns',
            hint: 'Controls the maximum number of columns displayed in the sidebar when in horizontal mode',
            scope: 'world',
            config: true,
            type: Number,
            range: {
                min: 1,
                max: 24,
                step: 1
            },
            default: 8
        });
        game.settings.register('sorted-status-effects', 'statusEffectHUDWidth', {
            name: 'Status Effect HUD Width',
            hint: 'Controls the width of the status effect HUD (in number of icons)',
            scope: 'world',
            config: true,
            type: Number,
            range: {
                min: 1,
                max: 20,
                step: 1
            },
            default: 4
        });
        game.settings.register('sorted-status-effects', 'showSearchBar', {
            name: 'Show Search Bar',
            hint: 'Show a search bar to filter status effects',
            scope: 'world',
            config: true,
            type: Boolean,
            default: true
        });
        game.settings.register('sorted-status-effects', 'showAboveHud', {
            name: 'Move the status effect tag icons above the HUD',
            scope: 'world',
            config: true,
            type: Boolean,
            default: true
        });
        
        game.settings.register('sorted-status-effects', 'aboveHudDisplay', {
            name: 'Above HUD Display Mode',
            hint: 'Choose what to display in the above HUD area when "Move icons above HUD" is enabled',
            scope: 'world',
            config: true,
            type: String,
            choices: {
                'tags': 'Tag Categories',
                'active': 'Active Effects'
            },
            default: 'tags'
        });
        
        game.settings.register('sorted-status-effects', 'debug', {
            name: 'Debug',
            scope: 'world',
            config: true,
            type: Boolean,
            default: false,
            requiresReload: true
        });

        // Add menu setting for the configuration dialog
        game.settings.registerMenu('sorted-status-effects', 'tagConfig', {
            name: 'Configure Tags',
            label: 'Configure Tags and Icons',
            icon: 'fas fa-tags',
            type: TagConfigurationDialog,
            restricted: true
        });
        
        // Add import/export menu
        game.settings.registerMenu('sorted-status-effects', 'importExport', {
            name: 'Import/Export Settings',
            label: 'Import/Export Settings',
            icon: 'fas fa-file-export',
            type: ImportExportDialog,
            restricted: true
        });

        // Add reset buttons in settings
        game.settings.registerMenu('sorted-status-effects', 'resetOptions', {
            name: 'Reset Options',
            label: 'Reset Sorting and Tags',
            icon: 'fas fa-cog',
            type: class ResetOptionsDialog extends FormApplicationV1 {
            static get defaultOptions() {
                return foundry.utils.mergeObject(super.defaultOptions, {
                title: 'Reset Options',
                id: 'reset-options',
                template: "modules/sorted-status-effects/templates/reset-options.html",
                width: 400
                });
            }
            async _updateObject(event, formData) {
                const confirmed = await DialogV1.confirm({
                title: "Reset Options",
                content: "Are you sure you want to reset the selected options?",
                yes: () => {
                    if (formData.resetSort) {
                    game.settings.set('sorted-status-effects', 'sortedStatusEffects', {});
                    ui.notifications.info('Status effect sorting has been reset');
                    }
                    if (formData.resetTags) {
                    game.settings.set('sorted-status-effects', 'statusEffectsTags', []);
                    game.settings.set('sorted-status-effects', 'tagIcons', {});
                    ui.notifications.info('Tags and icons have been reset');
                    }
                },
                no: () => {},
                defaultYes: false
                });
            }
            getData() {
                return {
                resetSort: false,
                resetTags: false
                };
            }
            },
            restricted: true
        });

        // Register keybinding
        game.keybindings.register('sorted-status-effects', 'toggleEffect', {
            name: 'Toggle Effect',
            hint: 'Toggle the effect when hovering over a status icon',
            editable: [{ key: 'KeyT' }],
            onDown: (context) => {
                if (debug) console.log('Keybinding pressed');
                onEffectKeyDown(context);
            },
            onUp: (context) => {
                if (debug) console.log('Keybinding released');
                onEffectKeyUp(context);
            },
            restricted: true
        });
        game.keybindings.register('sorted-status-effects', 'taggingMenu', {
            name: 'Tagging Menu',
            hint: 'Open the tagging menu',
            editable: [{ key: 'KeyQ' }],
            onDown: (context) => {
                if (debug) console.log('Keybinding pressed');
                onTagKeyDown(context);
            },
            restricted: true
        });
        // Foundry v13+ renders the Token HUD with ApplicationV2, which no longer has a _render method to wrap.
        // The renderTokenHUD hook fires after every render on v12, v13 and v14, so the HUD is altered from there
        // (registered in ready() so it runs after other modules' HUD hooks, as the old wrapper did).
    }

    static ready() {
        debug = game.settings.get('sorted-status-effects', 'debug');
        Hooks.on('renderTokenHUD', (hud, html) => {
            const root = html instanceof HTMLElement ? html : html?.[0];
            if (!root) return;
            try {
                SortedStatusEffects.staticAlterHUD($(root), hud);
            } catch (err) {
                console.error('Sorted Status Effects | Failed to alter the token HUD', err);
            }
        });
    }

    static staticAlterHUD(html, hud) {
        if (debug) console.log('alterHUD called: ', html);
        // Add a class to the token HUD to allow for custom styling.
        // (v13+ keeps the same #token-hud element between renders, so this must add rather than toggle.)
        const tokenHud = html.is('#token-hud') ? html : html.closest('#token-hud');
        (tokenHud.length ? tokenHud : $('#token-hud')).addClass('sorted-status-effects');

        // Get the status effects container and the status icons
        const statusEffectsContainer = html.find('.status-effects').first();
        if (!statusEffectsContainer.length) return;
        if (statusEffectsContainer[0].dataset.sseAltered === '1') {
            // The palette survived a re-render: clear what we added last time before rebuilding.
            statusEffectsContainer.find('#sse-search-container, #sse-tag-icon-container, #sse-active-status-effects-container').remove();
            statusEffectsContainer.children('[data-tag-id]').remove();
            statusEffectsContainer.children('.effect-control, .status-wrapper, .effect-container')
                .css({ order: '', display: '' })
                .removeClass('sse-filtered-out sse-search-highlight sse-search-match');
        }
        statusEffectsContainer[0].dataset.sseAltered = '1';

        // Add a search container at the top
        if (game.settings.get('sorted-status-effects', 'showSearchBar')) {
            const searchContainer = $(`
                <div id="sse-search-container">
                    <input type="text" id="sse-search-input" placeholder="Search effects..." autocomplete="off" spellcheck="false" />
                    <i class="fas fa-search" id="sse-search-icon"></i>
                </div>
            `);
            statusEffectsContainer.prepend(searchContainer);

            const searchInput = searchContainer.find('#sse-search-input');
            // Add event listener to the search input
            searchInput.on('input', function() {
                const searchTerm = $(this).val().toLowerCase().replace(/\s+/g, '');
                SortedStatusEffects.filterStatusEffects(searchTerm);
            });
            // The v13+ Token HUD is a form: keep typing, Enter and change events in the search box from
            // submitting it or triggering keybindings (T, Q, movement keys, ...).
            searchInput.on('keydown', function(event) {
                event.stopPropagation();
                if (event.key === 'Enter') event.preventDefault();
            });
            searchInput.on('change pointerdown', function(event) {
                event.stopPropagation();
            });
        }

        let statusIcons = statusEffectsContainer.children().filter('.effect-control');
        if (statusIcons.length === 0) statusIcons = statusEffectsContainer.children().filter('.status-wrapper');
        if (statusIcons.length === 0) statusIcons = statusEffectsContainer.children().filter('.effect-container');
        
        // Convert status icons to array early to make it available throughout the function
        const statusIconsArray = Array.from(statusIcons);

        if (debug) console.log('Sorted Status Effects | Status Effects Container:', statusEffectsContainer);
        if (debug) console.log('Sorted Status Effects | Status Icons:', statusIcons);
        
        // Get or initialize the sorted status effects object
        sortedStatusEffects = game.settings.get('sorted-status-effects', 'sortedStatusEffects');
        if (!sortedStatusEffects) {
            sortedStatusEffects = {};
        }
        const storedSnapshot = JSON.stringify(sortedStatusEffects);

        let baseStatusEffects = [];
        // This is the only real dependancy on the Condition Lab & Triggler module.
        // Integrating with other modules is as simple as changing the way the baseStatusEffects object is populated.
        // game.clt.conditions.forEach((condition) => {
        //     baseStatusEffects.push([
        //         condition.id,
        //         condition.hidden
        //     ]);
        // });
        statusIcons.each((index, icon) => {
            const effectId = getStatusId(icon);
            if (!effectId) {
                ui.notifications.error('Sorted Status Effects | NOT SORTING. Effect ID not found. Check the console for more information.');
                console.error('Sorted Status Effects | Effect ID not found:', icon);
                return;
            }
            if (debug) console.log('Sorted Status Effects | Icon:', icon);
            baseStatusEffects.push([
                effectId,
                false
            ]);
        });

        if (debug) console.log('Sorted Status Effects | Base status effects:', baseStatusEffects);

        // Populate the sorted status effects object with the base status effects.
        // New effects go after everything already sorted.
        let effectIds = [];
        let maxOrder = Object.values(sortedStatusEffects).reduce((max, e) => Math.max(max, Number(e?.order) || 0), 0);
        for (let i = 0; i < baseStatusEffects.length; i++) {
            if (sortedStatusEffects[baseStatusEffects[i][0]] === undefined) {
                sortedStatusEffects[baseStatusEffects[i][0]] = {
                    order: ++maxOrder,
                    hidden: baseStatusEffects[i][1] === undefined ? false : baseStatusEffects[i][1],
                    tag: []
                };
            }
            effectIds.push(baseStatusEffects[i][0]);
        }

        if (debug) console.log('Sorted Status Effects | Effect IDs:', effectIds);

        // Only forget effects that no longer exist at all. Since v12 the HUD can show different effects per
        // actor type (CONFIG.statusEffects[].hud.actorTypes), so an effect missing from this particular HUD
        // must keep its order and tags.
        const knownIds = configStatusIds();
        if (knownIds && knownIds.size > 0) {
            for (const key of Object.keys(sortedStatusEffects)) {
                if (!effectIds.includes(key) && !knownIds.has(key)) {
                    if (debug) console.log('Sorted Status Effects | Deleting status effect:', key);
                    delete sortedStatusEffects[key];
                }
            }
        }

        // Check if the status icons and effect IDs match
        if (statusIcons.length !== effectIds.length) {
            ui.notifications.error('Sorted Status Effects | NOT SORTING. Status Icons and Effect IDs do not match. Check your Condition Lab settings, and try removing default status effects. Check the console for more information.');
            console.error('Sorted Status Effects | Status Icons and Effect IDs do not match:', statusIcons.length, effectIds.length);
            console.error('Sorted Status Effects | Status Icons:', statusIcons);
            console.error('Sorted Status Effects | Effect IDs:', effectIds);
            console.error('Sorted Status Effects | Sorted Status Effects:', sortedStatusEffects);
            console.error('Sorted Status Effects | Base Status Effects:', baseStatusEffects);
            return;
        }

        // Only save when something changed, and only as a GM: these are world settings, which players can't write.
        if (game.user.isGM && JSON.stringify(sortedStatusEffects) !== storedSnapshot) {
            game.settings.set('sorted-status-effects', 'sortedStatusEffects', sortedStatusEffects);
        }

        if (debug) console.log('Sorted Status Effects | Sorted status effects:', sortedStatusEffects);

        let tags = game.settings.get('sorted-status-effects', 'statusEffectsTags');
        if (!Array.isArray(tags)) {
            tags = [];
        }

        if (debug) console.log('Sorted Status Effects | Tags:', tags);

        // Hud width is set in number of icons, so multiply by 38px (the size of the icons)
        let hudWidth = game.settings.get('sorted-status-effects', 'statusEffectHUDWidth') * 38;
        statusEffectsContainer.css('width', `${hudWidth}px`);

        // check for illandril-token-hud-scale and monks-little-details compatibility
        let size = 24;
        let sizeW = 24;
        const monksLittleDetailsAlterHud = monksAlterHud();
        if (game.modules.get('illandril-token-hud-scale')?.active && !monksLittleDetailsAlterHud) {
            size = 36;
            sizeW = 36;
        }
        // create a new div for the tag icons above the hud
        const tagIconContainer = $(`<div id="sse-tag-icon-container"></div>`);
        statusEffectsContainer.append(tagIconContainer);
        if (!game.settings.get('sorted-status-effects', 'showAboveHud') && monksLittleDetailsAlterHud) {
            sizeW = 126;
        }

        // Get the HUD's token and its actor to check for status effects
        const actor = hud?.actor ?? hud?.object?.actor ?? canvas.tokens.controlled[0]?.actor;
        let activeEffects = Array.from(actor?.statuses ?? []);
        if (activeEffects.length > 0 && activeEffects[0] instanceof Object) {
            // If the active effects are objects, get the IDs
            activeEffects = activeEffects.map(effect => effect.id);
        }
        if (debug) console.log('Sorted Status Effects | Actor Effects:', activeEffects);

        // Check if we're showing active effects above the HUD
        const aboveHudDisplay = game.settings.get('sorted-status-effects', 'aboveHudDisplay');
        const showAboveHud = game.settings.get('sorted-status-effects', 'showAboveHud');

        // Make icons for the tags
        const tagIcons = game.settings.get('sorted-status-effects', 'tagIcons') || {};
        if (tags.length > 0) {
            let count = 0;
            for (let tag of tags) {
                let iconSrc = tagIcons[tag] || 'icons/svg/d20.svg';
                let tagIcon = $(`<div class="status-wrapper" data-tag-id="${tag}" style="
                    ${shownTags.includes(tag) ? 'border: 1px solid green;' : 'border: 1px solid #fff;'} 
                    border-radius: 4px;
                    width: ${sizeW}px;
                    height: ${size}px;">
                    <img class="" style="
                    width: ${size}px;
                    height: ${size}px;
                    margin: 0;
                    padding: 0;
                    border: none;
                    opacity: ${shownTags.includes(tag) ? 1 : 0.5};" 
                    src="${iconSrc}" 
                    data-tooltip="${tag}"
                    data-is-tag="true"></div>`);
                tagIcon.css('order', 0);
                tagIcon.on('click', function(event) {
                    const tagIndex = shownTags.indexOf(tag);
                    if (tagIndex === -1) {
                        shownTags.push(tag);
                    } else {
                        shownTags.splice(tagIndex, 1);
                    }
                    if (debug) console.log('Sorted Status Effects | Shown Tags:', shownTags);
                    // Re-render the HUD to apply the changes
                    (hud ?? canvas.hud?.token ?? canvas.tokens.hud)?.render();
                });
                // Only add tag icons if not showing active effects above HUD or if not showing above HUD
                if (showAboveHud && aboveHudDisplay === 'tags') {
                    tagIconContainer.append(tagIcon);
                    tagIcon.css('border-bottom', 'none');
                    tagIcon.css('border-radius', '4px 4px 0px 0px')
                    tagIcon.css('border-color', '#bbb')
                    tagIcon.css('background', '#333')
                    if (!monksLittleDetailsAlterHud) {
                        tagIcon.css('width', '38px');
                    }
                } else if (!showAboveHud || (showAboveHud && aboveHudDisplay === 'active')) {
                    // Show tag categories in the main HUD if either:
                    // 1. Not showing above HUD at all, OR
                    // 2. Above HUD is in active effects mode
                    if (monksLittleDetailsAlterHud) {
                        // Add a text label to the tag icons
                        tagIcon.append(`<div class="effect-name" style="${shownTags.includes(tag) ? 'opacity: 1' : ''}">${tag}</div>`);
                    }
                    statusEffectsContainer.append(tagIcon);
                }
                count++;
            }
        }

        // If we're showing active effects above the HUD, add them
        if (showAboveHud && aboveHudDisplay === 'active' && activeEffects.length > 0) {
            // Style the container for active effects
            tagIconContainer.addClass('active-effects-container');
            
            // Add each active effect as an icon
            for (let effectId of activeEffects) {
                const effect = sortedStatusEffects[effectId];
                if (!effect) continue;
                
                // Find the original icon for this effect
                const originalIcon = statusIconsArray.find(icon => getStatusId(icon) === effectId);
                
                if (originalIcon) {
                    const $originalIcon = $(originalIcon);
                    const effectIcon = $originalIcon.clone();
                    tagIconContainer.append(effectIcon);
                }
            }
        }

        // Create a container for the active status effects
        const activeStatusEffectsContainer = $('<div id="sse-active-status-effects-container"></div>');
        activeStatusEffectsContainer.append(`<div class="sse-active-status-effects-category" data-tag="Default"></div>`);
        for(let tag of tags) {
            activeStatusEffectsContainer.append(`<div class="sse-active-status-effects-category" data-tag="${tag}"></div>`);
        }
        const gap = 1;
        const rightMargin = 5;
        // Remove the gap from the container level
        if (game.settings.get('sorted-status-effects', 'layoutOrientation') === 'vertical') {
            activeStatusEffectsContainer.css('flex-direction', 'row');
            activeStatusEffectsContainer.css('width', `${(size + gap) * (tags.length + 1)}px`);
            // Apply gap only within categories
            activeStatusEffectsContainer.find('.sse-active-status-effects-category').css({
                'flex-direction': 'column',
                'gap': `${gap}px`
            });
        } else {
            activeStatusEffectsContainer.css('flex-direction', 'column');
            // Apply gap only within categories
            activeStatusEffectsContainer.find('.sse-active-status-effects-category').css({
                'flex-direction': 'row',
                'gap': `${gap}px`
            });
        }
        
        // Add opacity setting
        const opacity = game.settings.get('sorted-status-effects', 'sidebarOpacity');
        // Sort the status icons based on the sorted status effects object
        statusIconsArray.forEach((icon, index) => {
            if (debug) console.log('Sorted Status Effects | Icon:', icon);
            const effectId = effectIds[index];
            const effect = sortedStatusEffects[effectId];
            if (debug) console.log('Sorted Status Effects | Effect and ID:', effect, effectId);
            if (effect) {
                // If sidebar is in 'active' mode, then if the effect is on the actor, make a copy of the effect to place in the container
                if (game.settings.get('sorted-status-effects', 'statusHudSidebarMode') === 'active') {
                    if (activeEffects.find((actorEffect) => actorEffect === effectId)) {
                        const actorEffect = activeEffects.find((actorEffect) => actorEffect.id === effectId);
                        const actorEffectIcon = $(icon).clone();
                        actorEffectIcon.css('height', `${size}px`);
                        actorEffectIcon.css('width', `${size}px`);
                        const effectName = getEffectName(icon);
                        if (effectName) actorEffectIcon.attr('data-tooltip', effectName);
                        actorEffectIcon.css('order', `${effect.order}`);
                        actorEffectIcon.css('opacity', opacity);
                        if (effect.tags && effect.tags.length > 0) {
                            for (let tag of effect.tags) {
                                const categoryContainer = activeStatusEffectsContainer.find(`.sse-active-status-effects-category[data-tag="${tag}"]`);
                                categoryContainer.append(actorEffectIcon.clone());
                            }
                        } else {
                            const categoryContainer = activeStatusEffectsContainer.find(`.sse-active-status-effects-category[data-tag="Default"]`);
                            categoryContainer.append(actorEffectIcon);
                        }
                    }
                } else {
                    // If the effect is not hidden, clone the icon and add it to the container
                    if (!effect.hidden) {
                        const effectIcon = $(icon).clone();
                        effectIcon.css('height', `${size}px`);
                        effectIcon.css('width', `${size}px`);
                        const effectName = getEffectName(icon);
                        if (debug) console.log(`Sorted Status Effects | Adding ${effectName} to sidebar`, effectIcon)
                        if (effectName) effectIcon.attr('data-tooltip', effectName);
                        effectIcon.css('order', `${effect.order}`);
                        let activeOpacity = activeEffects.find((actorEffect) => actorEffect === effectId) ? 1 : opacity;
                        effectIcon.css('opacity', activeOpacity);
                        if (effect.tags && effect.tags.length > 0) {
                            for (let tag of effect.tags) {
                                if (shownTags.includes(tag)) {
                                    const categoryContainer = activeStatusEffectsContainer.find(`.sse-active-status-effects-category[data-tag="${tag}"]`);
                                    categoryContainer.append(effectIcon.clone());
                                }
                            }
                        }
                    }
                }

                // Set the order and visibility of the original status icons
                $(icon).css('order', effect.order);
                if (effect.hidden) {
                    $(icon).css('display', 'none');
                }
                if (effect.tags && effect.tags.length > 0) {
                    if (debug) console.log('Sorted Status Effects | Effect Tags:', effect.tags);
                    let hide = true;
                    // Only show effects with tags in the sidebar if in 'tags' mode
                    if (game.settings.get('sorted-status-effects', 'statusHudSidebarMode') === 'active') {
                        for (let tag of effect.tags) {
                            if (shownTags.includes(tag)) {
                                hide = false;
                            }
                        }
                    }
                    if (hide) {
                        $(icon).css('display', 'none');
                    }
                }
            } else {
                console.error('Sorted Status Effects | Effect not found:', index, effectId);
            }
        });

        if (game.settings.get('sorted-status-effects', 'layoutOrientation') === 'horizontal') {
            let maxEffects = 0;
            let nonEmptyCategories = 0;
            activeStatusEffectsContainer.children().each((index, element) => {
                const category = $(element);
                if (category.children().length > 0) {
                    nonEmptyCategories++;
                    if (category.children().length > maxEffects) {
                        maxEffects = category.children().length;
                    }
                }
            });            if (maxEffects > 0) {
                activeStatusEffectsContainer.css('width', `${(size + gap) * maxEffects}px`);
                // Use the new setting for maximum columns instead of a hardcoded value
                const maxColumns = game.settings.get('sorted-status-effects', 'sidebarMaxColumns');
                const cappedMaxEffects = Math.min(maxEffects, maxColumns);
                activeStatusEffectsContainer.css('width', `${(size + gap) * cappedMaxEffects}px`);
                activeStatusEffectsContainer.css('max-width', `${(size + gap) * maxColumns + 10}px`);
            } else {
                // If no effects are shown, collapse the container
                activeStatusEffectsContainer.css('width', '0');
            }
        } else {
            // For vertical layout, adjust width based on non-empty categories
            let nonEmptyCategories = 0;
            activeStatusEffectsContainer.children().each((index, element) => {
                if ($(element).children().length > 0) {
                    nonEmptyCategories++;
                }
            });
            if (nonEmptyCategories > 0) {
                activeStatusEffectsContainer.css('width', `${(size + gap) * nonEmptyCategories}px`);
            } else {
                // If no effects are shown, collapse the container
                activeStatusEffectsContainer.css('width', '0');
            }
        }
        // Add the container after processing all icons
        statusEffectsContainer.append(activeStatusEffectsContainer);
    }

    // Add this static method to handle the filtering logic
    static filterStatusEffects(searchTerm) {
        if (debug) console.log('Filtering by search term:', searchTerm);
        const statusEffectsContainer = $('#token-hud').find('.status-effects');
        
        // Get all status effect icons (exclude the tag icons and our UI elements)
        const statusIcons = statusEffectsContainer.children().filter(function() {
            return ($(this).hasClass('effect-control') || 
                   $(this).hasClass('status-wrapper') || 
                   $(this).hasClass('effect-container')) && 
                   !$(this).attr('data-tag-id');
        });
        
        // Get tag icons in the main area
        const tagIcons = statusEffectsContainer.children().filter(function() {
            return $(this).attr('data-tag-id');
        });
        
        // Get tag icons in the above-HUD container (when showAboveHud is true)
        const aboveHudTagIcons = $('#sse-tag-icon-container').children().filter(function() {
            return $(this).attr('data-tag-id');
        });
        
        // Get tag categories in the sidebar
        const categories = $('#sse-active-status-effects-container').children('.sse-active-status-effects-category');
        
        // Track which tags have matching effects (to ensure their categories are shown)
        let tagsWithMatchingEffects = [];
        
        if (searchTerm === '') {
            // If search is empty, restore original display states
            statusIcons.each(function() {
                const icon = $(this);
                // Remove our temp search classes
                icon.removeClass('sse-filtered-out sse-search-highlight sse-search-match');
                
                // If this was an icon we temporarily showed during search, re-hide it
                if (icon.data('wasHidden')) {
                    icon.css('display', 'none');
                    icon.removeData('wasHidden');
                }
            });
            
            // Clear classes from main area tag icons
            tagIcons.each(function() {
                $(this).removeClass('sse-filtered-out sse-search-highlight sse-search-match');
            });
            
            // Also clear classes from above-HUD tag icons
            aboveHudTagIcons.each(function() {
                $(this).removeClass('sse-filtered-out sse-search-highlight sse-search-match');
            });
            
            categories.each(function() {
                $(this).removeClass('sse-filtered-out sse-search-highlight sse-search-match');
                
                // Also remove highlight classes from all children
                $(this).find('*').removeClass('sse-search-highlight sse-search-match');
            });
            
            // Remove any temporary effects we added for search
            $('.sse-temp-search-effect').remove();
            return;
        }
        
        // First pass: identify tags with matching effects
        statusIcons.each(function() {
            const icon = $(this);
            const effectId = getStatusId(icon);
            
            // Get effect tags if available
            const effect = sortedStatusEffects[effectId];
            if (!effect || !effect.tags || effect.tags.length === 0) return;
            
            const tooltip = getEffectName(icon) || '';
            const effectName = '';
            const normalizedName = (tooltip + ' ' + effectName).toLowerCase().replace(/\s+/g, '');
            
            // Check if effect matches search by name
            const matchesName = normalizedName.includes(searchTerm);
            
            // Check if effect matches search by tag
            const matchesTags = effect.tags.some(tag => 
                tag.toLowerCase().replace(/\s+/g, '').includes(searchTerm)
            );
            
            // If this effect matches the search, mark all its tags
            if (matchesName || matchesTags) {
                effect.tags.forEach(tag => {
                    if (!tagsWithMatchingEffects.includes(tag)) {
                        tagsWithMatchingEffects.push(tag);
                    }
                });
            }
        });
        
        // Process status icons - show normally hidden ones if they match search
        statusIcons.each(function() {
            const icon = $(this);
            const tooltip = getEffectName(icon) || '';
            const effectName = '';
            const effectId = getStatusId(icon);
            
            // Get effect tags if available
            let effectTags = [];
            const effect = sortedStatusEffects[effectId];
            if (effect && effect.tags) {
                effectTags = effect.tags;
            }
            
            // Normalize text for search (remove spaces, lowercase)
            const normalizedName = (tooltip + ' ' + effectName).toLowerCase().replace(/\s+/g, '');
            
            // Check if effect matches search by name
            const matchesName = normalizedName.includes(searchTerm);
            
            // Check if effect matches search by tag
            let matchesTags = false;
            if (effectTags.length > 0) {
                matchesTags = effectTags.some(tag => 
                    tag.toLowerCase().replace(/\s+/g, '').includes(searchTerm));
            }
            
            // Show/hide based on search match
            if (matchesName || matchesTags) {
                icon.removeClass('sse-filtered-out');
                
                // If normally hidden due to tag filtering, show it while searching
                if (icon.css('display') === 'none') {
                    // Mark that this was hidden so we can re-hide it when search is cleared
                    icon.data('wasHidden', true);
                    icon.css('display', '');
                }
            } else {
                icon.addClass('sse-filtered-out');
            }
        });
        
        // Function to process tag icons (used for both main area and above-HUD)
        const processTagIcon = function(tagIcon) {
            const tagId = tagIcon.attr('data-tag-id') || '';
            const normalizedTagId = tagId.toLowerCase().replace(/\s+/g, '');
            
            // Show tag if it matches search term OR if any effect in this category matches
            if (normalizedTagId.includes(searchTerm) || tagsWithMatchingEffects.includes(tagId)) {
                tagIcon.removeClass('sse-filtered-out');
                // Highlight the tag if it has matching effects but doesn't match directly
                if (tagsWithMatchingEffects.includes(tagId) && !normalizedTagId.includes(searchTerm)) {
                    tagIcon.addClass('sse-search-highlight');
                } else {
                    tagIcon.removeClass('sse-search-highlight');
                }
            } else {
                tagIcon.addClass('sse-filtered-out');
            }
        };
        
        // Process tag icons in main area
        tagIcons.each(function() {
            processTagIcon($(this));
        });
        
        // Process tag icons in above-HUD container
        aboveHudTagIcons.each(function() {
            processTagIcon($(this));
        });
        
        // Process category sections in sidebar
        categories.each(function() {
            const category = $(this);
            const tagId = category.attr('data-tag') || '';
            const normalizedTagId = tagId.toLowerCase().replace(/\s+/g, '');
            
            // Show category if tag matches OR if any of its effects match search
            const tagDirectlyMatches = normalizedTagId.includes(searchTerm);
            const tagHasMatchingEffects = tagsWithMatchingEffects.includes(tagId);
            
            if (tagDirectlyMatches || tagHasMatchingEffects) {
                category.removeClass('sse-filtered-out');
                
                // Highlight the category if it has matching effects but doesn't match directly
                if (tagHasMatchingEffects && !tagDirectlyMatches) {
                    category.addClass('sse-search-highlight');
                } else {
                    category.removeClass('sse-search-highlight');
                }
                
                // Process children
                category.children().each(function() {
                    const child = $(this);
                    const tooltip = getEffectName(child) || '';
                    const effectName = '';
                    const normalizedEffectName = (tooltip + ' ' + effectName).toLowerCase().replace(/\s+/g, '');
                    
                    if (normalizedEffectName.includes(searchTerm)) {
                        child.removeClass('sse-filtered-out');
                        child.addClass('sse-search-match'); // Mark as direct match
                    } else {
                        child.addClass('sse-filtered-out');
                        child.removeClass('sse-search-match');
                    }
                });
            } else {
                category.addClass('sse-filtered-out');
                category.removeClass('sse-search-highlight');
            }
        });
        
        // Create and display matching status effects from normally hidden categories
        if (searchTerm !== '' && statusIcons.length > 0 && statusIcons instanceof Array) {
            statusIcons.forEach((icon, index) => {
                const $icon = $(icon);
                const effectId = getStatusId($icon);
                
                const effect = sortedStatusEffects[effectId];
                
                // Skip if effect doesn't exist or doesn't have tags
                if (!effect || !effect.tags || effect.tags.length === 0) return;
                
                const tooltip = getEffectName($icon) || '';
                const effectName = '';
                const normalizedName = (tooltip + ' ' + effectName).toLowerCase().replace(/\s+/g, '');
                
                // Check if should be shown in search (matches name or tag)
                const matchesName = normalizedName.includes(searchTerm);
                const matchesTags = effect.tags.some(tag => 
                    tag.toLowerCase().replace(/\s+/g, '').includes(searchTerm));
                
                if (matchesName || matchesTags) {
                    // For each tag of this effect
                    effect.tags.forEach(tag => {
                        // Always show the effect in its category during search if it matches
                        const categoryContainer = $('#sse-active-status-effects-container')
                            .find(`.sse-active-status-effects-category[data-tag="${tag}"]`);
                        
                        if (categoryContainer.length) {
                            // Show the category while searching
                            categoryContainer.removeClass('sse-filtered-out');
                            
                            // Check if we need to create a temporary copy of this effect in the category
                            const existingEffect = categoryContainer.find(`[data-status-id="${effectId}"], [data-effect-id="${effectId}"]`);
                            
                            if (existingEffect.length === 0) {
                                const effectIcon = $icon.clone();
                                effectIcon.css('height', `24px`); // Use standard size
                                effectIcon.css('width', `24px`);
                                effectIcon.attr('data-tooltip', effectName || tooltip);
                                effectIcon.css('order', `${effect.order}`);
                                effectIcon.addClass('sse-temp-search-effect'); // Mark as temporary
                                
                                // Add visual highlight for matched effects
                                if (matchesName) {
                                    effectIcon.addClass('sse-search-match');
                                }
                                
                                categoryContainer.append(effectIcon);
                            } else {
                                // If it exists but is filtered out, show it
                                existingEffect.removeClass('sse-filtered-out');
                                if (matchesName) {
                                    existingEffect.addClass('sse-search-match');
                                }
                            }
                        }
                    });
                }
            });
        }
    }
}

Hooks.once('init', async function() {
    console.log('Sorted Status Effects | Initializing Sorted Status Effects module');
    SortedStatusEffects.init();
});

Hooks.once('ready', async function() {
    console.log('Sorted Status Effects | Ready');
    SortedStatusEffects.ready();
});

/** Hook to apply custom keybinds to the token HUD. */
Hooks.on("renderTokenHUD", function(tokenHud, html) {
    registerKeybinds(tokenHud, html);
});