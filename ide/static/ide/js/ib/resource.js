(function() {
    IB.Resources = {};
    /**
     * Represents a resource stored on flash
     * @param {string} resource_id
     * @constructor
     * @abstract
     */
    IB.Resources.Resource = function(resource_id) {
        this._resource_id = resource_id;
        this.name = this._generateName();
    };
    IB.Resources.Resource.prototype = {
        constructor: IB.Resources.Resource,
        /**
         * Produces a variable name to store the resource in.
         * @returns {string} Variable name
         * @private
         */
        _generateName: function() {
            return 's_res_' + this._resource_id.toLowerCase();
        },
        /**
         * Returns the resource ID.
         * @returns {string}
         */
        getID: function() {
            return this._resource_id;
        },
        /**
         * Returns a declaration for the resource
         * @returns {string[]} Array of declaration lines
         */
        generateDeclaration: function() {
            return ["static " + this.constructor.className + " *" + this.name + ";"];
        },
        /**
         * Returns an initialiser for the resource
         * @returns {string[]} Array of initialisation lines
         * @abstract
         */
        generateInitialiser: function() {
            throw new Error("Not implemented.");
        },
        /**
         * Returns an destructor for the resource
         * @returns {string[]} Array of destruction lines
         * @abstract
         */
        generateDestructor: function() {
            throw new Error("Not implemented.");
        },
        /**
         * Returns the name of the resource.
         * @returns {string}
         */
        toString: function() {
            return this.name;
        }
    };

    var _super = IB.Resources.Resource.prototype;
    var Resource = IB.Resources.Resource;

    /**
     * Represents a GBitmap
     * @param {string} resource_id
     * @constructor
     * @extends {IB.Resources.Resource}
     */
    IB.Resources.Bitmap = function(resource_id) {
        Resource.call(this, resource_id);
    };
    IB.Resources.Bitmap.className = 'GBitmap';
    IB.Resources.Bitmap.prototype = Object.create(_super);
    _.extend(IB.Resources.Bitmap.prototype, {
        constructor: IB.Resources.Bitmap,
        generateInitialiser: function() {
            return [this.name + " = gbitmap_create_with_resource(RESOURCE_ID_" + this._resource_id + ");"];
        },
        generateDestructor: function() {
            return ["gbitmap_destroy(" + this.name + ");"];
        }
    });
    IB.Resources.Bitmap.resourceFromInitialiser = function(fn_name, res_id) {
        return new IB.Resources.Bitmap(res_id.replace(/^RESOURCE_ID_/, ''));
    };

    IB.resourceRegistry.register(IB.Resources.Bitmap);

    /**
     * Represents a GFont
     * @param {string} resource_id Resource ID, excluding RESOURCE_ID_ or FONT_KEY_.
     * @param {boolean} is_custom Whether it's a custom or system font
     * @constructor
     * @extends {IB.Resources.Resource}
     */
    IB.Resources.Font = function(resource_id, is_custom) {
        Resource.call(this, resource_id);
        this._is_custom = is_custom;
    };
    IB.Resources.Font.className = 'GFont';
    IB.Resources.Font.prototype = Object.create(_super);
    _.extend(IB.Resources.Font.prototype, {
        constructor: IB.Resources.Font,
        generateDeclaration: function() {
            return ["static GFont " + this.name + ";"];
        },
        generateInitialiser: function() {
            if(!this._is_custom) {
                return [this.name + " = fonts_get_system_font(FONT_KEY_" + this._resource_id + ");"];
            } else {
                return [this.name + " = fonts_load_custom_font(resource_get_handle(RESOURCE_ID_" + this._resource_id + "));"];
            }
        },
        generateDestructor: function() {
            if(!this._is_custom) {
                return [];
            } else {
                return ["fonts_unload_custom_font(" + this.name + ");"];
            }
        }
    });
    IB.Resources.Font.resourceFromInitialiser = function(fn_name, id) {
        if(fn_name == 'fonts_get_system_font') {
            return new IB.Resources.Font(id.replace(/^FONT_KEY_/, ''), false);
        } else if(fn_name == 'fonts_load_custom_font') {
            return new IB.Resources.Font(id.replace(/^resource_get_handle\(RESOURCE_ID_|\)$/g, ''), true);
        } else {
            return null;
        }
    };
    IB.resourceRegistry.register(IB.Resources.Font);
})();
