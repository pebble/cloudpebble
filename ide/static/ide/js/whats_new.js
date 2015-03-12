$(function() {
    var mWhatsNewElement = $('#whats-new');

    $.getJSON('/ide/whats_new', function(data) {
        if(data.free_snowy) {
            $('#free-pebble-time').modal().find('a').attr('href', data.free_snowy);
            return;
        }
        var new_things = data.new;
        if(new_things.length > 0) {
            var holder = $('<div>');
            _.each(new_things, function(thing) {
                var list = $('<ul>');
                _.each(thing, function(sub_thing) {
                    list.append($('<li>').html(sub_thing));
                });
                holder.append(list);
            });
            mWhatsNewElement.find('.whats-new-text').append(holder);
            mWhatsNewElement.modal();
        }
    });

    $('#free-pebble-time-hide').click(function() {
        $.post('/ide/hide_snowy_offer');
    });
});
