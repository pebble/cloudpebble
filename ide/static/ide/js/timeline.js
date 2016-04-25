/**
 * Created by katharine on 19/3/15.
 */

CloudPebble.Timeline = new (function() {
    var mEditor = null;
    var mCurrentAction = null;
    function setStatus(okay, text) {
        $('#timeline-status').text(text);
        if(okay) {
            $('#timeline-status').addClass('good').removeClass('bad');
        } else {
            $('#timeline-status').addClass('bad').removeClass('good');
        }
    }

    function handleTimelineResult(success) {
        var analytics = {
            'insert': 'sdk_pin_inserted',
            'delete': 'sdk_pin_deleted'
        };
        if(mCurrentAction) {
            CloudPebble.Analytics.addEvent(analytics[mCurrentAction], {success: success});
            mCurrentAction = null;
        }
        if(success) {
            setStatus(true, "Sent pin.");
        } else {
            setStatus(false, "Pin could not be sent.");
        }
    }

    function insertPin() {
        mCurrentAction = 'insert';
        var content = mEditor.getValue();
        var json;
        try {
            json = JSON.parse(content);
        } catch(e) {
            setStatus(false, e);
            return;
        }
        if(!_.has(json, 'id')) {
            setStatus(false, "You must provide an 'id'.");
            return;
        }
        if(!_.has(json, 'time')) {
            setStatus(false, "You must specify a 'time' for the pin.");
            return;
        }
        if(!_.has(json, 'layout')) {
            setStatus(false, "You must provide a 'layout' for the pin");
            return;
        }
        setStatus(true, '');
        SharedPebble.getPebble(ConnectionType.QemuBasalt)
            .then(function(pebble) {
                pebble.once('timeline:result', handleTimelineResult);
                pebble.emu_send_pin(content);
            });
    }

    function deletePin() {
        mCurrentAction = 'delete';
        var content = mEditor.getValue();
        var id = JSON.parse(content)['id'];
        SharedPebble.getPebble(ConnectionType.QemuBasalt)
            .then(function(pebble) {
                pebble.once('timeline:result', handleTimelineResult);
                pebble.emu_delete_pin(id);
            });
    }

    this.show = function() {
        CloudPebble.Sidebar.SuspendActive();
        CloudPebble.Analytics.addEvent("cloudpebble_timeline_displayed", {}, null, ["cloudpebble"]);
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
        CloudPebble.Sidebar.SetActivePane($('#timeline-pane').show(), {id: 'timeline'});
        mEditor.refresh();

        $('#timeline-insert-btn').click(insertPin);
        $('#timeline-delete-btn').click(deletePin);
    }
})();

