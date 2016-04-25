$(function() {
    jquery_csrf_setup();

    var gMainContent = $('.main-container');

    $('.btn-show-login').click(function() {
        gMainContent.addClass('show-login');
    });

    $('.btn-hide-login').click(function() {
        gMainContent.removeClass('show-login');
    });

    if(location.hash == '#login') {
        gMainContent.addClass('show-login');
    }

    $('#legacy-trigger-btn').click(function() {
        $('#legacy-login').modal('show');
    });

    $('#legacy-login').find('form').submit(function(e) {
        e.preventDefault();
        $('#legacy-login').find('.btn').attr('disabled', 'disabled');

        Ajax.Post('/accounts/api/login', {
            username: $('#legacy-username').val(),
            password: $('#legacy-password').val()
        }).then(function() {
            location.href = '/ide/';
        }).catch(function(error) {
            alert(error);
        }).finally(function() {
            $('#legacy-login').find('.btn').removeAttr('disabled');
        });
    });

    $('#legacy-login-btn').click(function() {
        $('#legacy-login').find('form').submit();
    });
});
