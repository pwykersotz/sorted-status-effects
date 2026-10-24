// AI-CODED: This file was modified by an AI (Claude Opus 5.5, Anthropic) for Foundry v13/v14 compatibility.
// These changes were not written or reviewed by the original author. See the notice in README.md.
/**
 * The currently hovered token HUD entity and status icon element.
 */
let activeEffectHud, activeEffectHudIcon, targetStatusId;
let statusEffectsTags = [];
let _dragIcon, _onMouseMove;
let isTagDrag = false;

// Foundry v13+ moved these classes into namespaces; fall back to the old globals on older cores.
const DialogV1 = foundry.appv1?.api?.Dialog ?? globalThis.Dialog;
const getFilePicker = () => foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;

/** Status id of a hovered status icon (v12 and v13+ markup). */
function statusIdOf(icon) {
    return icon?.dataset?.statusId || icon?.dataset?.effectId
        || icon?.children?.[0]?.dataset?.statusId || icon?.children?.[0]?.dataset?.effectId;
}

/**
 * Applies keybinds to the given entity to change status counters. Which 
 *  methods are used depends on the configuration. Previously registered 
 *  handlers are unregistered wherever necessary.
 * @param {TokenHUD} entity The Foundry entity associated with the element.
 * @param {jQuery} html The HTML code of the element.
 */
export function registerKeybinds(entity, html) {
    // v13+ passes an HTMLElement to render hooks; older versions pass jQuery.
    const root = html instanceof HTMLElement ? html : html?.[0];
    let effectHud = root?.querySelector(".status-effects");
    if (!effectHud || effectHud.dataset.sseKeybinds === "1") return;
    effectHud.dataset.sseKeybinds = "1";

    on(effectHud, "mouseover", ".effect-control", onEffectMouseOver.bind(entity));
    on(effectHud, "mouseout", ".effect-control", onEffectMouseOut.bind(entity));
    on(effectHud, "mouseover", ".status-wrapper", onEffectMouseOver.bind(entity));
    on(effectHud, "mouseout", ".status-wrapper", onEffectMouseOut.bind(entity));
}

/**
 * Handles the mouseover event onto a status icon to store the active entity so that it can be accessed by the global
 *  key event handler.
 * @param {PointerEvent} event The mouse over event.
 */
function onEffectMouseOver(event) {
    activeEffectHud = this;
    activeEffectHudIcon = event.delegateTarget;
}

/**
 * Handles the mouseout event off a status icon to reset the active entity so that it can no longer be accessed by the
 *  global key event handler.
 */
function onEffectMouseOut() {
    if (activeEffectHud === this) {
        activeEffectHud = activeEffectHudIcon = null;
    }
}

/**
 * Handles the keydown sorting event for the currently active status icon HUD element. If none is active
 *  this handler returns immediately. Otherwise, we store the statusId.
 * @param {jQuery.Event} event The key down event triggered by jQuery.
 */
export function onEffectKeyDown(event) {
    let debug = game.settings.get('sorted-status-effects', 'debug');
    // Clear any drag icon left behind by a missed key release
    if (_dragIcon) {
        document.removeEventListener('mousemove', _onMouseMove);
        _dragIcon.remove();
        _dragIcon = null;
    }
    if (!activeEffectHudIcon) return;
    // Check if we're dragging a tag by looking for data-is-tag on the img element
    const imgElement = activeEffectHudIcon.querySelector('img');
    isTagDrag = imgElement ? imgElement.dataset.isTag === "true" : false;

    // For tags, we don't need to check activeEffectHud visibility
    if (!isTagDrag && (!activeEffectHud || !activeEffectHud.object?.visible)) return;

    event.currentTarget = activeEffectHudIcon;
    const statusId = isTagDrag ?
        activeEffectHudIcon.dataset.tagId :
        statusIdOf(activeEffectHudIcon);

    if (debug) console.log("SSE| " + (isTagDrag ? "Tag: " : "Status: ") + statusId);

    targetStatusId = statusId;

    // check for illandril-token-hud-scale and monks-little-details compatibility
    let size = 24;
    let monksAlterHud = false;
    try {
        monksAlterHud = !!game.modules.get('monks-little-details')?.active && !!game.settings.get('monks-little-details', 'alter-hud');
    } catch (e) { /* setting not registered */ }
    if (game.modules.get('illandril-token-hud-scale')?.active && !monksAlterHud) {
        size = 36;
    }

    // Create drag icon
    let iconSrc;
    if (isTagDrag) {
        const tagIcons = game.settings.get('sorted-status-effects', 'tagIcons') || {};
        iconSrc = tagIcons[statusId] || 'icons/svg/d20.svg';
    } else {
        iconSrc = event.currentTarget.src || event.currentTarget.querySelector('img')?.src;
    }

    let icon = document.createElement('img');
    icon.src = iconSrc;
    icon.style.position = 'absolute';
    icon.style.top = '0';
    icon.style.left = '0';
    icon.style.width = `${size}px`;
    icon.style.height = `${size}px`;
    icon.style.pointerEvents = 'none';
    icon.style.zIndex = '9999';
    document.body.appendChild(icon);

    // Update the icon position to follow the mouse cursor
    const onMouseMove = (event) => {
        icon.style.top = `${event.clientY - (size/2)}px`;
        icon.style.left = `${event.clientX - (size/2)}px`;
    };

    document.addEventListener('mousemove', onMouseMove);

    // Store the icon and onMouseMove handler for cleanup in onEffectKeyUp
    _dragIcon = icon;
    _onMouseMove = onMouseMove;
}

/**
 * Handles the keyup sorting event for the currently active status icon HUD element. If none is active
 *  this handler returns immediately. Otherwise, we change the order of the sorted effects if not the same target.
 * @param {jQuery.Event} event The key down event triggered by jQuery.
 */
export async function onEffectKeyUp(event) {
    // Cleanup: remove the icon and event listeners
    document.removeEventListener('mousemove', _onMouseMove);
    if (!_dragIcon) return;
    _dragIcon.remove();
    _dragIcon = null;

    let debug = game.settings.get('sorted-status-effects', 'debug');

    // Released away from any icon: nothing to drop onto
    if (!activeEffectHudIcon) return;

    // Get either status ID or tag ID of target
    const imgElement = activeEffectHudIcon.querySelector('img');
    const isTargetTag = imgElement ? imgElement.dataset.isTag === "true" : false;

    // Don't allow mixing tags and effects
    if (isTagDrag !== isTargetTag) return;

    if ((!activeEffectHud || !activeEffectHud.object?.visible) && !isTagDrag) return;

    event.currentTarget = activeEffectHudIcon;
    const statusId = isTagDrag ?
        activeEffectHudIcon.dataset.tagId :
        statusIdOf(activeEffectHudIcon);

    if (debug) console.log("SSE| " + (isTagDrag ? "Tag: " : "Status: ") + statusId);

    if (targetStatusId === statusId) return;

    if (isTagDrag) {
        // Handle tag reordering
        let tags = game.settings.get('sorted-status-effects', 'statusEffectsTags') || [];
        const fromIndex = tags.indexOf(targetStatusId);
        const toIndex = tags.indexOf(statusId);
        
        if (fromIndex !== -1 && toIndex !== -1) {
            // Remove tag from old position and insert at new position
            tags.splice(fromIndex, 1);
            tags.splice(toIndex, 0, targetStatusId);
            await game.settings.set('sorted-status-effects', 'statusEffectsTags', tags);
        }
    } else {

        let sortedStatus = game.settings.get('sorted-status-effects', 'sortedStatusEffects');
        if (debug) console.log("SSE| Presorted:", sortedStatus);

        // Get the orders of the statusId and targetStatusId
        const statusOrder = sortedStatus[statusId]?.order;
        const targetOrder = sortedStatus[targetStatusId]?.order;

        if (statusOrder === undefined || targetOrder === undefined) return;

        // If moving an item to a later position in the order
        if (targetOrder < statusOrder) {
            // Shift everything between target and status down by 1
            for (const [key, value] of Object.entries(sortedStatus)) {
                if (value.order > targetOrder && value.order <= statusOrder) {
                    value.order--;
                }
            }
            sortedStatus[targetStatusId].order = statusOrder;
        } else {
            // If moving an item to an earlier position
            // Shift everything between status and target up by 1
            for (const [key, value] of Object.entries(sortedStatus)) {
                if (value.order >= statusOrder && value.order < targetOrder) {
                    value.order++;
                }
            }
            sortedStatus[targetStatusId].order = statusOrder;
        }

        await game.settings.set('sorted-status-effects', 'sortedStatusEffects', sortedStatus);

        if (debug) console.log("SSE| Postsorted:", sortedStatus);
    }
    // Force a refresh of the status icons
    (activeEffectHud ?? canvas.hud?.token)?.render();
}

/**
 * Handles the keydown tagger menu event for the currently active status icon HUD element. If none is active
 *  this handler returns immediately. Otherwise, we display the tagging menu dialog.
 * @param {jQuery.Event} event The key down event triggered by jQuery.
 */
export function onTagKeyDown(event) {
    let debug = game.settings.get('sorted-status-effects', 'debug');
    if (!activeEffectHud || !activeEffectHud.object?.visible || !activeEffectHudIcon) return;

    event.currentTarget = activeEffectHudIcon;
    const statusId = statusIdOf(activeEffectHudIcon);

    if (debug) console.log("SSE| " + statusId);

    // Tag icons and anything that isn't a status effect can't be tagged
    let sortedStatus = game.settings.get('sorted-status-effects', 'sortedStatusEffects') || {};
    if (!statusId || !sortedStatus[statusId]) return;
    let tags = sortedStatus[statusId].tags || [];
    let tagIcons = game.settings.get('sorted-status-effects', 'tagIcons') || {};

    statusEffectsTags = game.settings.get('sorted-status-effects', 'statusEffectsTags') || [];

    // Create the tagging menu dialog with checkboxes and icons
    let content = `<div><label>Available Tags:</label><ul style="list-style: none; padding-left: 0;">`;
    if (statusEffectsTags.length > 0) {
        for (let tag of statusEffectsTags) {
            let checked = tags.includes(tag) ? 'checked' : '';
            let iconSrc = tagIcons[tag] || 'icons/svg/d20.svg';
            content += `
                <li style="display: flex; align-items: center; gap: 5px; margin-bottom: 5px;">
                    <input type="checkbox" data-tag="${tag}" ${checked}/>
                    <img src="${iconSrc}" width="24" height="24" style="flex: 0 0 24px;"/>
                    <span style="flex: 1;">${tag}</span>
                </li>`;
        }
    }
    content += `</ul>
        <div style="display: flex; gap: 5px; align-items: center;">
            <label>Add Tag:</label>
            <input type="text" id="new-status-tag" style="flex: 1;"/>
        </div>
        <div style="display: flex; gap: 5px; align-items: center; margin-top: 5px;">
            <label>Icon:</label>
            <input type="text" id="new-status-icon" style="flex: 1;" value="icons/svg/d20.svg"/>
            <button type="button" class="file-picker" data-type="imagevideo" data-target="new-status-icon">
                <i class="fas fa-file-import fa-fw"></i>
            </button>
        </div>
    </div>`;

    let effectHud = activeEffectHud;
    let d = new DialogV1({
        title: "Tagging Menu",
        content: content,
        buttons: {
            save: {
                label: "Save Tags",
                callback: async (html) => {
                    let newTag = html.find('#new-status-tag').val()?.trim();
                    let newIcon = html.find('#new-status-icon').val()?.trim();
                    if (!Array.isArray(statusEffectsTags)) {
                        statusEffectsTags = [];
                    }
                    if (newTag && !statusEffectsTags.includes(newTag)) {
                        statusEffectsTags.push(newTag);
                        await game.settings.set('sorted-status-effects', 'statusEffectsTags', statusEffectsTags);
                        
                        // Save the icon for the new tag
                        if (newIcon) {
                            tagIcons[newTag] = newIcon;
                            await game.settings.set('sorted-status-effects', 'tagIcons', tagIcons);
                        }
                    }
                    let selectedTags = [];
                    html.find('input[type="checkbox"]:checked').each(function() {
                        selectedTags.push(this.dataset.tag);
                    });
                    sortedStatus[statusId].tags = selectedTags;
                    if (newTag && !selectedTags.includes(newTag)) selectedTags.push(newTag);
                    await game.settings.set('sorted-status-effects', 'sortedStatusEffects', sortedStatus);
                    // Force a refresh of the status icons
                    (effectHud ?? canvas.hud?.token)?.render();
                }
            },
            close: {
                label: "Close"
            }
        },
        default: "save",
        render: (html) => {
            // Initialize FilePicker for the icon input
            const picker = html.find('button.file-picker');
            picker.click((event) => {
                const button = event.currentTarget;
                const input = html.find(`#${button.dataset.target}`);
                const FilePickerClass = getFilePicker();
                const fp = new FilePickerClass({
                    type: button.dataset.type,
                    current: input.val(),
                    callback: path => {
                        input.val(path);
                    }
                });
                fp.browse();
            });
        }
    });
    d.render(true);
}

function on(element, type, selector, handler, capture = false) {
    element.addEventListener(type, event => {
        const actualTarget = event.target.closest(selector);
        if (actualTarget) {
            event.delegateTarget = actualTarget;
            handler(event);
        }
    }, capture);
}