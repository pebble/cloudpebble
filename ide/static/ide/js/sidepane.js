CloudPebble.SidePane = (function() {
    var vertical = 1;
    var horizontal = 2;

    /**
     * A pane container
     * @param orientation either CloudPebble.SidePane.Horizontal or CloudPebble.SidePane.Vertical
     * @constructor
     */
    function SidePane(orientation) {
        var self = this;
        var active_pane;
        var suspended_panes = {};
        var active_kind;
        var active_id;
        var container;
        var main_pane;

        var get_suspended_pane = function(kind, id) {
            return suspended_panes[kind+'-'+id];
        };
        var set_suspended_pane = function(kind, id, pane) {
            console.log("setting pane", kind, id);
            suspended_panes[kind+'-'+id] = pane;
        };
        var destroy_suspended_pane = function(pane) {
            console.log("de panes", suspended_panes);
            delete suspended_panes[_.findKey(suspended_panes, function(p) {return !p.is(pane);})];
        };

        this.getSuspendedPanes = function() {
            return suspended_panes;
        };

        this.attachPane = function(pane, kind, id) {
            $(container).append(pane);
            active_kind = kind;
            active_id = id;
            active_pane = pane;
            pane.trigger('attached');
        };

        this.suspendActivePane = function() {
            if (active_pane) {
                active_pane.detach();
                active_pane.trigger('detached');
                set_suspended_pane(active_kind, active_id, active_pane);
            }
        };

        this.restorePane = function(kind, id) {
            var pane = get_suspended_pane(kind, id);
            if (!pane) {
                return false;
            }
            else if (pane == active_pane) {
                return pane;
            }
            else {
                this.suspendActivePane();
                this.attachPane(pane);
                pane.trigger('restored');
                return pane;
            }
        };

        this.addPane = function(pane, kind, id) {
            this.suspendActivePane();
            this.attachPane(pane, kind, id);
        };

        this.setSize = function(size) {
            if (orientation === vertical) {
                console.log(size);
                $(container).css({width: size});
                $(main_pane).css({right: size});
            }
            else if (orientation === horizontal) {
                $(container).css({height: size});
                $(main_pane).css({bottom: size});
            }
            else {
                throw "Invalid orientation";
            }
            $(container).trigger('resize', [size]);
            $(main_pane).trigger('resize', [size]);
        };

        this.init = function(set_container, page_main_pane) {
            container = set_container;
            main_pane = page_main_pane;

            $(container).on('destroy', ':first-child', function(event) {
                if ($(event.target).is(active_pane)) {
                    // The user is destroying the active pane
                    self.suspendActivePane();
                    self.setSize(0);
                }
                destroy_suspended_pane($(event.target));

            });
        };

    }

    return {
        Orientations: {
            Vertical: vertical,
            Horizontal: horizontal
        },
        SidePane: SidePane,
        RightPane: new SidePane(vertical),
        Init: function() {
            CloudPebble.SidePane.RightPane.init('#right-pane', '#main-pane');
            CloudPebble.SidePane.RightPane.setSize('0');
        }
    }
})();