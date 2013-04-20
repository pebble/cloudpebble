(function() {
    $('#create-project').click(function() {
        $('#create-project').find('input button').removeAttr('disabled');
        $('#project-prompt').modal();
    });

    $('#project-confirm-button').click(function() {
        var value = $('#project-prompt-value').val();
        $('project-prompt-errors').addClass("hide");
        if(value == '') {
            $('#project-prompt-errors').removeClass('hide').text("You must enter a name.");
            return;
        }
        $('#create-project').find('input button').attr('disabled', 'disabled');
        $.post('/ide/project/create', {name: value}, function(data) {
            console.log(data);
            if(!data.success) {
                $('#project-prompt-errors').removeClass('hide').text(data.error);
            } else {
                window.location.href = "/ide/project/" + data.id;
            }
        });
    });

    jquery_csrf_setup();
})();