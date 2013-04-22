(function() {
    $('#create-project').click(function() {
        $('#create-project').find('input button select').removeAttr('disabled');
        $('#project-prompt').modal();
    });

    $('#project-confirm-button').click(function() {
        var value = $('#project-prompt-value').val();
        $('project-prompt-errors').addClass("hide");
        if(value == '') {
            $('#project-prompt-errors').removeClass('hide').text("You must enter a name.");
            return;
        }
        $('#create-project').find('input button select').attr('disabled', 'disabled');
        $.post('/ide/project/create', {
                name: value,
                template: $('#project-template').val()
            }, function(data) {
                console.log(data);
                if(!data.success) {
                    $('#project-prompt-errors').removeClass('hide').text(data.error);
                } else {
                    window.location.href = "/ide/project/" + data.id;
                }
            }
        );
    });

    $('form').submit(function (e){
        e.preventDefault();
        $('#project-confirm-button').click();
    });

    jquery_csrf_setup();
})();