/**
 * Created by katharine on 19/3/15.
 */

CloudPebble.Timeline = new (function() {
    var mEditor = null;
    function insertPin() {
        var content = mEditor.getValue();
        SharedPebble.getPebble(ConnectionType.QemuBasalt)
            .done(function(pebble) {
                pebble.emu_send_pin(content);
            });
    }

    function deletePin() {
        var content = mEditor.getValue();
        var id = JSON.parse(content)['id'];
        SharedPebble.getPebble(ConnectionType.QemuBasalt)
            .done(function(pebble) {
                pebble.emu_delete_pin(id);
            });
    }

    this.show = function() {
        CloudPebble.Sidebar.SuspendActive();
        if(CloudPebble.Sidebar.Restore("timeline")) {
            return;
        }
        mEditor = CodeMirror.fromTextArea($('#timeline-input')[0], {
            indentUnit: USER_SETTINGS.tab_width,
            tabSize: USER_SETTINGS.tab_width,
            lineNumbers: true,
            autofocus: true,
            electricChars: true,
            matchBrackets: true,
            autoCloseBrackets: true,
            //highlightSelectionMatches: true,
            smartIndent: true,
            indentWithTabs: !USER_SETTINGS.use_spaces,
            mode: "application/json",
            styleActiveLine: true,
            theme: USER_SETTINGS.theme
        });
        CloudPebble.Sidebar.SetActivePane($('#timeline-pane').show(), 'timeline');
        mEditor.refresh();

        $('#timeline-insert-btn').click(insertPin);
        $('#timeline-delete-btn').click(deletePin);
    }
})();

