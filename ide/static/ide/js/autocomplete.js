CloudPebble.Editor.Autocomplete = (function() {
    var Pos = CodeMirror.Pos;

    var functions2 = [
        ['ARRAY_LENGTH', 'size_t', ['array']],
        ['IS_SIGNED', 'bool', ['integer']],
        ['APP_LOG', 'void', ['level', 'fmt...']],
        ['TupletBytes', 'const Tuplet', ['key', 'data', 'length']],
        ['TupletCString', 'const Tuplet', ['key', 'cstring']],
        ['TupletInteger', 'const Tuplet', ['key', 'integer']],
        ['accel_data_service_subscribe', 'void', ['uint32_t samples_per_update', 'AccelDataHandler handler']],
        ['accel_data_service_unsubscribe', 'void', []],
        ['accel_service_peek', 'int', ['AccelData *data']],
        ['accel_service_set_samples_per_update', 'int', ['uint32_t num_samples']],
        ['accel_service_set_sampling_rate', 'int', ['AccelSamplingRate rate']],
        ['accel_tap_service_subscribe', 'void', ['AccelTapHandler handler']],
        ['accel_tap_service_unsubscribe', 'void', []],
        ['action_bar_layer_add_to_window', 'void', ['ActionBarLayer *action_bar', 'struct Window *window']],
        ['action_bar_layer_clear_icon', 'void', ['ActionBarLayer *action_bar', 'ButtonId button_id']],
        ['action_bar_layer_create', 'ActionBarLayer*', []],
        ['action_bar_layer_destroy', 'void', ['ActionBarLayer *action_bar_layer']],
        ['action_bar_layer_get_layer', 'Layer*', ['ActionBarLayer *action_bar_layer']],
        ['action_bar_layer_remove_from_window', 'void', ['ActionBarLayer *action_bar']],
        ['action_bar_layer_set_background_color', 'void', ['ActionBarLayer *action_bar', 'GColor background_color']],
        ['action_bar_layer_set_click_config_provider', 'void', ['ActionBarLayer *action_bar', 'ClickConfigProvider click_config_provider']],
        ['action_bar_layer_set_context', 'void', ['ActionBarLayer *action_bar', 'void *context']],
        ['action_bar_layer_set_icon', 'void', ['ActionBarLayer *action_bar', 'ButtonId button_id', 'const GBitmap *icon']],
        ['animation_create', 'struct Animation *', []],
        ['animation_destroy', 'void', ['struct Animation *animation']],
        ['animation_get_context', 'void *', ['struct Animation *animation']],
        ['animation_is_scheduled', 'bool', ['struct Animation *animation']],
        ['animation_schedule', 'void', ['struct Animation *animation']],
        ['animation_set_curve', 'void', ['struct Animation *animation', 'AnimationCurve curve']],
        ['animation_set_delay', 'void', ['struct Animation *animation', 'uint32_t delay_ms']],
        ['animation_set_duration', 'void', ['struct Animation *animation', 'uint32_t duration_ms']],
        ['animation_set_handlers', 'void', ['struct Animation *animation', 'AnimationHandlers callbacks', 'void *context']],
        ['animation_set_implementation', 'void', ['struct Animation *animation', 'const AnimationImplementation *implementation']],
        ['animation_unschedule', 'void', ['struct Animation *animation']],
        ['animation_unschedule_all', 'void', []],
        ['app_comm_get_sniff_interval', 'SniffInterval', []],
        ['app_comm_set_sniff_interval', 'void', ['const SniffInterval interval']],
        ['app_event_loop', 'void', []],
        ['app_focus_service_subscribe', 'void', ['AppFocusHandler handler']],
        ['app_focus_service_unsubscribe', 'void', []],
        ['app_message_deregister_callbacks', 'void', []],
        ['app_message_get_context', 'void *', []],
        ['app_message_inbox_size_maximum', 'uint32_t', []],
        ['app_message_open', 'AppMessageResult', ['const uint32_t size_inbound', 'const uint32_t size_outbound']],
        ['app_message_outbox_begin', 'AppMessageResult', ['DictionaryIterator **iterator']],
        ['app_message_outbox_send', 'AppMessageResult', []],
        ['app_message_outbox_size_maximum', 'uint32_t', []],
        ['app_message_register_inbox_dropped', 'AppMessageInboxDropped', ['AppMessageInboxDropped dropped_callback']],
        ['app_message_register_inbox_received', 'AppMessageInboxReceived', ['AppMessageInboxReceived received_callback']],
        ['app_message_register_outbox_failed', 'AppMessageOutboxFailed', ['AppMessageOutboxFailed failed_callback']],
        ['app_message_register_outbox_sent', 'AppMessageOutboxSent', ['AppMessageOutboxSent sent_callback']],
        ['app_message_set_context', 'void *', ['void *context']],
        ['app_sync_deinit', 'void', ['struct AppSync *s']],
        ['app_sync_get', 'const Tuple *', ['const struct AppSync *s', 'const uint32_t key']],
        ['app_sync_init', 'void', ['struct AppSync *s', 'uint8_t *buffer', 'const uint16_t buffer_size', 'const Tuplet * const keys_and_initial_values', 'const uint8_t count', 'AppSyncTupleChangedCallback tuple_changed_callback', 'AppSyncErrorCallback error_callback', 'void *context']],
        ['app_sync_set', 'AppMessageResult', ['struct AppSync *s', 'const Tuplet * const keys_and_values_to_update', 'const uint8_t count']],
        ['app_timer_cancel', 'void', ['AppTimer *timer_handle']],
        ['app_timer_register', 'AppTimer*', ['uint32_t timeout_ms', 'AppTimerCallback callback', 'void* callback_data']],
        ['app_timer_reschedule', 'bool', ['AppTimer *timer_handle', 'uint32_t new_timeout_ms']],
        ['atan2_lookup', 'int32_t', ['int16_t y', 'int16_t x']],
        ['battery_state_service_peek', 'BatteryChargeState', []],
        ['battery_state_service_subscribe', 'void', ['BatteryStateHandler handler']],
        ['battery_state_service_unsubscribe', 'void', []],
        ['bitmap_layer_create', 'BitmapLayer*', ['GRect frame']],
        ['bitmap_layer_destroy', 'void', ['BitmapLayer* bitmap_layer']],
        ['bitmap_layer_get_bitmap', 'const GBitmap*', ['BitmapLayer * bitmap_layer']],
        ['bitmap_layer_get_layer', 'Layer*', ['const BitmapLayer *bitmap_layer']],
        ['bitmap_layer_set_alignment', 'void', ['BitmapLayer *bitmap_layer', 'GAlign alignment']],
        ['bitmap_layer_set_background_color', 'void', ['BitmapLayer *bitmap_layer', 'GColor color']],
        ['bitmap_layer_set_bitmap', 'void', ['BitmapLayer *bitmap_layer', 'const GBitmap *bitmap']],
        ['bitmap_layer_set_compositing_mode', 'void', ['BitmapLayer *bitmap_layer', 'GCompOp mode']],
        ['bluetooth_connection_service_peek', 'bool', []],
        ['bluetooth_connection_service_subscribe', 'void', ['BluetoothConnectionHandler handler']],
        ['bluetooth_connection_service_unsubscribe', 'void', []],
        ['click_number_of_clicks_counted', 'uint8_t', ['ClickRecognizerRef recognizer']],
        ['click_recognizer_get_button_id', 'ButtonId', ['ClickRecognizerRef recognizer']],
        ['clock_copy_time_string', 'void', ['char *buffer', 'uint8_t size']],
        ['clock_is_24h_style', 'bool', []],
        ['cos_lookup', 'int32_t', ['int32_t angle']],
        ['data_logging_create', 'DataLoggingSessionRef', ['uint32_t tag', 'DataLoggingItemType item_type', 'uint16_t item_length', 'bool resume']],
        ['data_logging_finish', 'void', ['DataLoggingSessionRef logging_session']],
        ['data_logging_log', 'DataLoggingResult', ['DataLoggingSessionRef logging_session', 'const void *data', 'uint32_t num_items']],
        ['dict_calc_buffer_size', 'uint32_t', ['const uint8_t tuple_count', '...']],
        ['dict_calc_buffer_size_from_tuplets', 'uint32_t', ['const Tuplet * const tuplets', 'const uint8_t tuplets_count']],
        ['dict_find', 'Tuple *', ['const DictionaryIterator *iter', 'const uint32_t key']],
        ['dict_merge', 'DictionaryResult', ['DictionaryIterator *dest', 'uint32_t *dest_max_size_in_out', 'DictionaryIterator *source', 'const bool update_existing_keys_only', 'const DictionaryKeyUpdatedCallback key_callback', 'void *context']],
        ['dict_read_begin_from_buffer', 'Tuple *', ['DictionaryIterator *iter', 'const uint16_t size', 'const uint8_t * const buffer']],
        ['dict_read_first', 'Tuple *', ['DictionaryIterator *iter']],
        ['dict_read_next', 'Tuple *', ['DictionaryIterator *iter']],
        ['dict_serialize_tuplets', 'DictionaryResult', ['DictionarySerializeCallback callback', 'void *context', 'const Tuplet * const tuplets', 'const uint8_t tuplets_count']],
        ['dict_serialize_tuplets_to_buffer', 'DictionaryResult', ['const uint8_t tuplets_count', 'const Tuplet * const tuplets', 'uint8_t *buffer', 'uint32_t *size_in_out']],
        ['dict_serialize_tuplets_to_buffer_with_iter', 'DictionaryResult', ['const Tuplet * const tuplets', 'const uint8_t tuplets_count', 'DictionaryIterator *iter', 'uint8_t *buffer', 'uint32_t *size_in_out']],
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
        ['gbitmap_create_as_sub_bitmap', 'GBitmap*', ['const GBitmap *base_bitmap', 'GRect sub_rect']],
        ['gbitmap_create_with_data', 'GBitmap*', ['const uint8_t *data']],
        ['gbitmap_create_with_resource', 'GBitmap*', ['uint32_t resource_id']],
        ['gbitmap_destroy', 'void', ['GBitmap* bitmap']],
        ['gmtime', 'struct tm *', ['const time_t *timep']],
        ['gpath_create', 'GPath*', ['const GPathInfo *init']],
        ['gpath_destroy', 'void', ['GPath* gpath']],
        ['gpath_draw_filled', 'void', ['GContext* ctx', 'GPath *path']],
        ['gpath_draw_outline', 'void', ['GContext* ctx', 'GPath *path']],
        ['gpath_move_to', 'void', ['GPath *path', 'GPoint point']],
        ['gpath_rotate_to', 'void', ['GPath *path', 'int32_t angle']],
        ['gpoint_equal', 'bool', ['const GPoint * const point_a', 'const GPoint * const point_b']],
        ['graphics_context_set_compositing_mode', 'void', ['GContext* ctx', 'GCompOp mode']],
        ['graphics_context_set_fill_color', 'void', ['GContext* ctx', 'GColor color']],
        ['graphics_context_set_stroke_color', 'void', ['GContext* ctx', 'GColor color']],
        ['graphics_context_set_text_color', 'void', ['GContext* ctx', 'GColor color']],
        ['graphics_draw_bitmap_in_rect', 'void', ['GContext* ctx', 'const GBitmap *bitmap', 'GRect rect']],
        ['graphics_draw_circle', 'void', ['GContext* ctx', 'GPoint p', 'uint16_t radius']],
        ['graphics_draw_line', 'void', ['GContext* ctx', 'GPoint p0', 'GPoint p1']],
        ['graphics_draw_pixel', 'void', ['GContext* ctx', 'GPoint point']],
        ['graphics_draw_rect', 'void', ['GContext* ctx', 'GRect rect']],
        ['graphics_draw_round_rect', 'void', ['GContext* ctx', 'GRect rect', 'uint16_t radius']],
        ['graphics_draw_text', 'void', ['GContext* ctx', 'const char* text', 'GFont const font', 'const GRect box', 'const GTextOverflowMode overflow_mode', 'const GTextAlignment alignment', 'const GTextLayoutCacheRef layout']],
        ['graphics_fill_circle', 'void', ['GContext* ctx', 'GPoint p', 'uint16_t radius']],
        ['graphics_fill_rect', 'void', ['GContext* ctx', 'GRect rect', 'uint16_t corner_radius', 'GCornerMask corner_mask']],
        ['graphics_text_layout_get_content_size', 'GSize', ['const char* text', 'GFont const font', 'const GRect box', 'const GTextOverflowMode overflow_mode', 'const GTextAlignment alignment']],
        ['grect_align', 'void', ['GRect *rect', 'const GRect *inside_rect', 'const GAlign alignment', 'const bool clip']],
        ['grect_center_point', 'GPoint', ['const GRect *rect']],
        ['grect_clip', 'void', ['GRect * const rect_to_clip', 'const GRect * const rect_clipper']],
        ['grect_contains_point', 'bool', ['const GRect *rect', 'const GPoint *point']],
        ['grect_crop', 'GRect', ['GRect rect', 'const int32_t crop_size_px']],
        ['grect_equal', 'bool', ['const GRect* const rect_a', 'const GRect* const rect_b']],
        ['grect_is_empty', 'bool', ['const GRect* const rect']],
        ['grect_standardize', 'void', ['GRect *rect']],
        ['gsize_equal', 'bool', ['const GSize *size_a', 'const GSize *size_b']],
        ['inverter_layer_create', 'InverterLayer*', ['GRect frame']],
        ['inverter_layer_destroy', 'void', ['InverterLayer* inverter_layer']],
        ['inverter_layer_get_layer', 'Layer*', ['InverterLayer *inverter_layer']],
        ['layer_add_child', 'void', ['Layer *parent', 'Layer *child']],
        ['layer_create', 'Layer*', ['GRect frame']],
        ['layer_create_with_data', 'Layer*', ['GRect frame', 'size_t data_size']],
        ['layer_destroy', 'void', ['Layer* layer']],
        ['layer_get_bounds', 'GRect', ['const Layer *layer']],
        ['layer_get_clips', 'bool', ['const Layer *layer']],
        ['layer_get_data', 'void*', ['const Layer *layer']],
        ['layer_get_frame', 'GRect', ['const Layer *layer']],
        ['layer_get_hidden', 'bool', ['const Layer *layer']],
        ['layer_get_window', 'struct Window *', ['const Layer *layer']],
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
        ['localtime', 'struct tm *', ['const time_t *timep']],
        ['menu_cell_basic_draw', 'void', ['GContext* ctx', 'const Layer *cell_layer', 'const char *title', 'const char *subtitle', 'GBitmap *icon']],
        ['menu_cell_basic_header_draw', 'void', ['GContext* ctx', 'const Layer *cell_layer', 'const char *title']],
        ['menu_cell_title_draw', 'void', ['GContext* ctx', 'const Layer *cell_layer', 'const char *title']],
        ['menu_index_compare', 'int16_t', ['MenuIndex *a', 'MenuIndex *b']],
        ['menu_layer_create', 'MenuLayer*', ['GRect frame']],
        ['menu_layer_destroy', 'void', ['MenuLayer* menu_layer']],
        ['menu_layer_get_layer', 'Layer*', ['const MenuLayer *menu_layer']],
        ['menu_layer_get_scroll_layer', 'ScrollLayer*', ['const MenuLayer *menu_layer']],
        ['menu_layer_get_selected_index', 'MenuIndex', ['const MenuLayer *menu_layer']],
        ['menu_layer_reload_data', 'void', ['MenuLayer *menu_layer']],
        ['menu_layer_set_callbacks', 'void', ['MenuLayer *menu_layer', 'void *callback_context', 'MenuLayerCallbacks callbacks']],
        ['menu_layer_set_click_config_onto_window', 'void', ['MenuLayer *menu_layer', 'struct Window *window']],
        ['menu_layer_set_selected_index', 'void', ['MenuLayer *menu_layer', 'MenuIndex index', 'MenuRowAlign scroll_align', 'bool animated']],
        ['menu_layer_set_selected_next', 'void', ['MenuLayer *menu_layer', 'bool up', 'MenuRowAlign scroll_align', 'bool animated']],
        ['number_window_create', 'NumberWindow*', ['const char *label', 'NumberWindowCallbacks callbacks', 'void *callback_context']],
        ['number_window_destroy', 'void', ['NumberWindow* number_window']],
        ['number_window_get_value', 'int32_t', ['const NumberWindow *numberwindow']],
        ['number_window_set_label', 'void', ['NumberWindow *numberwindow', 'const char *label']],
        ['number_window_set_max', 'void', ['NumberWindow *numberwindow', 'int32_t max']],
        ['number_window_set_min', 'void', ['NumberWindow *numberwindow', 'int32_t min']],
        ['number_window_set_step_size', 'void', ['NumberWindow *numberwindow', 'int32_t step']],
        ['number_window_set_value', 'void', ['NumberWindow *numberwindow', 'int32_t value']],
        ['persist_delete', 'status_t', ['const uint32_t key']],
        ['persist_exists', 'bool', ['const uint32_t key']],
        ['persist_get_size', 'int', ['const uint32_t key']],
        ['persist_read_bool', 'bool', ['const uint32_t key']],
        ['persist_read_data', 'int', ['const uint32_t key', 'void *buffer', 'const size_t buffer_size']],
        ['persist_read_int', 'int32_t', ['const uint32_t key']],
        ['persist_read_string', 'int', ['const uint32_t key', 'char *buffer', 'const size_t buffer_size']],
        ['persist_write_bool', 'status_t', ['const uint32_t key', 'const bool value']],
        ['persist_write_data', 'int', ['const uint32_t key', 'const void *data', 'const size_t size']],
        ['persist_write_int', 'status_t', ['const uint32_t key', 'const int32_t value']],
        ['persist_write_string', 'int', ['const uint32_t key', 'const char *cstring']],
        ['property_animation_create', 'struct PropertyAnimation*', ['const struct PropertyAnimationImplementation *implementation', 'void *subject', 'void *from_value', 'void *to_value']],
        ['property_animation_create_layer_frame', 'struct PropertyAnimation*', ['struct Layer *layer', 'GRect *from_frame', 'GRect *to_frame']],
        ['property_animation_destroy', 'void', ['struct PropertyAnimation* property_animation']],
        ['property_animation_update_gpoint', 'void', ['struct PropertyAnimation *property_animation', 'const uint32_t time_normalized']],
        ['property_animation_update_grect', 'void', ['struct PropertyAnimation *property_animation', 'const uint32_t time_normalized']],
        ['property_animation_update_int16', 'void', ['struct PropertyAnimation *property_animation', 'const uint32_t time_normalized']],
        ['psleep', 'void', ['int millis']],
        ['resource_get_handle', 'ResHandle', ['uint32_t resource_id']],
        ['resource_load', 'size_t', ['ResHandle h', 'uint8_t *buffer', 'size_t max_length']],
        ['resource_load_byte_range', 'size_t', ['ResHandle h', 'uint32_t start_offset', 'uint8_t *buffer', 'size_t num_bytes']],
        ['resource_size', 'size_t', ['ResHandle h']],
        ['rot_bitmap_layer_create', 'RotBitmapLayer*', ['GBitmap *bitmap']],
        ['rot_bitmap_layer_destroy', 'void', ['RotBitmapLayer *bitmap']],
        ['rot_bitmap_layer_increment_angle', 'void', ['RotBitmapLayer *image', 'int32_t angle_change']],
        ['rot_bitmap_layer_set_angle', 'void', ['RotBitmapLayer *image', 'int32_t angle']],
        ['rot_bitmap_layer_set_corner_clip_color', 'void', ['RotBitmapLayer *image', 'GColor color']],
        ['rot_bitmap_set_compositing_mode', 'void', ['RotBitmapLayer *image', 'GCompOp mode']],
        ['rot_bitmap_set_src_ic', 'void', ['RotBitmapLayer *image', 'GPoint ic']],
        ['scroll_layer_add_child', 'void', ['ScrollLayer *scroll_layer', 'Layer *child']],
        ['scroll_layer_create', 'ScrollLayer*', ['GRect frame']],
        ['scroll_layer_destroy', 'void', ['ScrollLayer *scroll_layer']],
        ['scroll_layer_get_content_offset', 'GPoint', ['ScrollLayer *scroll_layer']],
        ['scroll_layer_get_content_size', 'GSize', ['const ScrollLayer *scroll_layer']],
        ['scroll_layer_get_layer', 'Layer*', ['const ScrollLayer *scroll_layer']],
        ['scroll_layer_get_shadow_hidden', 'bool', ['const ScrollLayer *scroll_layer']],
        ['scroll_layer_scroll_down_click_handler', 'void', ['ClickRecognizerRef recognizer', 'void *context']],
        ['scroll_layer_scroll_up_click_handler', 'void', ['ClickRecognizerRef recognizer', 'void *context']],
        ['scroll_layer_set_callbacks', 'void', ['ScrollLayer *scroll_layer', 'ScrollLayerCallbacks callbacks']],
        ['scroll_layer_set_click_config_onto_window', 'void', ['ScrollLayer *scroll_layer', 'struct Window *window']],
        ['scroll_layer_set_content_offset', 'void', ['ScrollLayer *scroll_layer', 'GPoint offset', 'bool animated']],
        ['scroll_layer_set_content_size', 'void', ['ScrollLayer *scroll_layer', 'GSize size']],
        ['scroll_layer_set_context', 'void', ['ScrollLayer *scroll_layer', 'void *context']],
        ['scroll_layer_set_frame', 'void', ['ScrollLayer *scroll_layer', 'GRect frame']],
        ['scroll_layer_set_shadow_hidden', 'void', ['ScrollLayer *scroll_layer', 'bool hidden']],
        ['simple_menu_layer_create', 'SimpleMenuLayer*', ['GRect frame', 'Window *window', 'const SimpleMenuSection *sections', 'int32_t num_sections', 'void *callback_context']],
        ['simple_menu_layer_destroy', 'void', ['SimpleMenuLayer* menu_layer']],
        ['simple_menu_layer_get_layer', 'Layer*', ['const SimpleMenuLayer *simple_menu']],
        ['simple_menu_layer_get_selected_index', 'int', ['const SimpleMenuLayer *simple_menu']],
        ['simple_menu_layer_set_selected_index', 'void', ['SimpleMenuLayer *simple_menu', 'int32_t index', 'bool animated']],
        ['sin_lookup', 'int32_t', ['int32_t angle']],
        ['strftime', 'size_t', ['char *s', 'size_t max', 'const char *format', 'const struct tm *tm']],
        ['text_layer_create', 'TextLayer*', ['GRect frame']],
        ['text_layer_destroy', 'void', ['TextLayer* text_layer']],
        ['text_layer_get_content_size', 'GSize', ['TextLayer *text_layer']],
        ['text_layer_get_layer', 'Layer*', ['TextLayer *text_layer']],
        ['text_layer_get_text', 'const char*', ['TextLayer *text_layer']],
        ['text_layer_set_background_color', 'void', ['TextLayer *text_layer', 'GColor color']],
        ['text_layer_set_font', 'void', ['TextLayer *text_layer', 'GFont font']],
        ['text_layer_set_overflow_mode', 'void', ['TextLayer *text_layer', 'GTextOverflowMode line_mode']],
        ['text_layer_set_size', 'void', ['TextLayer *text_layer', 'const GSize max_size']],
        ['text_layer_set_text', 'void', ['TextLayer *text_layer', 'const char *text']],
        ['text_layer_set_text_alignment', 'void', ['TextLayer *text_layer', 'GTextAlignment text_alignment']],
        ['text_layer_set_text_color', 'void', ['TextLayer *text_layer', 'GColor color']],
        ['tick_timer_service_init', 'void', []],
        ['tick_timer_service_subscribe', 'void', ['TimeUnits tick_units', 'TickHandler handler']],
        ['tick_timer_service_unsubscribe', 'void', []],
        ['time', 'time_t', ['time_t *tloc']],
        ['time_ms', 'uint16_t', ['time_t *tloc', 'uint16_t *out_ms']],
        ['vibes_cancel', 'void', []],
        ['vibes_double_pulse', 'void', []],
        ['vibes_enqueue_custom_pattern', 'void', ['VibePattern pattern']],
        ['vibes_long_pulse', 'void', []],
        ['vibes_short_pulse', 'void', []],
        ['window_create', 'Window*', []],
        ['window_destroy', 'void', ['Window* window']],
        ['window_get_click_config_provider', 'ClickConfigProvider', ['const Window *window']],
        ['window_get_fullscreen', 'bool', ['const Window *window']],
        ['window_get_root_layer', 'struct Layer*', ['const Window *window']],
        ['window_get_user_data', 'void*', ['const Window *window']],
        ['window_is_loaded', 'bool', ['Window *window']],
        ['window_long_click_subscribe', 'void', ['ButtonId button_id', 'uint16_t delay_ms', 'ClickHandler down_handler', 'ClickHandler up_handler']],
        ['window_multi_click_subscribe', 'void', ['ButtonId button_id', 'uint8_t min_clicks', 'uint8_t max_clicks', 'uint16_t timeout', 'bool last_click_only', 'ClickHandler handler']],
        ['window_raw_click_subscribe', 'void', ['ButtonId button_id', 'ClickHandler down_handler', 'ClickHandler up_handler', 'void *context']],
        ['window_set_background_color', 'void', ['Window *window', 'GColor background_color']],
        ['window_set_click_config_provider', 'void', ['Window *window', 'ClickConfigProvider click_config_provider']],
        ['window_set_click_config_provider_with_context', 'void', ['Window *window', 'ClickConfigProvider click_config_provider', 'void *context']],
        ['window_set_click_context', 'void', ['ButtonId button_id', 'void *context']],
        ['window_set_fullscreen', 'void', ['Window *window', 'bool enabled']],
        ['window_set_status_bar_icon', 'void', ['Window *window', 'const GBitmap *icon']],
        ['window_set_user_data', 'void', ['Window *window', 'void *data']],
        ['window_set_window_handlers', 'void', ['Window *window', 'WindowHandlers handlers']],
        ['window_single_click_subscribe', 'void', ['ButtonId button_id', 'ClickHandler handler']],
        ['window_single_repeating_click_subscribe', 'void', ['ButtonId button_id', 'uint16_t repeat_interval_ms', 'ClickHandler handler']],
        ['window_stack_contains_window', 'bool', ['Window *window']],
        ['window_stack_get_top_window', 'Window*', []],
        ['window_stack_pop', 'Window*', ['bool animated']],
        ['window_stack_pop_all', 'void', ['const bool animated']],
        ['window_stack_push', 'void', ['Window *window', 'bool animated']],
        ['window_stack_remove', 'bool', ['Window *window', 'bool animated']]
    ];

    var types2 = [
        'AccelAxisType',
        'AccelData',
        'AccelDataHandler',
        'AccelSamplingRate',
        'AccelTapHandler',
        'ActionBarLayer',
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
        'AppFocusHandler',
        'AppLogLevel',
        'AppMessageInboxDropped',
        'AppMessageInboxReceived',
        'AppMessageOutboxFailed',
        'AppMessageOutboxSent',
        'AppMessageResult',
        'AppSync',
        'AppSyncErrorCallback',
        'AppSyncTupleChangedCallback',
        'AppTimer',
        'AppTimerCallback',
        'BatteryChargeState',
        'BatteryStateHandler',
        'BitmapLayer',
        'BluetoothConnectionHandler',
        'ButtonId',
        'ClickConfigProvider',
        'ClickHandler',
        'ClickRecognizerRef',
        'DataLoggingItemType',
        'DataLoggingResult',
        'DataLoggingSessionRef',
        'Dictionary',
        'DictionaryIterator',
        'DictionaryKeyUpdatedCallback',
        'DictionaryResult',
        'DictionarySerializeCallback',
        'GAlign',
        'GBitmap',
        'GColor',
        'GCompOp',
        'GContext',
        'GCornerMask',
        'GDrawState',
        'GFont',
        'GPath',
        'GPathInfo',
        'GPoint',
        'GPointGetter',
        'GPointSetter',
        'GRect',
        'GRectGetter',
        'GRectSetter',
        'GSize',
        'GTextAlignment',
        'GTextLayoutCacheRef',
        'GTextOverflowMode',
        'Int16Getter',
        'Int16Setter',
        'InverterLayer',
        'Layer',
        'LayerUpdateProc',
        'ListNode',
        'MenuCellSpan',
        'MenuIndex',
        'MenuLayer',
        'MenuLayerCallbacks',
        'MenuLayerDrawHeaderCallback',
        'MenuLayerDrawRowCallback',
        'MenuLayerGetCellHeightCallback',
        'MenuLayerGetHeaderHeightCallback',
        'MenuLayerGetNumberOfRowsInSectionsCallback',
        'MenuLayerGetNumberOfSectionsCallback',
        'MenuLayerSelectCallback',
        'MenuLayerSelectionChangedCallback',
        'MenuRowAlign',
        'NumberWindow',
        'NumberWindowCallback',
        'NumberWindowCallbacks',
        'PropertyAnimation',
        'PropertyAnimationAccessors',
        'PropertyAnimationImplementation',
        'ResHandle',
        'RotBitmapLayer',
        'ScrollLayer',
        'ScrollLayerCallback',
        'ScrollLayerCallbacks',
        'SimpleMenuItem',
        'SimpleMenuLayer',
        'SimpleMenuLayerSelectCallback',
        'SimpleMenuSection',
        'SniffInterval',
        'StatusCode',
        'TextLayer',
        'TextLayout',
        'TickHandler',
        'TimeUnits',
        'Tuple',
        'TupleType',
        'Tuplet',
        'VibePattern',
        'Window',
        'WindowHandler',
        'WindowHandlers',
        'status_t',
        'time_t',
        'tm'
        //'GPointReturn',
        //'GRectReturn',
    ];

    var constants2 = [
        'ACCEL_AXIS_X',
        'ACCEL_AXIS_Y',
        'ACCEL_AXIS_Z',
        'ACCEL_SAMPLING_100HZ',
        'ACCEL_SAMPLING_10HZ',
        'ACCEL_SAMPLING_25HZ',
        'ACCEL_SAMPLING_50HZ',
        'ACTION_BAR_WIDTH',
        'ANIMATION_DURATION_INFINITE',
        'ANIMATION_NORMALIZED_MAX',
        'ANIMATION_NORMALIZED_MIN',
        'APP_LOG_LEVEL_DEBUG',
        'APP_LOG_LEVEL_DEBUG_VERBOSE',
        'APP_LOG_LEVEL_ERROR',
        'APP_LOG_LEVEL_INFO',
        'APP_LOG_LEVEL_WARNING',
        'APP_MESSAGE_INBOX_SIZE_MINIMUM',
        'APP_MESSAGE_OUTBOX_SIZE_MINIMUM',
        'APP_MSG_ALREADY_RELEASED',
        'APP_MSG_BUFFER_OVERFLOW',
        'APP_MSG_BUSY',
        'APP_MSG_CALLBACK_ALREADY_REGISTERED',
        'APP_MSG_CALLBACK_NOT_REGISTERED',
        'APP_MSG_INVALID_ARGS',
        'APP_MSG_NOT_CONNECTED',
        'APP_MSG_OK',
        'APP_MSG_OUT_OF_MEMORY',
        'APP_MSG_SEND_REJECTED',
        'APP_MSG_SEND_TIMEOUT',
        'AnimationCurveEaseIn',
        'AnimationCurveEaseInOut',
        'AnimationCurveEaseOut',
        'AnimationCurveLinear',
        'BUTTON_ID_BACK',
        'BUTTON_ID_DOWN',
        'BUTTON_ID_SELECT',
        'BUTTON_ID_UP',
        'DATA_LOGGING_BUSY',
        'DATA_LOGGING_BYTE_ARRAY',
        'DATA_LOGGING_CLOSED',
        'DATA_LOGGING_FULL',
        'DATA_LOGGING_INT',
        'DATA_LOGGING_INVALID_PARAMS',
        'DATA_LOGGING_NOT_FOUND',
        'DATA_LOGGING_SUCCESS',
        'DATA_LOGGING_UINT',
        'DAY_UNIT',
        'DICT_INTERNAL_INCONSISTENCY',
        'DICT_INVALID_ARGS',
        'DICT_NOT_ENOUGH_STORAGE',
        'DICT_OK',
        'E_BUSY',
        'E_DOES_NOT_EXIST',
        'E_ERROR',
        'E_INTERNAL',
        'E_INVALID_ARGUMENT',
        'E_INVALID_OPERATION',
        'E_OUT_OF_MEMORY',
        'E_OUT_OF_RESOURCES',
        'E_OUT_OF_STORAGE',
        'E_RANGE',
        'E_UNKNOWN',
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
        'GCompOpSet',
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
        'GPointZero',
        'GRectZero',
        'GTextAlignmentCenter',
        'GTextAlignmentLeft',
        'GTextAlignmentRight',
        'GTextOverflowModeFill',
        'GTextOverflowModeTrailingEllipsis',
        'GTextOverflowModeWordWrap',
        'HOUR_UNIT',
        'MENU_CELL_BASIC_HEADER_HEIGHT',
        'MENU_INDEX_NOT_FOUND',
        'MINUTE_UNIT',
        'MONTH_UNIT',
        'MenuRowAlignBottom',
        'MenuRowAlignCenter',
        'MenuRowAlignNone',
        'MenuRowAlignTop',
        'NUM_ACTION_BAR_ITEMS',
        'NUM_ANIMATION_CURVE',
        'NUM_BUTTONS',
        'NumAnimationCurve',
        'PERSIST_DATA_MAX_LENGTH',
        'PERSIST_STRING_MAX_LENGTH',
        'SECOND_UNIT',
        'SNIFF_INTERVAL_NORMAL',
        'SNIFF_INTERVAL_REDUCED',
        'S_FALSE',
        'S_NO_ACTION_REQUIRED',
        'S_NO_MORE_ITEMS',
        'S_SUCCESS',
        'S_TRUE',
        'TRIG_MAX_ANGLE',
        'TRIG_MAX_RATIO',
        'TUPLE_BYTE_ARRAY',
        'TUPLE_CSTRING',
        'TUPLE_INT',
        'TUPLE_UINT',
        'YEAR_UNIT'
    ];

    var tree2 = null;
    var mSelectionCallback = null;

    var build_tree = function(things) {
        tree = new RadixTree();
        $.each(things, function(index, list) {
            $.each(list, function(index, value) {
                if(typeof value == 'string') key = value;
                else key = value[0];
                tree.insert(key.toLowerCase(), value);
            });
        });
        return tree;
    }

    var init = function() {
        var resources = CloudPebble.Resources.GetResourceIDs();
        tree2 = build_tree([functions2, types2, constants2, resources]);

        is_inited = true;
    };

    var preventIncludingQuotes = function(old_selection, expected_text, cm, selection) {
        selection = selection.ranges[0];
        cm.off('beforeSelectionChange', mSelectionCallback);
        var text = cm.getRange(selection.anchor, selection.head);
        var old_text = cm.getRange(old_selection.from, old_selection.to);
        if(old_text == expected_text) {
            createMark(cm, old_selection.from, old_selection.to);
        } else if((text[0] == "'" && text[text.length-1] == "'") || (text[0] == '"' && text[text.length-1] == '"')) {
            selection.anchor.ch += 1;
            selection.head.ch -= 1;
        }
    };

    var selectPlaceholder = function(cm, pos) {
        var expected_text = cm.getRange(pos.from, pos.to);
        cm.setSelection(pos.from, pos.to);
        mSelectionCallback = function(cm, selection) {
            preventIncludingQuotes(pos, expected_text, cm, selection);
        };
        cm.on('beforeSelectionChange', mSelectionCallback);
    };

    var createMark = function(cm, from, to) {
        var mark = cm.markText(from, to, {
            className: 'cm-autofilled',
            inclusiveLeft: false,
            inclusiveRight: false,
            atomic: true,
            startStyle: 'cm-autofilled-start',
            endStyle: 'cm-autofilled-end'
        });
        CodeMirror.on(mark, 'beforeCursorEnter', function() {
            var pos = mark.find();
            mark.clear();
            // Hack because we can't modify editor state from in here.
            // 50ms because that seems to let us override cursor input, too.
            setTimeout(function() { selectPlaceholder(cm, pos); }, 50);
        });
        return mark;
    }

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
            var mark = createMark(cm, p[0], p[1]);
            if(first_pos === null) first_pos = p;
            if(first_mark === null) first_mark = mark;
            start += value.length + 2;
        });
        if(first_pos === null) {
            cm.setSelection({ch: orig_start, line: data.from.line});
        } else {
            first_mark.clear();
            selectPlaceholder(cm, {from: first_pos[0], to: first_pos[1]});
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

    var mCurrentSummaryElement = null;
    var mWaiting = null;
    var renderSummary = function(completion, element) {
        if(!mCurrentSummaryElement) return;
        var docs = CloudPebble.Documentation.Lookup(completion.name || completion.text);
        if(docs && docs.description) {
            mCurrentSummaryElement.html(docs.description.replace(/[.;](\s)[\s\S]*/, '.')).show();
        } else {
            mCurrentSummaryElement.empty().hide();
        }
    };
    var showSummary = function(hints) {
        if(mCurrentSummaryElement) {
            mCurrentSummaryElement.remove();
        }
        var summary = $('<div>');
        summary.css({
            top: $(hints).offset().top + $(hints).outerHeight() - 5,
            left: $(hints).offset().left,
            width: $(hints).innerWidth() - 4,
            display: 'none'
        }).addClass('autocomplete-summary');
        summary.appendTo('body');
        mCurrentSummaryElement = summary;
        clearTimeout(mWaiting);
    };
    var hideSummary = function() {
        mCurrentSummaryElement.remove();
        $('.CodeMirror-hints').find("li:last").remove();
        mCurrentSummaryElement = null;
    };

    var getCompletions = function(token) {
        var results = tree2.search(token.string.toLowerCase(), 15);
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
            var result = {
                list: completions,
                from: Pos(editor.getCursor().line, token.start),
                to: Pos(editor.getCursor().line, token.end)
            };
            CodeMirror.on(result, 'shown', showSummary);
            CodeMirror.on(result, 'select', renderSummary);
            CodeMirror.on(result, 'close', hideSummary);
            return result;
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
