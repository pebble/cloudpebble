CloudPebble.Editor.Autocomplete = (function() {
    var Pos = CodeMirror.Pos;

    var functions = [
        'ARRAY_LENGTH',
        'IS_SIGNED',
        'PBL_APP_INFO',
        'PBL_APP_INFO_SIMPLE',
        'animation_get_context',
        'animation_init',
        'animation_is_scheduled',
        'animation_schedule',
        'animation_set_curve',
        'animation_set_delay',
        'animation_set_duration',
        'animation_set_handlers',
        'animation_set_implementation',
        'animation_unschedule',
        'animation_unschedule_all',
        'app_get_current_graphics_context',
        'app_timer_cancel_event',
        'app_timer_send_event',
        'bmp_deinit_container',
        'bmp_init_container',
        'clock_is_24h_style',
        'cos_lookup',
        'fonts_get_system_font',
        'fonts_load_custom_font',
        'fonts_unload_custom_font',
        'get_time',
        'gpath_draw_filled',
        'gpath_draw_outline',
        'gpath_init',
        'gpath_move_to',
        'gpath_rotate_to',
        'graphics_context_set_compositing_mode',
        'graphics_context_set_fill_color',
        'graphics_context_set_stroke_color',
        'graphics_context_set_text_color',
        'graphics_draw_bitmap_in_rect',
        'graphics_draw_circle',
        'graphics_draw_line',
        'graphics_draw_pixel',
        'graphics_draw_round_rect',
        'graphics_fill_circle',
        'graphics_fill_rect',
        'graphics_text_draw',
        'grect_center_point',
        'layer_add_child',
        'layer_get_frame',
        'layer_init',
        'layer_mark_dirty',
        'layer_remove_from_parent',
        'layer_set_frame',
        'layer_set_hidden',
        'light_enable',
        'light_enable_interaction',
        'pbl_main',
        'property_animation_init_layer_frame',
        'psleep',
        'resource_get_handle',
        'resource_init_current_app',
        'resource_load',
        'resource_load_byte_range',
        'resource_size',
        'rotbmp_deinit_container',
        'rotbmp_init_container',
        'rotbmp_pair_deinit_container',
        'rotbmp_pair_init_container',
        'rotbmp_pair_layer_set_angle',
        'rotbmp_pair_layer_set_src_ic',
        'sin_lookup',
        'string_format_time',
        'text_layer_get_text',
        'text_layer_init',
        'text_layer_set_background_color',
        'text_layer_set_font',
        'text_layer_set_text',
        'text_layer_set_text_alignment',
        'text_layer_set_text_color',
        'vibes_double_pulse',
        'vibes_enqueue_custom_pattern',
        'vibes_long_pulse',
        'vibes_short_pulse',
        'window_init',
        'window_render',
        'window_set_background_color',
        'window_set_click_config_provider',
        'window_set_fullscreen',
        'window_stack_push'
    ];

    var types = [
        'Animation',
        'AnimationCurve',
        'AnimationHandlers',
        'AnimationImplementation',
        'AnimationSetupImplementation',
        'AnimationStartedHandler',
        'AnimationStoppedHandler',
        'AnimationTeardownImplementation',
        'AnimationTimingFunction',
        'AnimationUpdateImplementation',
        'AppContextRef',
        'AppTaskContextRef',
        'AppTimerHandle',
        'BmpContainer',
        'ButtonId',
        'ClickConfig',
        'ClickConfigProvider',
        'ClickHandler',
        'ClickRecognizerRef',
        'GAlign',
        'GBitmap',
        'GColor',
        'GCompOp',
        'GContext',
        'GCornerMask',
        'GPath',
        'GPathInfo',
        'GPoint',
        'GRect',
        'GSize',
        'GTextAlignment',
        'GTextLayoutCacheRef',
        'GTextOverflowMode',
        'Layer',
        'LayerUpdateProc',
        'PblTm',
        'PebbleAppButtonEventHandler',
        'PebbleAppDeinitEventHandler',
        'PebbleAppHandlers',
        'PebbleAppInitEventHandler',
        'PebbleAppInputHandlers',
        'PebbleAppRenderEventHandler',
        'PebbleAppTickEventHandler',
        'PebbleAppTickInfo',
        'PebbleAppTimerEventHandler',
        'PebbleButtonEvent',
        'PebbleCallbackEvent',
        'PebbleRenderEvent',
        'PebbleTickEvent',
        'PropertyAnimation',
        'ResBankVersion',
        'ResHandle',
        'ResVersionHandle',
        'RotBmpContainer',
        'RotBmpLayer',
        'RotBmpPairContainer',
        'RotBmpPairLayer',
        'TextLayer',
        'TimeUnits',
        'VibePattern',
        'Window',
        'WindowButtonEventHandler',
        'WindowHandler',
        'WindowHandlers',
        'WindowInputHandlers'
    ];

    var constants = [
        'ANIMATION_NORMALIZED_MAX',
        'ANIMATION_NORMALIZED_MIN',
        'APP_INFO_STANDARD_APP',
        'APP_INFO_VISIBILITY_HIDDEN',
        'APP_INFO_VISIBILITY_SHOWN_ON_COMMUNICATION',
        'APP_INFO_WATCH_FACE',
        'AnimationCurveEaseIn',
        'AnimationCurveEaseInOut',
        'AnimationCurveEaseOut',
        'AnimationCurveLinear',
        'BUTTON_ID_BACK',
        'BUTTON_ID_DOWN',
        'BUTTON_ID_SELECT',
        'BUTTON_ID_UP',
        'DAY_UNIT',
        'FONT_KEY_DROID_SERIF_28_BOLD',
        'FONT_KEY_FONT_FALLBACK',
        'FONT_KEY_GOTHAM_18_LIGHT_SUBSET',
        'FONT_KEY_GOTHAM_30_BLACK',
        'FONT_KEY_GOTHAM_34_LIGHT_SUBSET',
        'FONT_KEY_GOTHAM_34_MEDIUM_NUMBERS',
        'FONT_KEY_GOTHAM_42_BOLD',
        'FONT_KEY_GOTHAM_42_LIGHT',
        'FONT_KEY_GOTHAM_42_MEDIUM_NUMBERS',
        'FONT_KEY_GOTHIC_14',
        'FONT_KEY_GOTHIC_14_BOLD',
        'FONT_KEY_GOTHIC_18',
        'FONT_KEY_GOTHIC_18_BOLD',
        'FONT_KEY_GOTHIC_24',
        'FONT_KEY_GOTHIC_24_BOLD',
        'FONT_KEY_GOTHIC_28',
        'FONT_KEY_GOTHIC_28_BOLD',
        'GAlignBottom',
        'GAlignBottomLeft',
        'GAlignBottomRight',
        'GAlignCenter',
        'GAlignLeft',
        'GAlignRight',
        'GAlignTop',
        'GAlignTopLeft',
        'GAlignTopRight',
        'GColorBlack',
        'GColorClear',
        'GColorWhite',
        'GCompOpAnd',
        'GCompOpAssign',
        'GCompOpAssignInverted',
        'GCompOpClear',
        'GCompOpOr',
        'GCornerBottomLeft',
        'GCornerBottomRight',
        'GCornerNone',
        'GCornerTopLeft',
        'GCornerTopRight',
        'GCornersAll',
        'GCornersBottom',
        'GCornersLeft',
        'GCornersRight',
        'GCornersTop',
        'GTextAlignmentCenter',
        'GTextAlignmentLeft',
        'GTextAlignmentRight',
        'GTextOverflowModeTrailingEllipsis',
        'GTextOverflowModeWrap',
        'HOUR_UNIT',
        'MINUTE_UNIT',
        'MONTH_UNIT',
        'NUM_BUTTONS',
        'NumAnimationCurve',
        'SECOND_UNIT',
        'TRIG_MAX_ANGLE',
        'TRIG_MAX_RATIO',
        'YEAR_UNIT'
    ];

    var tree = null;

    var init = function() {
        tree = new RadixTree();
        var resources = CloudPebble.Resources.GetResourceIDs();
        $.each([functions, types, constants, resources], function(index, list) {
            $.each(list, function(index, value) {
                tree.insert(value.toLowerCase(), value);
            });
        });
        if(CloudPebble.ProjectInfo.version_def_name) {
            tree.insert(CloudPebble.ProjectInfo.version_def_name.toLowerCase(), CloudPebble.ProjectInfo.version_def_name);
        }
        is_inited = true;
    }

    var getCompletions = function(token) {
        var results = tree.search(token.string.toLowerCase(), 15);
        if(results.length == 1 && results[0] == token.string) {
            return [];
        }
        return results;
    }

    var is_inited = false;

    return {
        Complete: function(editor, options) {
            var token = editor.getTokenAt(editor.getCursor());
            var completions = [];
            if(token.string != '') {
                completions = getCompletions(token);
            }
            return {
                list: completions,
                from: Pos(editor.getCursor().line, token.start),
                to: Pos(editor.getCursor().line, token.end)
            }
        },
        Init: function() {
            init();
        },
        IsInitialised: function() {
            return is_inited;
        }
    }
})();
