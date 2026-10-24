// AI-CODED: This file was modified by an AI (Claude Opus 5.5, Anthropic) for Foundry v13/v14 compatibility.
// These changes were not written or reviewed by the original author. See the notice in README.md.
// Foundry v13+ moved the V1 application classes into namespaces; fall back to the old globals on older cores.
const FormApplicationV1 = foundry.appv1?.api?.FormApplication ?? globalThis.FormApplication;
const getFilePicker = () => foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;

export class TagConfigurationDialog extends FormApplicationV1 {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'tag-configuration',
            title: 'Tag Configuration',
            template: 'modules/sorted-status-effects/templates/tag-config.html',
            width: 500,
            height: 'auto',
            closeOnSubmit: true
        });
    }

    getData() {
        const tags = game.settings.get('sorted-status-effects', 'statusEffectsTags') || [];
        const tagIcons = game.settings.get('sorted-status-effects', 'tagIcons') || {};

        if (tags.length === 0 || !tags[0]) {
            return {
                tags: [{ name: '', icon: '' }]
            };
        }
        
        return {
            tags: tags.map(tag => ({
                name: tag,
                icon: tagIcons[tag] || 'icons/svg/d20.svg'
            }))
        };
    }

    activateListeners(html) {
        super.activateListeners(html);

        // Add click handler for delete buttons
        html.find('.delete-tag').click(this._onDeleteTag.bind(this));

        // Add input handler for icon path changes
        html.find('input[name^="tagIcon"]').on('change', this._onIconPathChange.bind(this));

        // Initialize FilePicker with a single delegated handler
        // (FilePicker.browse() only lists a folder; open an actual picker and fill the field with the choice.)
        html.find('#tag-list').on('click', 'button.file-picker', (event) => {
            const input = $(event.currentTarget).siblings('input[name^="tagIcon"]');
            const FilePickerClass = getFilePicker();
            const fp = new FilePickerClass({
                type: event.currentTarget.dataset.type || 'imagevideo',
                current: input.val(),
                callback: path => input.val(path).trigger('change')
            });
            fp.browse();
        });
    }

    async _onDeleteTag(event) {
        event.preventDefault();
        const index = event.currentTarget.dataset.index;
        const tags = game.settings.get('sorted-status-effects', 'statusEffectsTags') || [];
        const tagIcons = game.settings.get('sorted-status-effects', 'tagIcons') || {};
        const sortedStatus = game.settings.get('sorted-status-effects', 'sortedStatusEffects') || {};
        
        // Remove the tag and its icon
        const tagToRemove = tags[index];
        tags.splice(index, 1);
        delete tagIcons[tagToRemove];

        // Remove the tag from all status effects
        for (const [effectId, effect] of Object.entries(sortedStatus)) {
            if (effect.tags) {
                effect.tags = effect.tags.filter(tag => tag !== tagToRemove);
            }
        }

        // Save all updated settings
        await game.settings.set('sorted-status-effects', 'statusEffectsTags', tags);
        await game.settings.set('sorted-status-effects', 'tagIcons', tagIcons);
        await game.settings.set('sorted-status-effects', 'sortedStatusEffects', sortedStatus);

        // Re-render the form
        this.render();
    }

    _onIconPathChange(event) {
        const input = event.currentTarget;
        const preview = $(input).closest('.tag-entry').find('.tag-preview');
        preview.attr('src', input.value || 'icons/svg/d20.svg');
    }

    async _updateObject(event, formData) {
        const oldTags = game.settings.get('sorted-status-effects', 'statusEffectsTags') || [];
        const tags = [];
        const tagIcons = {};
        const sortedStatus = game.settings.get('sorted-status-effects', 'sortedStatusEffects') || {};
        
        // Convert form data to tags and icons
        Object.entries(formData).forEach(([key, value]) => {
            if (key.startsWith('tagName')) {
                const index = key.replace('tagName', '');
                const iconKey = `tagIcon${index}`;
                const tagName = value.trim();
                const iconPath = formData[iconKey]?.trim();
                
                if (tagName) {
                    tags.push(tagName);
                    if (iconPath) {
                        tagIcons[tagName] = iconPath;
                    }
                }
            }
        });

        // Find removed tags
        const removedTags = oldTags.filter(tag => !tags.includes(tag));

        // Remove deleted tags from all status effects
        if (removedTags.length > 0) {
            for (const [effectId, effect] of Object.entries(sortedStatus)) {
                if (effect.tags) {
                    effect.tags = effect.tags.filter(tag => !removedTags.includes(tag));
                }
            }
            await game.settings.set('sorted-status-effects', 'sortedStatusEffects', sortedStatus);
        }

        // Save the updated settings
        await game.settings.set('sorted-status-effects', 'statusEffectsTags', tags);
        await game.settings.set('sorted-status-effects', 'tagIcons', tagIcons);
    }
}