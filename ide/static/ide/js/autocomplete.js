CloudPebble.Editor.Autocomplete = (function() {
    var Pos = CodeMirror.Pos;

    var functions2 = [
        // Name, type, [params...], in_app, in_worker
        ['ARRAY_LENGTH', 'size_t', ['array'], true, true],
        ['IS_SIGNED', 'bool', ['integer'], true, true],
        ['APP_LOG', 'void', ['level', 'fmt...'], true, true],
        ['TRIGANGLE_TO_DEG', 'integer', ['integer'], true, true],
        ['TupletBytes', 'const Tuplet', ['key', 'data', 'length'], true, true],
        ['TupletCString', 'const Tuplet', ['key', 'cstring'], true, true],
        ['TupletInteger', 'const Tuplet', ['key', 'integer'], true, true],
        ['UuidMake', 'Uuid', ['uint8_t p0', 'uint8_t p1', 'uint8_t p2', 'uint8_t p3', 'uint8_t p4', 'uint8_t p5', 'uint8_t p6', 'uint8_t p7', 'uint8_t p8', 'uint8_t p9', 'uint8_t p10', 'uint8_t p11', 'uint8_t p12', 'uint8_t p13', 'uint8_t p14', 'uint8_t p15'], true, true],
        ['UuidMakeFromBEBytes', 'Uuid', ['uint8_t *bytes'], true, true],
        ['UuidMakeFromLEBytes', 'Uuid', ['uint8_t *bytes'], true, true],
        ['accel_data_service_subscribe', 'void', ['uint32_t samples_per_update', 'AccelDataHandler handler'], true, true],
        ['accel_data_service_unsubscribe', 'void', [], true, true],
        ['accel_raw_data_service_subscribe', 'void', ['uint32_t samples_per_update', 'AccelRawDataHandler handler'], true, true],
        ['accel_service_peek', 'int', ['AccelData **data'], true, true],
        ['accel_service_set_samples_per_update', 'int', ['uint32_t num_samples'], true, true],
        ['accel_service_set_sampling_rate', 'int', ['AccelSamplingRate rate'], true, true],
        ['accel_tap_service_subscribe', 'void', ['AccelTapHandler handler'], true, true],
        ['accel_tap_service_unsubscribe', 'void', [], true, true],
        ['action_bar_layer_add_to_window', 'void', ['ActionBarLayer **action_bar', 'struct Window **window'], true, false],
        ['action_bar_layer_clear_icon', 'void', ['ActionBarLayer **action_bar', 'ButtonId button_id'], true, false],
        ['action_bar_layer_create', 'ActionBarLayer *', [], true, false],
        ['action_bar_layer_destroy', 'void', ['ActionBarLayer **action_bar_layer'], true, false],
        ['action_bar_layer_get_layer', 'Layer *', ['ActionBarLayer **action_bar_layer'], true, false],
        ['action_bar_layer_remove_from_window', 'void', ['ActionBarLayer **action_bar'], true, false],
        ['action_bar_layer_set_background_color', 'void', ['ActionBarLayer **action_bar', 'GColor background_color'], true, false],
        ['action_bar_layer_set_click_config_provider', 'void', ['ActionBarLayer **action_bar', 'ClickConfigProvider click_config_provider'], true, false],
        ['action_bar_layer_set_context', 'void', ['ActionBarLayer **action_bar', 'void **context'], true, false],
        ['action_bar_layer_set_icon', 'void', ['ActionBarLayer **action_bar', 'ButtonId button_id', 'const GBitmap **icon'], true, false],
        ['animation_create', 'struct Animation *', [], true, false],
        ['animation_destroy', 'void', ['struct Animation **animation'], true, false],
        ['animation_get_context', 'void *', ['struct Animation **animation'], true, false],
        ['animation_is_scheduled', 'bool', ['struct Animation **animation'], true, false],
        ['animation_schedule', 'void', ['struct Animation **animation'], true, false],
        ['animation_set_curve', 'void', ['struct Animation **animation', 'AnimationCurve curve'], true, false],
        ['animation_set_custom_curve', 'void', ['struct Animation **animation', 'AnimationCurveFunction curve_function'], true, false],
        ['animation_set_delay', 'void', ['struct Animation **animation', 'uint32_t delay_ms'], true, false],
        ['animation_set_duration', 'void', ['struct Animation **animation', 'uint32_t duration_ms'], true, false],
        ['animation_set_handlers', 'void', ['struct Animation **animation', 'AnimationHandlers callbacks', 'void **context'], true, false],
        ['animation_set_implementation', 'void', ['struct Animation **animation', 'const AnimationImplementation **implementation'], true, false],
        ['animation_unschedule', 'void', ['struct Animation **animation'], true, false],
        ['animation_unschedule_all', 'void', [], true, false],
        ['app_comm_get_sniff_interval', 'SniffInterval', [], true, false],
        ['app_comm_set_sniff_interval', 'void', ['const SniffInterval interval'], true, false],
        ['app_event_loop', 'void', [], true, false],
        ['app_focus_service_subscribe', 'void', ['AppFocusHandler handler'], true, false],
        ['app_focus_service_unsubscribe', 'void', [], true, false],
        ['app_message_deregister_callbacks', 'void', [], true, false],
        ['app_message_get_context', 'void *', [], true, false],
        ['app_message_inbox_size_maximum', 'uint32_t', [], true, false],
        ['app_message_open', 'AppMessageResult', ['const uint32_t size_inbound', 'const uint32_t size_outbound'], true, false],
        ['app_message_outbox_begin', 'AppMessageResult', ['DictionaryIterator **iterator'], true, false],
        ['app_message_outbox_send', 'AppMessageResult', [], true, false],
        ['app_message_outbox_size_maximum', 'uint32_t', [], true, false],
        ['app_message_register_inbox_dropped', 'AppMessageInboxDropped', ['AppMessageInboxDropped dropped_callback'], true, false],
        ['app_message_register_inbox_received', 'AppMessageInboxReceived', ['AppMessageInboxReceived received_callback'], true, false],
        ['app_message_register_outbox_failed', 'AppMessageOutboxFailed', ['AppMessageOutboxFailed failed_callback'], true, false],
        ['app_message_register_outbox_sent', 'AppMessageOutboxSent', ['AppMessageOutboxSent sent_callback'], true, false],
        ['app_message_set_context', 'void *', ['void **context'], true, false],
        ['app_sync_deinit', 'void', ['struct AppSync **s'], true, false],
        ['app_sync_get', 'const Tuple *', ['const struct AppSync **s', 'const uint32_t key'], true, false],
        ['app_sync_init', 'void', ['struct AppSync **s', 'uint8_t **buffer', 'const uint16_t buffer_size', 'const Tuplet *const keys_and_initial_values', 'const uint8_t count', 'AppSyncTupleChangedCallback tuple_changed_callback', 'AppSyncErrorCallback error_callback', 'void **context'], true, false],
        ['app_sync_set', 'AppMessageResult', ['struct AppSync **s', 'const Tuplet *const keys_and_values_to_update', 'const uint8_t count'], true, false],
        ['app_timer_cancel', 'void', ['AppTimer **timer_handle'], true, true],
        ['app_timer_register', 'AppTimer *', ['uint32_t timeout_ms', 'AppTimerCallback callback', 'void **callback_data'], true, true],
        ['app_timer_reschedule', 'bool', ['AppTimer **timer_handle', 'uint32_t new_timeout_ms'], true, true],
        ['app_worker_is_running', 'bool', [], true, true],
        ['app_worker_kill', 'AppWorkerResult', [], true, true],
        ['app_worker_launch', 'AppWorkerResult', [], true, true],
        ['app_worker_message_subscribe', 'bool', ['AppWorkerMessageHandler handler'], true, true],
        ['app_worker_message_unsubscribe', 'bool', [], true, true],
        ['app_worker_send_message', 'void', ['uint8_t type', 'AppWorkerMessage **data'], true, true],
        ['atan2_lookup', 'int32_t', ['int16_t y', 'int16_t x'], true, true],
        ['battery_state_service_peek', 'BatteryChargeState', [], true, true],
        ['battery_state_service_subscribe', 'void', ['BatteryStateHandler handler'], true, true],
        ['battery_state_service_unsubscribe', 'void', [], true, true],
        ['bitmap_layer_create', 'BitmapLayer *', ['GRect frame'], true, false],
        ['bitmap_layer_destroy', 'void', ['BitmapLayer **bitmap_layer'], true, false],
        ['bitmap_layer_get_bitmap', 'const GBitmap *', ['BitmapLayer **bitmap_layer'], true, false],
        ['bitmap_layer_get_layer', 'Layer *', ['const BitmapLayer **bitmap_layer'], true, false],
        ['bitmap_layer_set_alignment', 'void', ['BitmapLayer **bitmap_layer', 'GAlign alignment'], true, false],
        ['bitmap_layer_set_background_color', 'void', ['BitmapLayer **bitmap_layer', 'GColor color'], true, false],
        ['bitmap_layer_set_bitmap', 'void', ['BitmapLayer **bitmap_layer', 'const GBitmap **bitmap'], true, false],
        ['bitmap_layer_set_compositing_mode', 'void', ['BitmapLayer **bitmap_layer', 'GCompOp mode'], true, false],
        ['bluetooth_connection_service_peek', 'bool', [], true, true],
        ['bluetooth_connection_service_subscribe', 'void', ['BluetoothConnectionHandler handler'], true, true],
        ['bluetooth_connection_service_unsubscribe', 'void', [], true, true],
        ['click_number_of_clicks_counted', 'uint8_t', ['ClickRecognizerRef recognizer'], true, false],
        ['click_recognizer_get_button_id', 'ButtonId', ['ClickRecognizerRef recognizer'], true, false],
        ['click_recognizer_is_repeating', 'bool', ['ClickRecognizerRef recognizer'], true, false],
        ['clock_copy_time_string', 'void', ['char **buffer', 'uint8_t size'], true, true],
        ['clock_is_24h_style', 'bool', [], true, true],
        ['compass_service_peek', 'int', ['CompassHeadingData **data'], true, true],
        ['compass_service_set_heading_filter', 'int', ['CompassHeading filter'], true, true],
        ['compass_service_subscribe', 'void', ['CompassHeadingHandler handler'], true, true],
        ['compass_service_unsubscribe', 'void', [], true, true],
        ['cos_lookup', 'int32_t', ['int32_t angle'], true, true],
        ['data_logging_create', 'DataLoggingSessionRef', ['uint32_t tag', 'DataLoggingItemType item_type', 'uint16_t item_length', 'bool resume'], true, true],
        ['data_logging_finish', 'void', ['DataLoggingSessionRef logging_session'], true, true],
        ['data_logging_log', 'DataLoggingResult', ['DataLoggingSessionRef logging_session', 'const void **data', 'uint32_t num_items'], true, true],
        ['dict_calc_buffer_size', 'uint32_t', ['const uint8_t tuple_count'], true, true],
        ['dict_calc_buffer_size_from_tuplets', 'uint32_t', ['const Tuplet *const tuplets', 'const uint8_t tuplets_count'], true, true],
        ['dict_find', 'Tuple *', ['const DictionaryIterator **iter', 'const uint32_t key'], true, true],
        ['dict_merge', 'DictionaryResult', ['DictionaryIterator **dest', 'uint32_t **dest_max_size_in_out', 'DictionaryIterator **source', 'const bool update_existing_keys_only', 'const DictionaryKeyUpdatedCallback key_callback', 'void **context'], true, true],
        ['dict_read_begin_from_buffer', 'Tuple *', ['DictionaryIterator **iter', 'const uint8_t *const buffer', 'const uint16_t size'], true, true],
        ['dict_read_first', 'Tuple *', ['DictionaryIterator **iter'], true, true],
        ['dict_read_next', 'Tuple *', ['DictionaryIterator **iter'], true, true],
        ['dict_serialize_tuplets', 'DictionaryResult', ['DictionarySerializeCallback callback', 'void **context', 'const Tuplet *const tuplets', 'const uint8_t tuplets_count'], true, true],
        ['dict_serialize_tuplets_to_buffer', 'DictionaryResult', ['const Tuplet *const tuplets', 'const uint8_t tuplets_count', 'uint8_t **buffer', 'uint32_t **size_in_out'], true, true],
        ['dict_serialize_tuplets_to_buffer_with_iter', 'DictionaryResult', ['DictionaryIterator **iter', 'const Tuplet *const tuplets', 'const uint8_t tuplets_count', 'uint8_t **buffer', 'uint32_t **size_in_out'], true, true],
        ['dict_size', 'uint32_t', ['DictionaryIterator **iter'], true, true],
        ['dict_write_begin', 'DictionaryResult', ['DictionaryIterator **iter', 'uint8_t *const buffer', 'const uint16_t size'], true, true],
        ['dict_write_cstring', 'DictionaryResult', ['DictionaryIterator **iter', 'const uint32_t key', 'const char *const cstring'], true, true],
        ['dict_write_data', 'DictionaryResult', ['DictionaryIterator **iter', 'const uint32_t key', 'const uint8_t *const data', 'const uint16_t size'], true, true],
        ['dict_write_end', 'uint32_t', ['DictionaryIterator **iter'], true, true],
        ['dict_write_int', 'DictionaryResult', ['DictionaryIterator **iter', 'const uint32_t key', 'const void **integer', 'const uint8_t width_bytes', 'const bool is_signed'], true, true],
        ['dict_write_int16', 'DictionaryResult', ['DictionaryIterator **iter', 'const uint32_t key', 'const int16_t value'], true, true],
        ['dict_write_int32', 'DictionaryResult', ['DictionaryIterator **iter', 'const uint32_t key', 'const int32_t value'], true, true],
        ['dict_write_int8', 'DictionaryResult', ['DictionaryIterator **iter', 'const uint32_t key', 'const int8_t value'], true, true],
        ['dict_write_tuplet', 'DictionaryResult', ['DictionaryIterator **iter', 'const Tuplet *const tuplet'], true, true],
        ['dict_write_uint16', 'DictionaryResult', ['DictionaryIterator **iter', 'const uint32_t key', 'const uint16_t value'], true, true],
        ['dict_write_uint32', 'DictionaryResult', ['DictionaryIterator **iter', 'const uint32_t key', 'const uint32_t value'], true, true],
        ['dict_write_uint8', 'DictionaryResult', ['DictionaryIterator **iter', 'const uint32_t key', 'const uint8_t value'], true, true],
        ['fonts_get_system_font', 'GFont', ['const char **font_key'], true, false],
        ['fonts_load_custom_font', 'GFont', ['ResHandle handle'], true, false],
        ['fonts_unload_custom_font', 'void', ['GFont font'], true, false],
        ['gbitmap_create_as_sub_bitmap', 'GBitmap *', ['const GBitmap **base_bitmap', 'GRect sub_rect'], true, false],
        ['gbitmap_create_blank', 'GBitmap *', ['GSize size'], true, false],
        ['gbitmap_create_with_data', 'GBitmap *', ['const uint8_t **data'], true, false],
        ['gbitmap_create_with_resource', 'GBitmap *', ['uint32_t resource_id'], true, false],
        ['gbitmap_destroy', 'void', ['GBitmap **bitmap'], true, false],
        ['gpath_create', 'GPath *', ['const GPathInfo **init'], true, false],
        ['gpath_destroy', 'void', ['GPath **path'], true, false],
        ['gpath_draw_filled', 'void', ['GContext **ctx', 'GPath **path'], true, false],
        ['gpath_draw_filled_legacy', 'void', ['GContext **ctx', 'GPath **path'], true, false],
        ['gpath_draw_outline', 'void', ['GContext **ctx', 'GPath **path'], true, false],
        ['gpath_move_to', 'void', ['GPath **path', 'GPoint point'], true, false],
        ['gpath_rotate_to', 'void', ['GPath **path', 'int32_t angle'], true, false],
        ['gpoint_equal', 'bool', ['const GPoint *const point_a', 'const GPoint *const point_b'], true, false],
        ['graphics_capture_frame_buffer', 'GBitmap *', ['GContext **ctx'], true, false],
        ['graphics_context_set_compositing_mode', 'void', ['GContext **ctx', 'GCompOp mode'], true, false],
        ['graphics_context_set_fill_color', 'void', ['GContext **ctx', 'GColor color'], true, false],
        ['graphics_context_set_stroke_color', 'void', ['GContext **ctx', 'GColor color'], true, false],
        ['graphics_context_set_text_color', 'void', ['GContext **ctx', 'GColor color'], true, false],
        ['graphics_draw_bitmap_in_rect', 'void', ['GContext **ctx', 'const GBitmap **bitmap', 'GRect rect'], true, false],
        ['graphics_draw_circle', 'void', ['GContext **ctx', 'GPoint p', 'uint16_t radius'], true, false],
        ['graphics_draw_line', 'void', ['GContext **ctx', 'GPoint p0', 'GPoint p1'], true, false],
        ['graphics_draw_pixel', 'void', ['GContext **ctx', 'GPoint point'], true, false],
        ['graphics_draw_rect', 'void', ['GContext **ctx', 'GRect rect'], true, false],
        ['graphics_draw_round_rect', 'void', ['GContext **ctx', 'GRect rect', 'uint16_t radius'], true, false],
        ['graphics_draw_text', 'void', ['GContext **ctx', 'const char **text', 'GFont const font', 'const GRect box', 'const GTextOverflowMode overflow_mode', 'const GTextAlignment alignment', 'const GTextLayoutCacheRef layout'], true, false],
        ['graphics_fill_circle', 'void', ['GContext **ctx', 'GPoint p', 'uint16_t radius'], true, false],
        ['graphics_fill_rect', 'void', ['GContext **ctx', 'GRect rect', 'uint16_t corner_radius', 'GCornerMask corner_mask'], true, false],
        ['graphics_frame_buffer_is_captured', 'bool', ['GContext **ctx'], true, false],
        ['graphics_release_frame_buffer', 'bool', ['GContext **ctx', 'GBitmap **buffer'], true, false],
        ['graphics_text_layout_get_content_size', 'GSize', ['const char **text', 'GFont const font', 'const GRect box', 'const GTextOverflowMode overflow_mode', 'const GTextAlignment alignment'], true, false],
        ['grect_align', 'void', ['GRect **rect', 'const GRect **inside_rect', 'const GAlign alignment', 'const bool clip'], true, false],
        ['grect_center_point', 'GPoint', ['const GRect **rect'], true, false],
        ['grect_clip', 'void', ['GRect *const rect_to_clip', 'const GRect *const rect_clipper'], true, false],
        ['grect_contains_point', 'bool', ['const GRect **rect', 'const GPoint **point'], true, false],
        ['grect_crop', 'GRect', ['GRect rect', 'const int32_t crop_size_px'], true, false],
        ['grect_equal', 'bool', ['const GRect *const rect_a', 'const GRect *const rect_b'], true, false],
        ['grect_is_empty', 'bool', ['const GRect *const rect'], true, false],
        ['grect_standardize', 'void', ['GRect **rect'], true, false],
        ['gsize_equal', 'bool', ['const GSize **size_a', 'const GSize **size_b'], true, false],
        ['heap_bytes_free', 'size_t', [], true, true],
        ['heap_bytes_used', 'size_t', [], true, true],
        ['inverter_layer_create', 'InverterLayer *', ['GRect frame'], true, false],
        ['inverter_layer_destroy', 'void', ['InverterLayer **inverter_layer'], true, false],
        ['inverter_layer_get_layer', 'Layer *', ['InverterLayer **inverter_layer'], true, false],
        ['layer_add_child', 'void', ['Layer **parent', 'Layer **child'], true, false],
        ['layer_create', 'Layer *', ['GRect frame'], true, false],
        ['layer_create_with_data', 'Layer *', ['GRect frame', 'size_t data_size'], true, false],
        ['layer_destroy', 'void', ['Layer **layer'], true, false],
        ['layer_get_bounds', 'GRect', ['const Layer **layer'], true, false],
        ['layer_get_clips', 'bool', ['const Layer **layer'], true, false],
        ['layer_get_data', 'void *', ['const Layer **layer'], true, false],
        ['layer_get_frame', 'GRect', ['const Layer **layer'], true, false],
        ['layer_get_hidden', 'bool', ['const Layer **layer'], true, false],
        ['layer_get_window', 'struct Window *', ['const Layer **layer'], true, false],
        ['layer_insert_above_sibling', 'void', ['Layer **layer_to_insert', 'Layer **above_sibling_layer'], true, false],
        ['layer_insert_below_sibling', 'void', ['Layer **layer_to_insert', 'Layer **below_sibling_layer'], true, false],
        ['layer_mark_dirty', 'void', ['Layer **layer'], true, false],
        ['layer_remove_child_layers', 'void', ['Layer **parent'], true, false],
        ['layer_remove_from_parent', 'void', ['Layer **child'], true, false],
        ['layer_set_bounds', 'void', ['Layer **layer', 'GRect bounds'], true, false],
        ['layer_set_clips', 'void', ['Layer **layer', 'bool clips'], true, false],
        ['layer_set_frame', 'void', ['Layer **layer', 'GRect frame'], true, false],
        ['layer_set_hidden', 'void', ['Layer **layer', 'bool hidden'], true, false],
        ['layer_set_update_proc', 'void', ['Layer **layer', 'LayerUpdateProc update_proc'], true, false],
        ['light_enable', 'void', ['bool enable'], true, false],
        ['light_enable_interaction', 'void', [], true, false],
        ['menu_cell_basic_draw', 'void', ['GContext **ctx', 'const Layer **cell_layer', 'const char **title', 'const char **subtitle', 'GBitmap **icon'], true, false],
        ['menu_cell_basic_header_draw', 'void', ['GContext **ctx', 'const Layer **cell_layer', 'const char **title'], true, false],
        ['menu_cell_title_draw', 'void', ['GContext **ctx', 'const Layer **cell_layer', 'const char **title'], true, false],
        ['menu_index_compare', 'int16_t', ['MenuIndex **a', 'MenuIndex **b'], true, false],
        ['menu_layer_create', 'MenuLayer *', ['GRect frame'], true, false],
        ['menu_layer_destroy', 'void', ['MenuLayer **menu_layer'], true, false],
        ['menu_layer_get_layer', 'Layer *', ['const MenuLayer **menu_layer'], true, false],
        ['menu_layer_get_scroll_layer', 'ScrollLayer *', ['const MenuLayer **menu_layer'], true, false],
        ['menu_layer_get_selected_index', 'MenuIndex', ['const MenuLayer **menu_layer'], true, false],
        ['menu_layer_reload_data', 'void', ['MenuLayer **menu_layer'], true, false],
        ['menu_layer_set_callbacks', 'void', ['MenuLayer **menu_layer', 'void **callback_context', 'MenuLayerCallbacks callbacks'], true, false],
        ['menu_layer_set_click_config_onto_window', 'void', ['MenuLayer **menu_layer', 'struct Window **window'], true, false],
        ['menu_layer_set_selected_index', 'void', ['MenuLayer **menu_layer', 'MenuIndex index', 'MenuRowAlign scroll_align', 'bool animated'], true, false],
        ['menu_layer_set_selected_next', 'void', ['MenuLayer **menu_layer', 'bool up', 'MenuRowAlign scroll_align', 'bool animated'], true, false],
        ['number_window_create', 'NumberWindow *', ['const char **label', 'NumberWindowCallbacks callbacks', 'void **callback_context'], true, false],
        ['number_window_destroy', 'void', ['NumberWindow **number_window'], true, false],
        ['number_window_get_value', 'int32_t', ['const NumberWindow **numberwindow'], true, false],
        ['number_window_get_window', 'Window *', ['NumberWindow **numberwindow'], true, false],
        ['number_window_set_label', 'void', ['NumberWindow **numberwindow', 'const char **label'], true, false],
        ['number_window_set_max', 'void', ['NumberWindow **numberwindow', 'int32_t max'], true, false],
        ['number_window_set_min', 'void', ['NumberWindow **numberwindow', 'int32_t min'], true, false],
        ['number_window_set_step_size', 'void', ['NumberWindow **numberwindow', 'int32_t step'], true, false],
        ['number_window_set_value', 'void', ['NumberWindow **numberwindow', 'int32_t value'], true, false],
        ['persist_delete', 'status_t', ['const uint32_t key'], true, true],
        ['persist_exists', 'bool', ['const uint32_t key'], true, true],
        ['persist_get_size', 'int', ['const uint32_t key'], true, true],
        ['persist_read_bool', 'bool', ['const uint32_t key'], true, true],
        ['persist_read_data', 'int', ['const uint32_t key', 'void **buffer', 'const size_t buffer_size'], true, true],
        ['persist_read_int', 'int32_t', ['const uint32_t key'], true, true],
        ['persist_read_string', 'int', ['const uint32_t key', 'char **buffer', 'const size_t buffer_size'], true, true],
        ['persist_write_bool', 'status_t', ['const uint32_t key', 'const bool value'], true, true],
        ['persist_write_data', 'int', ['const uint32_t key', 'const void **data', 'const size_t size'], true, true],
        ['persist_write_int', 'status_t', ['const uint32_t key', 'const int32_t value'], true, true],
        ['persist_write_string', 'int', ['const uint32_t key', 'const char **cstring'], true, true],
        ['property_animation_create', 'struct PropertyAnimation *', ['const struct PropertyAnimationImplementation **implementation', 'void **subject', 'void **from_value', 'void **to_value'], true, false],
        ['property_animation_create_layer_frame', 'struct PropertyAnimation *', ['struct Layer **layer', 'GRect **from_frame', 'GRect **to_frame'], true, false],
        ['property_animation_destroy', 'void', ['struct PropertyAnimation **property_animation'], true, false],
        ['property_animation_update_gpoint', 'void', ['struct PropertyAnimation **property_animation', 'const uint32_t distance_normalized'], true, false],
        ['property_animation_update_grect', 'void', ['struct PropertyAnimation **property_animation', 'const uint32_t distance_normalized'], true, false],
        ['property_animation_update_int16', 'void', ['struct PropertyAnimation **property_animation', 'const uint32_t distance_normalized'], true, false],
        ['psleep', 'void', ['int millis'], true, true],
        ['resource_get_handle', 'ResHandle', ['uint32_t resource_id'], true, false],
        ['resource_load', 'size_t', ['ResHandle h', 'uint8_t **buffer', 'size_t max_length'], true, false],
        ['resource_load_byte_range', 'size_t', ['ResHandle h', 'uint32_t start_offset', 'uint8_t **buffer', 'size_t num_bytes'], true, false],
        ['resource_size', 'size_t', ['ResHandle h'], true, false],
        ['rot_bitmap_layer_create', 'RotBitmapLayer *', ['GBitmap **bitmap'], true, false],
        ['rot_bitmap_layer_destroy', 'void', ['RotBitmapLayer **bitmap'], true, false],
        ['rot_bitmap_layer_increment_angle', 'void', ['RotBitmapLayer **bitmap', 'int32_t angle_change'], true, false],
        ['rot_bitmap_layer_set_angle', 'void', ['RotBitmapLayer **bitmap', 'int32_t angle'], true, false],
        ['rot_bitmap_layer_set_corner_clip_color', 'void', ['RotBitmapLayer **bitmap', 'GColor color'], true, false],
        ['rot_bitmap_set_compositing_mode', 'void', ['RotBitmapLayer **bitmap', 'GCompOp mode'], true, false],
        ['rot_bitmap_set_src_ic', 'void', ['RotBitmapLayer **bitmap', 'GPoint ic'], true, false],
        ['scroll_layer_add_child', 'void', ['ScrollLayer **scroll_layer', 'Layer **child'], true, false],
        ['scroll_layer_create', 'ScrollLayer *', ['GRect frame'], true, false],
        ['scroll_layer_destroy', 'void', ['ScrollLayer **scroll_layer'], true, false],
        ['scroll_layer_get_content_offset', 'GPoint', ['ScrollLayer **scroll_layer'], true, false],
        ['scroll_layer_get_content_size', 'GSize', ['const ScrollLayer **scroll_layer'], true, false],
        ['scroll_layer_get_layer', 'Layer *', ['const ScrollLayer **scroll_layer'], true, false],
        ['scroll_layer_get_shadow_hidden', 'bool', ['const ScrollLayer **scroll_layer'], true, false],
        ['scroll_layer_scroll_down_click_handler', 'void', ['ClickRecognizerRef recognizer', 'void **context'], true, false],
        ['scroll_layer_scroll_up_click_handler', 'void', ['ClickRecognizerRef recognizer', 'void **context'], true, false],
        ['scroll_layer_set_callbacks', 'void', ['ScrollLayer **scroll_layer', 'ScrollLayerCallbacks callbacks'], true, false],
        ['scroll_layer_set_click_config_onto_window', 'void', ['ScrollLayer **scroll_layer', 'struct Window **window'], true, false],
        ['scroll_layer_set_content_offset', 'void', ['ScrollLayer **scroll_layer', 'GPoint offset', 'bool animated'], true, false],
        ['scroll_layer_set_content_size', 'void', ['ScrollLayer **scroll_layer', 'GSize size'], true, false],
        ['scroll_layer_set_context', 'void', ['ScrollLayer **scroll_layer', 'void **context'], true, false],
        ['scroll_layer_set_frame', 'void', ['ScrollLayer **scroll_layer', 'GRect frame'], true, false],
        ['scroll_layer_set_shadow_hidden', 'void', ['ScrollLayer **scroll_layer', 'bool hidden'], true, false],
        ['simple_menu_layer_create', 'SimpleMenuLayer *', ['GRect frame', 'Window **window', 'const SimpleMenuSection **sections', 'int32_t num_sections', 'void **callback_context'], true, false],
        ['simple_menu_layer_destroy', 'void', ['SimpleMenuLayer **menu_layer'], true, false],
        ['simple_menu_layer_get_layer', 'Layer *', ['const SimpleMenuLayer **simple_menu'], true, false],
        ['simple_menu_layer_get_menu_layer', 'MenuLayer *', ['SimpleMenuLayer **simple_menu'], true, false],
        ['simple_menu_layer_get_selected_index', 'int', ['const SimpleMenuLayer **simple_menu'], true, false],
        ['simple_menu_layer_set_selected_index', 'void', ['SimpleMenuLayer **simple_menu', 'int32_t index', 'bool animated'], true, false],
        ['sin_lookup', 'int32_t', ['int32_t angle'], true, true],
        ['text_layer_create', 'TextLayer *', ['GRect frame'], true, false],
        ['text_layer_destroy', 'void', ['TextLayer **text_layer'], true, false],
        ['text_layer_get_content_size', 'GSize', ['TextLayer **text_layer'], true, false],
        ['text_layer_get_layer', 'Layer *', ['TextLayer **text_layer'], true, false],
        ['text_layer_get_text', 'const char *', ['TextLayer **text_layer'], true, false],
        ['text_layer_set_background_color', 'void', ['TextLayer **text_layer', 'GColor color'], true, false],
        ['text_layer_set_font', 'void', ['TextLayer **text_layer', 'GFont font'], true, false],
        ['text_layer_set_overflow_mode', 'void', ['TextLayer **text_layer', 'GTextOverflowMode line_mode'], true, false],
        ['text_layer_set_size', 'void', ['TextLayer **text_layer', 'const GSize max_size'], true, false],
        ['text_layer_set_text', 'void', ['TextLayer **text_layer', 'const char **text'], true, false],
        ['text_layer_set_text_alignment', 'void', ['TextLayer **text_layer', 'GTextAlignment text_alignment'], true, false],
        ['text_layer_set_text_color', 'void', ['TextLayer **text_layer', 'GColor color'], true, false],
        ['tick_timer_service_subscribe', 'void', ['TimeUnits tick_units', 'TickHandler handler'], true, true],
        ['tick_timer_service_unsubscribe', 'void', [], true, true],
        ['time_ms', 'uint16_t', ['time_t **tloc', 'uint16_t **out_ms'], true, true],
        ['uuid_equal', 'bool', ['const Uuid **uu1', 'const Uuid **uu2'], true, true],
        ['uuid_to_string', 'void', ['const Uuid **uuid', 'char **buffer'], true, true],
        ['vibes_cancel', 'void', [], true, false],
        ['vibes_double_pulse', 'void', [], true, false],
        ['vibes_enqueue_custom_pattern', 'void', ['VibePattern pattern'], true, false],
        ['vibes_long_pulse', 'void', [], true, false],
        ['vibes_short_pulse', 'void', [], true, false],
        ['watch_info_get_color', 'WatchInfoColor', [], true, true],
        ['watch_info_get_firmware_version', 'WatchInfoVersion', [], true, true],
        ['watch_info_get_model', 'WatchInfoModel', [], true, true],
        ['window_create', 'Window *', [], true, false],
        ['window_destroy', 'void', ['Window **window'], true, false],
        ['window_get_click_config_context', 'void *', ['Window **window'], true, false],
        ['window_get_click_config_provider', 'ClickConfigProvider', ['const Window **window'], true, false],
        ['window_get_fullscreen', 'bool', ['const Window **window'], true, false],
        ['window_get_root_layer', 'struct Layer *', ['const Window **window'], true, false],
        ['window_get_user_data', 'void *', ['const Window **window'], true, false],
        ['window_is_loaded', 'bool', ['Window **window'], true, false],
        ['window_long_click_subscribe', 'void', ['ButtonId button_id', 'uint16_t delay_ms', 'ClickHandler down_handler', 'ClickHandler up_handler'], true, false],
        ['window_multi_click_subscribe', 'void', ['ButtonId button_id', 'uint8_t min_clicks', 'uint8_t max_clicks', 'uint16_t timeout', 'bool last_click_only', 'ClickHandler handler'], true, false],
        ['window_raw_click_subscribe', 'void', ['ButtonId button_id', 'ClickHandler down_handler', 'ClickHandler up_handler', 'void **context'], true, false],
        ['window_set_background_color', 'void', ['Window **window', 'GColor background_color'], true, false],
        ['window_set_click_config_provider', 'void', ['Window **window', 'ClickConfigProvider click_config_provider'], true, false],
        ['window_set_click_config_provider_with_context', 'void', ['Window **window', 'ClickConfigProvider click_config_provider', 'void **context'], true, false],
        ['window_set_click_context', 'void', ['ButtonId button_id', 'void **context'], true, false],
        ['window_set_fullscreen', 'void', ['Window **window', 'bool enabled'], true, false],
        ['window_set_status_bar_icon', 'void', ['Window **window', 'const GBitmap **icon'], true, false],
        ['window_set_user_data', 'void', ['Window **window', 'void **data'], true, false],
        ['window_set_window_handlers', 'void', ['Window **window', 'WindowHandlers handlers'], true, false],
        ['window_single_click_subscribe', 'void', ['ButtonId button_id', 'ClickHandler handler'], true, false],
        ['window_single_repeating_click_subscribe', 'void', ['ButtonId button_id', 'uint16_t repeat_interval_ms', 'ClickHandler handler'], true, false],
        ['window_stack_contains_window', 'bool', ['Window **window'], true, false],
        ['window_stack_get_top_window', 'Window *', [], true, false],
        ['window_stack_pop', 'Window *', ['bool animated'], true, false],
        ['window_stack_pop_all', 'void', ['const bool animated'], true, false],
        ['window_stack_push', 'void', ['Window **window', 'bool animated'], true, false],
        ['window_stack_remove', 'bool', ['Window **window', 'bool animated'], true, false],
        ['worker_event_loop', 'void', [], false, true],
        ['worker_launch_app', 'void', [], false, true]
    ];

    var types2 = [
        ['AccelAxisType', true, true],
        ['AccelDataHandler', true, true],
        ['AccelRawDataHandler', true, true],
        ['AccelSamplingRate', true, true],
        ['AccelTapHandler', true, true],
        ['ActionBarLayer', true, false],
        ['AnimationCurve', true, false],
        ['AnimationCurveFunction', true, false],
        ['AnimationSetupImplementation', true, false],
        ['AnimationStartedHandler', true, false],
        ['AnimationStoppedHandler', true, false],
        ['AnimationTeardownImplementation', true, false],
        ['AnimationUpdateImplementation', true, false],
        ['AppFocusHandler', true, false],
        ['AppLogLevel', true, true],
        ['AppMessageInboxDropped', true, false],
        ['AppMessageInboxReceived', true, false],
        ['AppMessageOutboxFailed', true, false],
        ['AppMessageOutboxSent', true, false],
        ['AppMessageResult', true, false],
        ['AppSyncErrorCallback', true, false],
        ['AppSyncTupleChangedCallback', true, false],
        ['AppTimer', true, true],
        ['AppTimerCallback', true, true],
        ['AppWorkerMessageHandler', true, true],
        ['AppWorkerResult', true, true],
        ['BatteryStateHandler', true, true],
        ['BitmapLayer', true, false],
        ['BluetoothConnectionHandler', true, true],
        ['ButtonId', true, false],
        ['ClickConfigProvider', true, false],
        ['ClickHandler', true, false],
        ['ClickRecognizerRef', true, false],
        ['CompassHeading', true, true],
        ['CompassHeadingHandler', true, true],
        ['CompassStatus', true, true],
        ['DataLoggingItemType', true, true],
        ['DataLoggingResult', true, true],
        ['DataLoggingSessionRef', true, true],
        ['Dictionary', true, true],
        ['DictionaryKeyUpdatedCallback', true, true],
        ['DictionaryResult', true, true],
        ['DictionarySerializeCallback', true, true],
        ['GAlign', true, false],
        ['GColor', true, false],
        ['GCompOp', true, false],
        ['GContext', true, false],
        ['GCornerMask', true, false],
        ['GFont', true, false],
        ['GPointGetter', true, false],
        ['GPointReturn', true, false],
        ['GPointSetter', true, false],
        ['GRectGetter', true, false],
        ['GRectReturn', true, false],
        ['GRectSetter', true, false],
        ['GTextAlignment', true, false],
        ['GTextLayoutCacheRef', true, false],
        ['GTextOverflowMode', true, false],
        ['Int16Getter', true, false],
        ['Int16Setter', true, false],
        ['InverterLayer', true, false],
        ['Layer', true, false],
        ['LayerUpdateProc', true, false],
        ['MenuLayer', true, false],
        ['MenuLayerDrawHeaderCallback', true, false],
        ['MenuLayerDrawRowCallback', true, false],
        ['MenuLayerDrawSeparatorCallback', true, false],
        ['MenuLayerGetCellHeightCallback', true, false],
        ['MenuLayerGetHeaderHeightCallback', true, false],
        ['MenuLayerGetNumberOfRowsInSectionsCallback', true, false],
        ['MenuLayerGetNumberOfSectionsCallback', true, false],
        ['MenuLayerGetSeparatorHeightCallback', true, false],
        ['MenuLayerSelectCallback', true, false],
        ['MenuLayerSelectionChangedCallback', true, false],
        ['MenuRowAlign', true, false],
        ['NumberWindow', true, false],
        ['NumberWindowCallback', true, false],
        ['ResHandle', true, false],
        ['RotBitmapLayer', true, false],
        ['ScrollLayer', true, false],
        ['ScrollLayerCallback', true, false],
        ['SimpleMenuLayer', true, false],
        ['SimpleMenuLayerSelectCallback', true, false],
        ['SniffInterval', true, true],
        ['StatusCode', true, true],
        ['TextLayer', true, false],
        ['TextLayout', true, false],
        ['TickHandler', true, true],
        ['TimeUnits', true, true],
        ['TupleType', true, true],
        ['WatchInfoColor', true, true],
        ['WatchInfoModel', true, true],
        ['Window', true, false],
        ['WindowHandler', true, false],
        ['status_t', true, true],
        ['time_t', true, true]
    ];

    var constants2 = [
        ['ACCEL_AXIS_X', true, true],
        ['ACCEL_AXIS_Y', true, true],
        ['ACCEL_AXIS_Z', true, true],
        ['ACCEL_SAMPLING_100HZ', true, true],
        ['ACCEL_SAMPLING_10HZ', true, true],
        ['ACCEL_SAMPLING_25HZ', true, true],
        ['ACCEL_SAMPLING_50HZ', true, true],
        ['APP_LOG_LEVEL_DEBUG', true, true],
        ['APP_LOG_LEVEL_DEBUG_VERBOSE', true, true],
        ['APP_LOG_LEVEL_ERROR', true, true],
        ['APP_LOG_LEVEL_INFO', true, true],
        ['APP_LOG_LEVEL_WARNING', true, true],
        ['APP_MSG_ALREADY_RELEASED', true, false],
        ['APP_MSG_APP_NOT_RUNNING', true, false],
        ['APP_MSG_BUFFER_OVERFLOW', true, false],
        ['APP_MSG_BUSY', true, false],
        ['APP_MSG_CALLBACK_ALREADY_REGISTERED', true, false],
        ['APP_MSG_CALLBACK_NOT_REGISTERED', true, false],
        ['APP_MSG_CLOSED', true, false],
        ['APP_MSG_INTERNAL_ERROR', true, false],
        ['APP_MSG_INVALID_ARGS', true, false],
        ['APP_MSG_NOT_CONNECTED', true, false],
        ['APP_MSG_OK', true, false],
        ['APP_MSG_OUT_OF_MEMORY', true, false],
        ['APP_MSG_SEND_REJECTED', true, false],
        ['APP_MSG_SEND_TIMEOUT', true, false],
        ['APP_WORKER_RESULT_ALREADY_RUNNING', true, true],
        ['APP_WORKER_RESULT_ASKING_CONFIRMATION', true, true],
        ['APP_WORKER_RESULT_DIFFERENT_APP', true, true],
        ['APP_WORKER_RESULT_NOT_RUNNING', true, true],
        ['APP_WORKER_RESULT_NO_WORKER', true, true],
        ['APP_WORKER_RESULT_SUCCESS', true, true],
        ['AnimationCurveCustomFunction', true, false],
        ['AnimationCurveEaseIn', true, false],
        ['AnimationCurveEaseInOut', true, false],
        ['AnimationCurveEaseOut', true, false],
        ['AnimationCurveLinear', true, false],
        ['BUTTON_ID_BACK', true, false],
        ['BUTTON_ID_DOWN', true, false],
        ['BUTTON_ID_SELECT', true, false],
        ['BUTTON_ID_UP', true, false],
        ['CompassStatusCalibrated', true, true],
        ['CompassStatusCalibrating', true, true],
        ['CompassStatusDataInvalid', true, true],
        ['DATA_LOGGING_BUSY', true, true],
        ['DATA_LOGGING_BYTE_ARRAY', true, true],
        ['DATA_LOGGING_CLOSED', true, true],
        ['DATA_LOGGING_FULL', true, true],
        ['DATA_LOGGING_INT', true, true],
        ['DATA_LOGGING_INVALID_PARAMS', true, true],
        ['DATA_LOGGING_NOT_FOUND', true, true],
        ['DATA_LOGGING_SUCCESS', true, true],
        ['DATA_LOGGING_UINT', true, true],
        ['DAY_UNIT', true, true],
        ['DICT_INTERNAL_INCONSISTENCY', true, true],
        ['DICT_INVALID_ARGS', true, true],
        ['DICT_MALLOC_FAILED', true, true],
        ['DICT_NOT_ENOUGH_STORAGE', true, true],
        ['DICT_OK', true, true],
        ['E_BUSY', true, true],
        ['E_DOES_NOT_EXIST', true, true],
        ['E_ERROR', true, true],
        ['E_INTERNAL', true, true],
        ['E_INVALID_ARGUMENT', true, true],
        ['E_INVALID_OPERATION', true, true],
        ['E_OUT_OF_MEMORY', true, true],
        ['E_OUT_OF_RESOURCES', true, true],
        ['E_OUT_OF_STORAGE', true, true],
        ['E_RANGE', true, true],
        ['E_UNKNOWN', true, true],
        ['GAlignBottom', true, false],
        ['GAlignBottomLeft', true, false],
        ['GAlignBottomRight', true, false],
        ['GAlignCenter', true, false],
        ['GAlignLeft', true, false],
        ['GAlignRight', true, false],
        ['GAlignTop', true, false],
        ['GAlignTopLeft', true, false],
        ['GAlignTopRight', true, false],
        ['GColorBlack', true, false],
        ['GColorClear', true, false],
        ['GColorWhite', true, false],
        ['GCompOpAnd', true, false],
        ['GCompOpAssign', true, false],
        ['GCompOpAssignInverted', true, false],
        ['GCompOpClear', true, false],
        ['GCompOpOr', true, false],
        ['GCompOpSet', true, false],
        ['GCornerBottomLeft', true, false],
        ['GCornerBottomRight', true, false],
        ['GCornerNone', true, false],
        ['GCornerTopLeft', true, false],
        ['GCornerTopRight', true, false],
        ['GCornersAll', true, false],
        ['GCornersBottom', true, false],
        ['GCornersLeft', true, false],
        ['GCornersRight', true, false],
        ['GCornersTop', true, false],
        ['GTextAlignmentCenter', true, false],
        ['GTextAlignmentLeft', true, false],
        ['GTextAlignmentRight', true, false],
        ['GTextOverflowModeFill', true, false],
        ['GTextOverflowModeTrailingEllipsis', true, false],
        ['GTextOverflowModeWordWrap', true, false],
        ['HOUR_UNIT', true, true],
        ['MINUTE_UNIT', true, true],
        ['MONTH_UNIT', true, true],
        ['MenuRowAlignBottom', true, false],
        ['MenuRowAlignCenter', true, false],
        ['MenuRowAlignNone', true, false],
        ['MenuRowAlignTop', true, false],
        ['NUM_BUTTONS', true, false],
        ['NumSystemAnimationCurve', true, false],
        ['SECOND_UNIT', true, true],
        ['SNIFF_INTERVAL_NORMAL', true, true],
        ['SNIFF_INTERVAL_REDUCED', true, true],
        ['S_FALSE', true, true],
        ['S_NO_ACTION_REQUIRED', true, true],
        ['S_NO_MORE_ITEMS', true, true],
        ['S_SUCCESS', true, true],
        ['S_TRUE', true, true],
        ['TUPLE_BYTE_ARRAY', true, true],
        ['TUPLE_CSTRING', true, true],
        ['TUPLE_INT', true, true],
        ['TUPLE_UINT', true, true],
        ['WATCH_INFO_COLOR_BLACK', true, true],
        ['WATCH_INFO_COLOR_BLUE', true, true],
        ['WATCH_INFO_COLOR_GREEN', true, true],
        ['WATCH_INFO_COLOR_GREY', true, true],
        ['WATCH_INFO_COLOR_MATTE_BLACK', true, true],
        ['WATCH_INFO_COLOR_ORANGE', true, true],
        ['WATCH_INFO_COLOR_PINK', true, true],
        ['WATCH_INFO_COLOR_RED', true, true],
        ['WATCH_INFO_COLOR_STAINLESS_STEEL', true, true],
        ['WATCH_INFO_COLOR_UNKNOWN', true, true],
        ['WATCH_INFO_COLOR_WHITE', true, true],
        ['WATCH_INFO_MODEL_PEBBLE_ORIGINAL', true, true],
        ['WATCH_INFO_MODEL_PEBBLE_STEEL', true, true],
        ['WATCH_INFO_MODEL_UNKNOWN', true, true],
        ['YEAR_UNIT', true, true]
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

    var getCompletions = function(editor, token) {
        var results = tree2.search(token.string.toLowerCase(), 15);
        var ret = [];
        if(results.length == 1 && results[0] == token.string) {
            return [];
        }
        for (var i = results.length - 1; i >= 0; i--) {
            if(typeof results[i] == 'string') {
                ret.push({text: results[i]});
                continue;
            }
            var result = results[i];
            var in_pebble = result[result.length-2];
            var in_worker = result[result.length-1];
            if((editor.file_target == 'app' && !in_pebble) || (editor.file_target == 'worker' && ! in_worker)) {
                continue;
            }
            if(result.length == 3) {
                ret.push({text: result[0]});
                continue;
            }
            ret.push({
                text: result[0] + '(' + result[2].join(', ') + ')',
                params: result[2],
                ret: result[1],
                name: result[0],
                hint: expandCompletion,
                render: renderCompletion
            });
        }
        return ret;
    };

    var is_inited = false;

    return {
        Complete: function(editor, options) {
            var token = editor.getTokenAt(editor.getCursor());
            var completions = [];
            if(token.string !== '') {
                completions = getCompletions(editor, token);
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
