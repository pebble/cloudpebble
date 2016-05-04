CloudPebble.SidePane = (function() {
    /**
     * A pane container
     * @param {String} container CSS selector for the side pane's element
     * @param {String} main_pane CSS selector for the primary pane's element
     * @constructor
     */
    function SidePane(container, main_pane) {
        var active_pane;
        var suspended_panes = {};
        var active_kind;
        var active_id;

        _.extend(this, Backbone.Events);

        var get_suspended_pane = function(kind, id) {
            return suspended_panes[kind+'-'+id];
        };

        var set_suspended_pane = function(kind, id, pane) {
            active_pane = null;
            active_id = null;
            suspended_panes[kind+'-'+id] = pane;
        };
        var destroy_suspended_pane = function(pane) {
            suspended_panes = _.omit(suspended_panes, function(p) {
                return p.is(pane);
            });
        };

        /**
         * Compute the correct min-size for #parent-pane given a desired panel size and current orientation.
         * The size takes into account the min-width/min-height of the main pane.
         *
         * @param {Number} panel_size Desired side panel size
         * @returns {Number} new min width or height for #$parent-pane
         */
        var compute_outer_size = function(panel_size) {
            return panel_size + parseInt($(main_pane).css('min-width'), 10);
        };

        /**
         * Attach a new pane to the sidebar.
         * @param {jQuery} pane Element to attach
         * @param {String} kind String name for the kind of pane
         * @param {Number} id Numeric ID for the pane
         */
        this.attachPane = function(pane, kind, id) {
            $(container).append(pane);
            active_kind = kind;
            active_id = id;
            active_pane = pane;
            if (pane.css('width')) this.setSize(pane.css('width'));
            pane.trigger('attached');
        };

        /**
         * Suspend the currently active pane. Causes it to fire a "detached" event.
         */
        this.suspendActivePane = function() {
            if (active_pane) {
                active_pane.detach();
                active_pane.trigger('detached');
                set_suspended_pane(active_kind, active_id, active_pane);
            }
        };

        /**
         * Restore a previously suspended pane
         * @param kind String name for the kind of pane
         * @param id Numeric ID for the pane
         * @returns {jQuery|Boolean} The restored pane, or false if the pane was not found
         */
        this.restorePane = function(kind, id) {
            if (active_kind == kind && active_id == id) {
                return active_pane;
            }
            var pane = get_suspended_pane(kind, id);
            if (!pane) {
                return false;
            }
            else if (pane == active_pane) {
                return pane;
            }
            else {
                this.suspendActivePane();
                this.attachPane(pane, kind, id);
                pane.trigger('restored');
                return pane;
            }
        };

        /**
         * Suspend the currently active pane, and attach a new pane.
         * @param pane
         * @param kind
         * @param id
         */
        this.addPane = function(pane, kind, id) {
            this.suspendActivePane();
            this.attachPane(pane, kind, id);
            pane.on('resize', function(event, size) {
                this.setSize(size);
            }.bind(this));
        };

        /**
         * Set the size of the sidepane container.
         * @param {Number} size desired size
         */
        this.setSize = function(size) {
            var size_str = (size == 0 ? "0" : size+"px");
            var outer_size_str = compute_outer_size(size)+"px";
            $(container).css({width: size_str});
            $(main_pane).css({right: size_str});
            $(container).parent().css({"min-width": outer_size_str});
            $(container).trigger('resize', [size_str]);
            $(main_pane).trigger('resize', [size_str]);
        };

        $(container).on('destroy', ':first-child', function(event) {
            if ($(event.target).is(active_pane)) {
                // The user is destroying the active pane
                this.suspendActivePane();
                this.setSize(0);
            }
            destroy_suspended_pane($(event.target));
        }.bind(this));
        this.setSize(0);
    }
    
    return new SidePane('#right-pane', '#main-pane');
})();
