CloudPebble.UIEditor = (function() {
    /**
     *
     * @param {jQuery|HTMLElement} pane
     * @param {CodeMirror} cm
     * @constructor
     */
    function UIEditor(pane, cm) {
        var self = this;
        var mPane = null;
        var mIB = null;
        var mCodeMirror = cm;

        function init(pane) {
            mPane = pane;
            mIB = new IB(mPane.find('.ui-canvas'), mPane.find('#ui-properties'), mPane.find('#ui-toolkit'), mCodeMirror.getValue());
        }

        init(pane);
    }

    function prepareEditorPane() {
        var pane = $('#ui-editor-pane-template').clone();
        pane.removeClass('hide');
        return pane;
    }

    function showUIEditor(cm) {
        CloudPebble.Sidebar.SuspendActive();
        var pane = prepareEditorPane();
        CloudPebble.Sidebar.SetActivePane(pane, 'ui-editor');
        new UIEditor(pane, cm);
    }

    return {
        /**
         * Displays a UI editor pane.
         * @param {CodeMirror} cm
         */
        Show: function(cm) {
            showUIEditor(cm);
        }
    }
})();
