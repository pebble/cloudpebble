CloudPebble.Editor.Autocomplete = (function() {
    var Pos = CodeMirror.Pos;

    var functions = [
        ['ARRAY_LENGTH', 'size_t', ['array']],
        ['IS_SIGNED', 'bool', ['integer']],
        ['PBL_APP_INFO', 'void', ['uint8_t uuid[16]', 'const char* app_name', 'const char* app_author', 'uint8_t app_version_major', 'uint8_t app_version_minor', 'uint8_t menu_icon_resource', 'PebbleAppFlags flags']],
        ['PBL_APP_INFO_SIMPLE', 'void', ['uint8_t uuid[16]', 'const char* app_name', 'const char* app_author', 'uint16_t app_version']],
        ['action_bar_layer_add_to_window', 'void', ['ActionBarLayer *action_bar', 'struct Window *window']],
        ['action_bar_layer_clear_icon', 'void', ['ActionBarLayer *action_bar', 'ButtonId button_id']],
        ['action_bar_layer_init', 'void', ['ActionBarLayer *action_bar']],
        ['action_bar_layer_remove_from_window', 'void', ['ActionBarLayer *action_bar']],
        ['action_bar_layer_set_background_color', 'void', ['ActionBarLayer *action_bar', 'GColor background_color']],
        ['action_bar_layer_set_click_config_provider', 'void', ['ActionBarLayer *action_bar', 'ClickConfigProvider click_config_provider']],
        ['action_bar_layer_set_context', 'void', ['ActionBarLayer *action_bar', 'void *context']],
        ['action_bar_layer_set_icon', 'void', ['ActionBarLayer *action_bar', 'ButtonId button_id', 'const GBitmap *icon']],
        ['animation_get_context', 'void*', ['struct Animation *animation']],
        ['animation_init', 'void', ['struct Animation *animation']],
        ['animation_is_scheduled', 'bool', ['struct Animation *animation']],
        ['animation_schedule', 'void', ['struct Animation *animation']],
        ['animation_set_curve', 'void', ['struct Animation *animation', 'AnimationCurve curve']],
        ['animation_set_delay', 'void', ['struct Animation *animation', 'uint32_t delay_ms']],
        ['animation_set_duration', 'void', ['struct Animation *animation', 'uint32_t duration_ms']],
        ['animation_set_handlers', 'void', ['struct Animation *animation', 'AnimationHandlers callbacks', 'void *context']],
        ['animation_set_implementation', 'void', ['struct Animation *animation', 'const AnimationImplementation *implementation']],
        ['animation_unschedule', 'void', ['struct Animation *animation']],
        ['animation_unschedule_all', 'void', []],
        ['app_event_loop', 'void', ['AppTaskContextRef app_task_ctx', 'PebbleAppHandlers *handlers']],
        ['app_get_current_graphics_context', 'GContext*', []],
        ['app_message_deregister_callbacks', 'AppMessageResult', ['AppMessageCallbacksNode *callbacks_node']],
        ['app_message_out_get', 'AppMessageResult', ['DictionaryIterator **iter_out']],
        ['app_message_out_release', 'AppMessageResult', []],
        ['app_message_out_send', 'AppMessageResult', []],
        ['app_message_register_callbacks', 'AppMessageResult', ['AppMessageCallbacksNode *callbacks_node']],
        ['app_sync_deinit', 'void', ['AppSync *s']],
        ['app_sync_get', 'const Tuple*', ['const AppSync *s', 'const uint32_t key']],
        ['app_sync_init', 'void', ['AppSync *s', 'uint8_t *buffer', 'const uint16_t buffer_size', 'const Tuplet * const keys_and_initial_values', 'const uint8_t count', 'AppSyncTupleChangedCallback tuple_changed_callback', 'AppSyncErrorCallback error_callback', 'void *context']],
        ['app_sync_set', 'AppMessageResult', ['AppSync *s', 'const Tuplet * const keys_and_values_to_update', 'const uint8_t count']],
        ['app_timer_cancel_event', 'bool', ['AppContextRef app_ctx_ref', 'AppTimerHandle handle']],
        ['app_timer_send_event', 'AppTimerHandle', ['AppContextRef app_ctx', 'uint32_t timeout_ms', 'uint32_t cookie']],
        ['bitmap_layer_init', 'void', ['BitmapLayer *image', 'GRect frame']],
        ['bitmap_layer_set_alignment', 'void', ['BitmapLayer *image', 'GAlign alignment']],
        ['bitmap_layer_set_background_color', 'void', ['BitmapLayer *image', 'GColor color']],
        ['bitmap_layer_set_bitmap', 'void', ['BitmapLayer *image', 'const GBitmap *bitmap']],
        ['bitmap_layer_set_compositing_mode', 'void', ['BitmapLayer *image', 'GCompOp mode']],
        ['bmp_deinit_container', 'void', ['BmpContainer *c']],
        ['bmp_init_container', 'bool', ['int resource_id', 'BmpContainer *c']],
        ['click_number_of_clicks_counted', 'uint8_t', ['ClickRecognizerRef recognizer']],
        ['click_recognizer_get_button_id', 'ButtonId', ['ClickRecognizerRef recognizer']],
        ['clock_copy_time_string', 'void', ['char *buffer', 'uint8_t size']],
        ['clock_is_24h_style', 'bool', []],
        ['cos_lookup', 'int32_t', ['int32_t angle']],
        ['dict_calc_buffer_size', 'uint32_t', ['const uint8_t tuple_count', '...']],
        ['dict_calc_buffer_size_from_tuplets', 'uint32_t', ['const uint8_t tuplets_count', 'const Tuplet * const tuplets']],
        ['dict_find', 'Tuple*', ['const DictionaryIterator *iter', 'const uint32_t key']],
        ['dict_merge', 'DictionaryResult', ['DictionaryIterator *dest', 'uint32_t *dest_max_size_in_out', 'DictionaryIterator *source', 'const bool update_existing_keys_only', 'const DictionaryKeyUpdatedCallback key_callback', 'void *context']],
        ['dict_read_begin_from_buffer', 'Tuple*', ['DictionaryIterator *iter', 'const uint8_t * const buffer', 'const uint16_t size']],
        ['dict_read_first', 'Tuple*', ['DictionaryIterator *iter']],
        ['dict_read_next', 'Tuple*', ['DictionaryIterator *iter']],
        ['dict_serialize_tuplets', 'DictionaryResult', ['DictionarySerializeCallback callback', 'void *context', 'const uint8_t tuplets_count', 'const Tuplet * const tuplets']],
        ['dict_serialize_tuplets_to_buffer', 'DictionaryResult', ['const uint8_t tuplets_count', 'const Tuplet * const tuplets', 'uint8_t *buffer', 'uint32_t *size_in_out']],
        ['dict_serialize_tuplets_to_buffer_with_iter', 'DictionaryResult', ['const uint8_t tuplets_count', 'const Tuplet * const tuplets', 'DictionaryIterator *iter', 'uint8_t *buffer', 'uint32_t *size_in_out']],
        ['dict_write_begin', 'DictionaryResult', ['DictionaryIterator *iter', 'uint8_t * const buffer', 'const uint16_t size']],
        ['dict_write_cstring', 'DictionaryResult', ['DictionaryIterator *iter', 'const uint32_t key', 'const char * const cstring']],
        ['dict_write_data', 'DictionaryResult', ['DictionaryIterator *iter', 'const uint32_t key', 'const uint8_t * const data', 'const uint16_t size']],
        ['dict_write_end', 'uint32_t', ['DictionaryIterator *iter']],
        ['dict_write_int', 'DictionaryResult', ['DictionaryIterator *iter', 'const uint32_t key', 'const void *integer', 'const uint8_t width_bytes', 'const bool is_signed']],
        ['dict_write_int16', 'DictionaryResult', ['DictionaryIterator *iter', 'const uint32_t key', 'const int16_t value']],
        ['dict_write_int32', 'DictionaryResult', ['DictionaryIterator *iter', 'const uint32_t key', 'const int32_t value']],
        ['dict_write_int8', 'DictionaryResult', ['DictionaryIterator *iter', 'const uint32_t key', 'const int8_t value']],
        ['dict_write_tuplet', 'DictionaryResult', ['DictionaryIterator *iter', 'const Tuplet * const tuplet']],
        ['dict_write_uint16', 'DictionaryResult', ['DictionaryIterator *iter', 'const uint32_t key', 'const uint16_t value']],
        ['dict_write_uint32', 'DictionaryResult', ['DictionaryIterator *iter', 'const uint32_t key', 'const uint32_t value']],
        ['dict_write_uint8', 'DictionaryResult', ['DictionaryIterator *iter', 'const uint32_t key', 'const uint8_t value']],
        ['fonts_get_system_font', 'GFont', ['const char *font_key']],
        ['fonts_load_custom_font', 'GFont', ['ResHandle resource']],
        ['fonts_unload_custom_font', 'void', ['GFont font']],
        ['get_time', 'void', ['PblTm *time']],
        ['gpath_draw_filled', 'void', ['GContext *ctx', 'GPath *path']],
        ['gpath_draw_outline', 'void', ['GContext *ctx', 'GPath *path']],
        ['gpath_init', 'void', ['GPath *path', 'const GPathInfo *init']],
        ['gpath_move_to', 'void', ['GPath *path', 'GPoint point']],
        ['gpath_rotate_to', 'void', ['GPath *path', 'int32_t angle']],
        ['graphics_context_set_compositing_mode', 'void', ['GContext *ctx', 'GCompOp mode']],
        ['graphics_context_set_fill_color', 'void', ['GContext *ctx', 'GColor color']],
        ['graphics_context_set_stroke_color', 'void', ['GContext *ctx', 'GColor color']],
        ['graphics_context_set_text_color', 'void', ['GContext *ctx', 'GColor color']],
        ['graphics_draw_bitmap_in_rect', 'void', ['GContext *ctx', 'const GBitmap *bitmap', 'GRect rect']],
        ['graphics_draw_circle', 'void', ['GContext *ctx', 'GPoint p', 'int radius']],
        ['graphics_draw_line', 'void', ['GContext *ctx', 'GPoint p0', 'GPoint p1']],
        ['graphics_draw_pixel', 'void', ['GContext *ctx', 'GPoint point']],
        ['graphics_draw_round_rect', 'void', ['GContext *ctx', 'GRect rect', 'int radius']],
        ['graphics_fill_circle', 'void', ['GContext *ctx', 'GPoint p', 'int radius']],
        ['graphics_fill_rect', 'void', ['GContext *ctx', 'GRect rect', 'uint8_t corner_radius', 'GCornerMask corner_mask']],
        ['graphics_text_draw', 'void', ['GContext *ctx', 'const char *text', 'const GFont font', 'const GRect box', 'const GTextOverflowMode overflow_mode', 'const GTextAlignment alignment', 'const GTextLayoutCacheRef layout']],
        ['graphics_text_layout_get_max_used_size', 'GSize', ['GContext *ctx', 'const char *text', 'const GFont font', 'const GRect box', 'const GTextOverflowMode overflow_mode', 'const GTextAlignment alignment', 'GTextLayoutCacheRef layout']],
        ['grect_center_point', 'GPoint', ['GRect *rect']],
        ['heap_bitmap_deinit', 'void', ['HeapBitmap *hb']],
        ['heap_bitmap_init', 'bool', ['HeapBitmap *hb', 'int resource_id']],
        ['inverter_layer_init', 'void', ['InverterLayer *inverter', 'GRect frame']],
        ['layer_add_child', 'void', ['Layer *parent', 'Layer *child']],
        ['layer_get_bounds', 'GRect', ['Layer *layer']],
        ['layer_get_clips', 'bool', ['Layer *layer']],
        ['layer_get_frame', 'GRect', ['Layer *layer']],
        ['layer_get_hidden', 'bool', ['Layer *layer']],
        ['layer_get_window', 'struct Window*', ['Layer *layer']],
        ['layer_init', 'void', ['Layer *layer', 'GRect frame']],
        ['layer_insert_above_sibling', 'void', ['Layer *layer_to_insert', 'Layer *above_sibling_layer']],
        ['layer_insert_below_sibling', 'void', ['Layer *layer_to_insert', 'Layer *below_sibling_layer']],
        ['layer_mark_dirty', 'void', ['Layer *layer']],
        ['layer_remove_child_layers', 'void', ['Layer *parent']],
        ['layer_remove_from_parent', 'void', ['Layer *child']],
        ['layer_set_bounds', 'void', ['Layer *layer', 'GRect bounds']],
        ['layer_set_clips', 'void', ['Layer *layer', 'bool clips']],
        ['layer_set_frame', 'void', ['Layer *layer', 'GRect frame']],
        ['layer_set_hidden', 'void', ['Layer *layer', 'bool hidden']],
        ['layer_set_update_proc', 'void', ['Layer *layer', 'LayerUpdateProc update_proc']],
        ['light_enable', 'void', ['bool enable']],
        ['light_enable_interaction', 'void', []],
        ['menu_cell_basic_draw', 'void', ['GContext *ctx', 'Layer *cell_layer', 'const char *title', 'const char *subtitle', 'GBitmap *icon']],
        ['menu_cell_basic_header_draw', 'void', ['GContext *ctx', 'Layer *cell_layer', 'const char *title']],
        ['menu_cell_title_draw', 'void', ['GContext *ctx', 'Layer *cell_layer', 'const char *title']],
        ['menu_index_compare', 'int16_t', ['MenuIndex *a', 'MenuIndex *b']],
        ['menu_layer_get_layer', 'Layer*', ['MenuLayer *menu_layer']],
        ['menu_layer_init', 'void', ['MenuLayer *menu_layer', 'GRect frame']],
        ['menu_layer_reload_data', 'void', ['MenuLayer *menu_layer']],
        ['menu_layer_set_callbacks', 'void', ['MenuLayer *menu_layer', 'void *callback_context', 'MenuLayerCallbacks callbacks']],
        ['menu_layer_set_click_config_onto_window', 'void', ['MenuLayer *menu_layer', 'struct Window *window']],
        ['menu_layer_set_selected_index', 'void', ['MenuLayer *menu_layer', 'MenuIndex index', 'MenuRowAlign scroll_align', 'bool animated']],
        ['menu_layer_set_selected_next', 'void', ['MenuLayer *menu_layer', 'bool up', 'MenuRowAlign scroll_align', 'bool animated']],
        ['number_window_get_value', 'int', ['NumberWindow *numberwindow']],
        ['number_window_init', 'void', ['NumberWindow *numberwindow', 'const char *label', 'NumberWindowCallbacks callbacks', 'void *callback_context']],
        ['number_window_set_label', 'void', ['NumberWindow *nw', 'const char *label']],
        ['number_window_set_max', 'void', ['NumberWindow *numberwindow', 'int max']],
        ['number_window_set_min', 'void', ['NumberWindow *numberwindow', 'int min']],
        ['number_window_set_step_size', 'void', ['NumberWindow *numberwindow', 'int step']],
        ['number_window_set_value', 'void', ['NumberWindow *numberwindow', 'int value']],
        ['property_animation_init', 'void', ['struct PropertyAnimation *property_animation', 'const struct PropertyAnimationImplementation *implementation', 'void *subject', 'void *from_value', 'void *to_value']],
        ['property_animation_init_layer_frame', 'void', ['struct PropertyAnimation *property_animation', 'struct Layer *layer', 'GRect *from_frame', 'GRect *to_frame']],
        ['property_animation_update_gpoint', 'void', ['struct PropertyAnimation *property_animation', 'const uint32_t time_normalized']],
        ['property_animation_update_grect', 'void', ['struct PropertyAnimation *property_animation', 'const uint32_t time_normalized']],
        ['property_animation_update_int16', 'void', ['struct PropertyAnimation *property_animation', 'const uint32_t time_normalized']],
        ['psleep', 'void', ['int millis']],
        ['resource_get_handle', 'ResHandle', ['uint32_t file_id']],
        ['resource_init_current_app', 'void', ['ResVersionHandle version']],
        ['resource_load', 'size_t', ['ResHandle h', 'uint8_t *buffer', 'size_t max_length']],
        ['resource_load_byte_range', 'size_t', ['ResHandle h', 'uint32_t start_bytes', 'uint8_t *data', 'size_t num_bytes']],
        ['resource_size', 'size_t', ['ResHandle h']],
        ['rotbmp_deinit_container', 'void', ['RotBmpContainer *c']],
        ['rotbmp_init_container', 'bool', ['int resource_id', 'RotBmpContainer *c']],
        ['rotbmp_pair_deinit_container', 'void', ['RotBmpPairContainer *c']],
        ['rotbmp_pair_init_container', 'bool', ['int white_resource_id', 'int black_resource_id', 'RotBmpPairContainer *c']],
        ['rotbmp_pair_layer_set_angle', 'void', ['RotBmpPairLayer *pair', 'int32_t angle']],
        ['rotbmp_pair_layer_set_src_ic', 'void', ['RotBmpPairLayer *pair', 'GPoint ic']],
        ['scroll_layer_add_child', 'void', ['ScrollLayer *scroll_layer', 'Layer *child']],
        ['scroll_layer_get_content_offset', 'GPoint', ['ScrollLayer *scroll_layer']],
        ['scroll_layer_get_content_size', 'GSize', ['ScrollLayer *scroll_layer']],
        ['scroll_layer_init', 'void', ['ScrollLayer *scroll_layer', 'GRect frame']],
        ['scroll_layer_scroll_down_click_handler', 'void', ['ClickRecognizerRef recognizer', 'ScrollLayer *scroll_layer']],
        ['scroll_layer_scroll_up_click_handler', 'void', ['ClickRecognizerRef recognizer', 'ScrollLayer *scroll_layer']],
        ['scroll_layer_set_callbacks', 'void', ['ScrollLayer *scroll_layer', 'ScrollLayerCallbacks callbacks']],
        ['scroll_layer_set_click_config_onto_window', 'void', ['ScrollLayer *scroll_layer', 'struct Window *window']],
        ['scroll_layer_set_content_offset', 'void', ['ScrollLayer *scroll_layer', 'GPoint offset', 'bool animated']],
        ['scroll_layer_set_content_size', 'void', ['ScrollLayer *scroll_layer', 'GSize size']],
        ['scroll_layer_set_context', 'void', ['ScrollLayer *scroll_layer', 'void *context']],
        ['scroll_layer_set_frame', 'void', ['ScrollLayer *scroll_layer', 'GRect rect']],
        ['simple_menu_layer_get_layer', 'Layer*', ['SimpleMenuLayer *simple_menu']],
        ['simple_menu_layer_get_selected_index', 'int', ['SimpleMenuLayer *simple_menu']],
        ['simple_menu_layer_init', 'void', ['SimpleMenuLayer *simple_menu', 'GRect frame', 'Window *window', 'const SimpleMenuSection *sections', 'int num_sections', 'void *callback_context']],
        ['simple_menu_layer_set_selected_index', 'void', ['SimpleMenuLayer *simple_menu', 'int index', 'bool animated']],
        ['sin_lookup', 'int32_t', ['int32_t angle']],
        ['string_format_time', 'void', ['char *ptr', 'size_t maxsize', 'const char *format', 'const PblTm *timeptr']],
        ['text_layer_get_max_used_size', 'GSize', ['GContext *ctx', 'TextLayer *text_layer']],
        ['text_layer_get_text', 'const char*', ['TextLayer *text_layer']],
        ['text_layer_init', 'void', ['TextLayer *text_layer', 'GRect frame']],
        ['text_layer_set_background_color', 'void', ['TextLayer *text_layer', 'GColor color']],
        ['text_layer_set_font', 'void', ['TextLayer *text_layer', 'GFont font']],
        ['text_layer_set_overflow_mode', 'void', ['TextLayer *text_layer', 'GTextOverflowMode line_mode']],
        ['text_layer_set_size', 'void', ['TextLayer *text_layer', 'const GSize max_size']],
        ['text_layer_set_text', 'void', ['TextLayer *text_layer', 'const char *text']],
        ['text_layer_set_text_alignment', 'void', ['TextLayer *text_layer', 'GTextAlignment text_alignment']],
        ['text_layer_set_text_color', 'void', ['TextLayer *text_layer', 'GColor color']],
        ['vibes_double_pulse', 'void', []],
        ['vibes_enqueue_custom_pattern', 'void', ['VibePattern pattern']],
        ['vibes_long_pulse', 'void', []],
        ['vibes_short_pulse', 'void', []],
        ['window_deinit', 'void', ['Window *window']],
        ['window_get_click_config_provider', 'ClickConfigProvider', ['Window *window']],
        ['window_get_fullscreen', 'bool', ['Window *window']],
        ['window_get_root_layer', 'struct Layer*', ['Window *window']],
        ['window_init', 'void', ['Window *window', 'const char *debug_name']],
        ['window_is_loaded', 'bool', ['Window *window']],
        ['window_render', 'void', ['Window *window', 'GContext *ctx']],
        ['window_set_background_color', 'void', ['Window *window', 'GColor background_color']],
        ['window_set_click_config_provider', 'void', ['Window *window', 'ClickConfigProvider click_config_provider']],
        ['window_set_click_config_provider_with_context', 'void', ['Window *window', 'ClickConfigProvider click_config_provider', 'void *context']],
        ['window_set_fullscreen', 'void', ['Window *window', 'bool enabled']],
        ['window_set_status_bar_icon', 'void', ['Window *window', 'const GBitmap *icon']],
        ['window_set_window_handlers', 'void', ['Window *window', 'WindowHandlers handlers']],
        ['window_stack_contains_window', 'bool', ['Window *window']],
        ['window_stack_get_top_window', 'Window*', []],
        ['window_stack_pop', 'Window*', ['bool animated']],
        ['window_stack_pop_all', 'void', ['const bool animated']],
        ['window_stack_push', 'void', ['Window *window', 'bool animated']],
        ['window_stack_remove', 'Window*', ['Window *window', 'bool animated']]
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
                if(typeof value == 'string') key = value;
                else key = value[0];
                tree.insert(key.toLowerCase(), value);
            });
        });
        if(CloudPebble.ProjectInfo.version_def_name) {
            tree.insert(CloudPebble.ProjectInfo.version_def_name.toLowerCase(), CloudPebble.ProjectInfo.version_def_name);
        }
        is_inited = true;
    };

    var preventIncludingQuotes = function(cm, selection) {
        var text = cm.getRange(selection.anchor, selection.head);
        if((text[0] == "'" && text[text.length-1] == "'") || (text[0] == '"' && text[text.length-1] == '"')) {
            selection.anchor.ch += 1;
            selection.head.ch -= 1;
        }
        cm.off('beforeSelectionChange', preventIncludingQuotes);
    };

    var selectPlaceholder = function(cm, pos) {
        cm.setSelection(pos.from, pos.to);
        cm.on('beforeSelectionChange', preventIncludingQuotes);
    };

    var expandCompletion = function(cm, data, completion) {
        // Easy part.
        cm.replaceRange(completion.text, data.from, data.to);
        // Now we get to figure out where precisely the params should have ended up and fix that.
        start = data.from.ch + completion.name.length + 1; // +1 for open paren
        var orig_start = start;
        var first_pos = null;
        var first_mark = null;
        $.each(completion.params, function(index, value) {
            var p = [{line: data.from.line, ch:start}, {line: data.from.line, ch:start + value.length}];
            var mark = cm.markText(p[0], p[1], {
                className: 'cm-autofilled',
                inclusiveLeft: false,
                inclusiveRight: false,
                atomic: true,
                startStyle: 'cm-autofilled-start',
                endStyle: 'cm-autofilled-end'
            });
            if(first_pos === null) first_pos = p;
            if(first_mark === null) first_mark = mark;
            CodeMirror.on(mark, 'beforeCursorEnter', function() {
                var pos = mark.find();
                mark.clear();
                // Hack because we can't modify editor state from in here.
                // 50ms because that seems to let us override cursor input, too.
                setTimeout(function() { selectPlaceholder(cm, pos); }, 50);
            });
            start += value.length + 2;
        });
        if(first_pos === null) {
            cm.setSelection({ch: orig_start, line: data.from.line});
        } else {
            first_mark.clear();
            cm.setSelection(first_pos[0], first_pos[1]);
        }
    };

    var renderCompletion = function(elt, data, completion) {
        var type = completion.ret;
        var elem = $('<span>');
        elem.append($('<span class="muted">').append(document.createTextNode(type + ' ')));
        elem.append(document.createTextNode(completion.name));
        elem.append($('<span class="muted">').append('(' + completion.params.join(', ') + ')'));
        elt.appendChild(elem[0]);
    };

    var getCompletions = function(token) {
        var results = tree.search(token.string.toLowerCase(), 15);
        if(results.length == 1 && results[0] == token.string) {
            return [];
        }
        for (var i = results.length - 1; i >= 0; i--) {
            if(typeof results[i] == 'string') {
                results[i] = {text: results[i]};
                continue;
            }
            var result = results[i];
            results[i] = {
                text: result[0] + '(' + result[2].join(', ') + ')',
                params: result[2],
                ret: result[1],
                name: result[0],
                hint: expandCompletion,
                render: renderCompletion
            };
        }
        return results;
    };

    var is_inited = false;

    return {
        Complete: function(editor, options) {
            var token = editor.getTokenAt(editor.getCursor());
            var completions = [];
            if(token.string !== '') {
                completions = getCompletions(token);
            }
            return {
                list: completions,
                from: Pos(editor.getCursor().line, token.start),
                to: Pos(editor.getCursor().line, token.end)
            };
        },
        Init: function() {
            init();
        },
        IsInitialised: function() {
            return is_inited;
        },
        SelectPlaceholder: function(cm, pos) {
            selectPlaceholder(cm, pos);
        }
    };
})();
