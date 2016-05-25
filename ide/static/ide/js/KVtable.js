/**
 * Creates a Key-Value Editor inside a table element.
 * @param table_elm selector or jquery element for a table to fill
 * @param options customisation options
 * @param options.key_name Header text for the 'name' column
 * @param options.value_name Header text for the 'value' column
 * @param options.value_type The value for the type attribute of the value input element
 * @param options.data Initial data, as an array of [key, value] tuples
 * @param options.placeholder Placeholder text for the final 'empty' row
 * @param options.default_value The initial value for new rows
 * @constructor
 */
CloudPebble.KVTable = function(table_elm, options) {

    var opts = _.defaults(options || {}, {
        key_name: 'Key',
        value_name: 'Value',
        value_type: 'text',
        data: [],
        placeholder: gettext('New Entry'),
        default_value: null
    });

    if (opts.default_value === null && opts.value_type == 'number') opts.default_value = '0';
    if (opts.default_value === null && opts.value_type == 'text') opts.default_value = '';

    var th_key;
    var th_value;
    var body;
    var table = $(table_elm);

    /** Render a single row. If the key is empty, an empty row is created instead.
     *
     * @param key Value for the key input element
     * @param value Value for the value input element
     * @returns {jQuery} A <tr> containing two input elements and a delete button
     */
    function render_row(key, value) {
        value = key ? value : opts.default_value;
        var placeholder = key ? null : opts.placeholder;
        return $('<tr>').append([
            $('<td>').append($('<input>').val(key).addClass('kv-key').attr('type', 'text').attr('placeholder', placeholder)),
            $('<td>').append($('<input>').val(value).addClass('kv-value').attr('type', opts.value_type)),
            $('<td>').append($('<button>').text('-').addClass("btn kv-remove"))
        ]);
    }

    /** Render a set of rows for some data
     *
     * @param data Array of [key, value] tuples to populate the data with
     * @returns {jQuery} a tbody with rows for the data and an extra empty row
     */
    function render_body(data) {
        return $('<tbody>').append(_.map(data, function(tuple) {
            return render_row(tuple[0], tuple[1]);
        })).append(render_row());
    }

    /** Render the entire table into the element and setup all event handlers */
    function render() {
        th_key = $('<th>').text(opts.key_name);
        th_value = $('<th>').text(opts.value_name);
        table.append($('<thead>').append($('<tr>').append(
            [th_key, th_value, $('<th>&nbsp</th>')])
        ));
        body = render_body(opts.data);
        table.append(body);

        // If the user enters a new key in the last row, add another row
        body.on('change', 'tr:last-child .kv-key', function() {
            addField();
        });

        // If the user clicks any delete button except the last one, delete the row
        body.on('click', 'tr:not(:last-child) button.kv-remove', function () {
            $(this).closest('tr').remove();
            table.trigger('rowDeleted');
        });
    }

    /** Add an empty row and promote the current last-row to a real K-V item.
     * Triggers a 'rowAdded' event on the elemnt, with the new empty row as an argument.
     */
    function addField() {
        body.find('tr:last-child .kv-key')
            .attr('placeholder', null)
            .closest('button').removeClass('disabled');
        var row = render_row();
        body.append(row);
        table.trigger('rowAdded', row);
    }

    /**
     * Set the new default value for all new rows, and also set the value of the
     * currently existing last row
     * @param new_default
     */
    this.setDefaultValue = function setDefaultValue(new_default) {
        opts.default_value = new_default;
        body.find('tr:last-child input.kv-value').val(new_default)
    };

    /**
     * Change the text of the key column's header
     * @param new_title
     */
    this.setKeyName = function setKeyName(new_title) {
        opts.key_name = new_title;
        th_key.text(new_title);
    };

    /**
     * Change the text of the value column's header
     * @param new_title
     */
    this.setValueName = function setValueName(new_title) {
        opts.value_name = new_title;
        th_value.text(new_title)
    };

    /**
     * If the argument supplied is not a function, set every row's value to the argument's value.
     * If the argument supplied is a function, then for each row, call the callback function with
     * the row's name, value and row index. The callback should return a new value for that row.
     * @param callback Value for each row or function which computes the new value.
     */
    this.mapValues = function mapValues(callback) {
        body.find('tr').each(function(i) {
            var name = $(this).find('input.kv-key').val();
            var old_value = $(this).find('input.kv-value').val();
            var new_value = (_.isFunction(callback) ? callback(name, old_value, i) : callback);
            $(this).find('input.kv-value').val(new_value);
        });
    };

    /**
     * Get the table's values
     * @returns {Array} An array of [key, value] tuples.
     */
    this.getValues = function getValues() {
        return body.find('tr:not(:last-child)').map(function() {
            return [[
                $(this).find('input.kv-key').val(),
                $(this).find('input.kv-value').val()
            ]]
        });
    };

    this.addValue = function addValue(name, value) {
        render_row(name, value).insertBefore(body.find('tr:last-child'));
    };

    render();
};