$(function() {
    var gMainContent = $('.main-container');

    $('.btn-show-login').click(function() {
        gMainContent.addClass('show-login');
    });

    $('.btn-hide-login').click(function() {
        gMainContent.removeClass('show-login');
    });
});
