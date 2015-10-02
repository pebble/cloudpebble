/* Modified Slate colour picker, from https://github.com/pebble/slate/blob/master/lib/js/main.js */

(function ($) {
    'use strict';

    var ENUMS = {
        COLOR: {
            EMPTY: 'transparent'
        }
    };

    $.extend($.fn, {
        pebbleColourPicker: function (options) {

            var options = $.extend({}, {
                sunny: false,
                value_mapping: null
            }, options || {});

            var layout = [
                [false, false, '#55FF00', '#AAFF55', false, '#FFFF55', '#FFFFAA', false, false],
                [false, '#AAFFAA', '#55FF55', '#00FF00', '#AAFF00', '#FFFF00', '#FFAA55', '#FFAAAA', false],
                ['#55FFAA', '#00FF55', '#00AA00', '#55AA00', '#AAAA55', '#AAAA00', '#FFAA00', '#FF5500', '#FF5555'],
                ['#AAFFFF', '#00FFAA', '#00AA55', '#55AA55', '#005500', '#555500', '#AA5500', '#FF0000', '#FF0055'],
                [false, '#55AAAA', '#00AAAA', '#005555', '#FFFFFF', '#000000', '#AA5555', '#AA0000', false],
                ['#55FFFF', '#00FFFF', '#00AAFF', '#0055AA', '#AAAAAA', '#555555', '#550000', '#AA0055', '#FF55AA'],
                ['#55AAFF', '#0055FF', '#0000FF', '#0000AA', '#000055', '#550055', '#AA00AA', '#FF00AA', '#FFAAFF'],
                [false, '#5555AA', '#5555FF', '#5500FF', '#5500AA', '#AA00FF', '#FF00FF', '#FF55FF', false],
                [false, false, false, '#AAAAFF', '#AA55FF', '#AA55AA', false, false, false],
            ];

            var mappingSunny = {
                '000000': '000000', '000055': '001e41', '0000aa': '004387',
                '0000ff': '0068ca', '005500': '2b4a2c', '005555': '27514f',
                '0055aa': '16638d', '0055ff': '007dce', '00aa00': '5e9860',
                '00aa55': '5c9b72', '00aaaa': '57a5a2', '00aaff': '4cb4db',
                '00ff00': '8ee391', '00ff55': '8ee69e', '00ffaa': '8aebc0',
                '00ffff': '84f5f1', '550000': '4a161b', '550055': '482748',
                '5500aa': '40488a', '5500ff': '2f6bcc', '555500': '564e36',
                '555555': '545454', '5555aa': '4f6790', '5555ff': '4180d0',
                '55aa00': '759a64', '55aa55': '759d76', '55aaaa': '71a6a4',
                '55aaff': '69b5dd', '55ff00': '9ee594', '55ff55': '9de7a0',
                '55ffaa': '9becc2', '55ffff': '95f6f2', 'aa0000': '99353f',
                'aa0055': '983e5a', 'aa00aa': '955694', 'aa00ff': '8f74d2',
                'aa5500': '9d5b4d', 'aa5555': '9d6064', 'aa55aa': '9a7099',
                'aa55ff': '9587d5', 'aaaa00': 'afa072', 'aaaa55': 'aea382',
                'aaaaaa': 'ababab', 'ffffff': 'ffffff', 'aaaaff': 'a7bae2',
                'aaff00': 'c9e89d', 'aaff55': 'c9eaa7', 'aaffaa': 'c7f0c8',
                'aaffff': 'c3f9f7', 'ff0000': 'e35462', 'ff0055': 'e25874',
                'ff00aa': 'e16aa3', 'ff00ff': 'de83dc', 'ff5500': 'e66e6b',
                'ff5555': 'e6727c', 'ff55aa': 'e37fa7', 'ff55ff': 'e194df',
                'ffaa00': 'f1aa86', 'ffaa55': 'f1ad93', 'ffaaaa': 'efb5b8',
                'ffaaff': 'ecc3eb', 'ffff00': 'ffeeab', 'ffff55': 'fff1b5',
                'ffffaa': 'fff6d3'
            };

            this.each(function () {

                var $color = $(this);
                var $item = $color.parent();
                var grid = '';
                var itemWidth = 100 / layout[0].length;
                var itemHeight = 100 / layout.length;
                var boxHeight = itemWidth * layout.length;

                for (var i = 0; i < layout.length; i++) {
                    for (var j = 0; j < layout[i].length; j++) {

                        var color = layout[i][j] || ENUMS.COLOR.EMPTY;
                        var selectable = 'selectable';

                        var roundedTL = (i === 0 && j === 0)
                        || i === 0 && !layout[i][j - 1]
                        || !layout[i][j - 1] && !layout[i - 1][j]
                            ? ' rounded-tl' : '';

                        var roundedTR = i === 0 && !layout[i][j + 1]
                        || !layout[i][j + 1] && !layout[i - 1][j]
                            ? ' rounded-tr ' : '';

                        var roundedBL = (i === layout.length - 1 && j === 0)
                        || i === layout.length - 1 && !layout[i][j - 1]
                        || !layout[i][j - 1] && !layout[i + 1][j]
                            ? ' rounded-bl' : '';

                        var roundedBR = i === layout.length - 1 && !layout[i][j + 1]
                        || !layout[i][j + 1] && !layout[i + 1][j]
                            ? ' rounded-br' : '';

                        if (options.sunny && color !== ENUMS.COLOR.EMPTY) {
                            color = '#' + mappingSunny[color.replace('#', '').toLowerCase()];
                        }

                        grid += '<i ' +
                            'class="color-box ' + selectable + roundedTL +
                            roundedTR + roundedBL + roundedBR + '" ' +
                            'data-value="' + color.replace(/^#/, '0x') + '" ' +
                            'style="' +
                            'width:' + itemWidth + '%; ' +
                            'height:' + itemHeight + '%; ' +
                            'background:' + color + ';">' +
                            '</i>';
                    }
                }

                var $injectedColor = $('<div class="item-styled-color">' +
                    '<span class="value" style="background:' + $color.val().replace(/^0x/, '#') + '"></span>' +
                    '<div ' +
                    'style="padding-bottom:' + boxHeight + '%"' +
                    'class="color-box-wrap">' +
                    '<div class="color-box-container">' +
                    grid +
                    '</div>' +
                    '</div>' +
                    '</div>');
                $item.append($injectedColor);

                var $valueDisplay = $injectedColor.find('.value');

                $injectedColor.on('click', function (ev) {
                    $item.find('.color-box-wrap').toggleClass('show');
                });

                $item.find('.color-box.selectable').on('click', function (ev) {
                    ev.preventDefault();
                    var value = $(this).data('value');
                    var input_value = value;
                    if (_.isFunction(options.value_mapping)) {
                        input_value = options.value_mapping(value.replace('0x', '#'));
                    }
                    $color.val(input_value);
                    $valueDisplay.css('background-color', value.replace(/^0x/, '#'));
                    $color.trigger('change');
                    $item.find('.color-box-wrap').removeClass('show');
                    ev.stopPropagation();
                })
            });

            return this;
        }
    });
}(jQuery));
