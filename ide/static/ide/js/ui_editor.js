CloudPebble.UIEditor = (function() {
    /**
     *
     * @param {jQuery|HTMLElement} pane
     * @param {String} source
     * @constructor
     */
    function UIEditor(pane, source) {
        var self = this;
        var mPane = null;
        var mIB = null;

        function init(pane, source) {
            mPane = pane;
            mIB = new IB(mPane.find('.ui-canvas'), mPane.find('#ui-properties'), mPane.find('#ui-toolkit'), source);
        }

        init(pane, source);
    }

    function prepareEditorPane() {
        var pane = $('#ui-editor-pane-template').clone();
        pane.removeClass('hide');
        return pane;
    }

    function showUIEditor(source) {
        CloudPebble.Sidebar.SuspendActive();
        var pane = prepareEditorPane();
        CloudPebble.Sidebar.SetActivePane(pane);
        new UIEditor(pane, source);
    }

    return {
        /**
         * Displays a UI editor pane.
         * @param {String} source
         */
        Show: function(source) {
            showUIEditor(source);
        }
    }
})();
