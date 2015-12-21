NEW_THINGS = [
    ["You will now be alerted to new features on your first visit to the site after they're added. For instance, this one."],
    ["CloudPebble now lets you create appications using pure JavaScript! <a href='https://developer.getpebble.com/blog/2014/03/14/CloudPebble-now-supports-Simplyjs/' target='_blank'>Check out our blog post!</a>"],
    ["A longstanding issue preventing iOS users from installing apps larger than 64k has been resolved in iOS app 2.1.1."],
    ["iOS users can now more easily install apps on their phones by selecting it from a list!",
     "This requires iOS app 2.1.1. If you have 2.1.1 and your phone doesn't appear in the list, try killing and restarting the Pebble app.",
     "<a href='https://developer.getpebble.com/blog/2014/04/04/Easier-app-deployment-from-Cloudpebble/' target='_blank'>See the blog post!</a>"],
    ["You can now view the API documentation right in CloudPebble!",
     "Alt-click on any API function in your code for a pop-up explaining it. You can dismiss it by clicking or hitting esc.",
     "You can also view the pop-up for the name your editor cursor is in by pressing cmd-ctrl-shift-/ (Mac) or ctrl-alt-shift-/ (Windows)." +
     " (On some keyboard layouts, that is cmd-ctrl-? or ctrl-alt-?)",
     "Short summaries now also appear at the bottom of the autocomplete popup."],
    ["CloudPebble is now running Pebble SDK 2.1. See the <a href='https://developer.getpebble.com/2/changelog-2.1.html'>full release notes</a>.",
     "<strong>Warning:</strong> Apps that incorrectly free the same memory twice will now crash immediately instead of carrying on but potentially silently corrupting memory.",
     "Apps built on CloudPebble now require you to <a href='https://developer.getpebble.com/2/getting-started/'>update to Pebble OS 2.1</a> to run your apps."],
    ["CloudPebble now supports import, export, and GitHub pull/push for Simply.js and Pebble.js (beta) projects."],
    ["CloudPebble is now using SDK 2.4; check out <a href='https://developer.getpebble.com/2/changelog-2.4.html' target='_blank'>release notes</a>."],
    ["CloudPebble now feature a UI builder for native apps! Learn more <a href='https://developer.getpebble.com/blog/2014/08/08/CloudPebble-Graphical-UI-Editor/' target='_blank'>on our blog</a>."],
    ["CloudPebble is now running SDK 2.5!",
     "New features include <a href='https://developer.getpebble.com/2/guides/compass.html' target='_blank'>compass support</a>, heap state APIs, and emoji in system fonts <code>GOTHIC_24_BOLD</code>, <code>GOTHIC_18</code> and <code>GOTHIC_18_BOLD</code>.",
     "Check out <a href='https://developer.getpebble.com/2/changelog-2.5.html' target='_blank'>the full release notes</a>."],
    ["CloudPebble is now running SDK 2.6!",
     "You can now build apps that run in the background. Check out our <a href='https://developer.getpebble.com/2/guides/background-guide.html'>background guide</a> for more details.",
     "Other new features include access to the watch colour, firmware version, and framebuffer. Check <a href='https://developer.getpebble.com/2/changelog-2.6.html'>the release notes</a> for more details."],
    ["Significantly improved code completion!",
     "Code completion now supports fuzzy matching and includes your own symbols!",
     "CloudPebble will now also sanity check your file and highlight errors inline as you type.",
     "Check out <a href='https://developer.getpebble.com/blog/2014/10/09/CloudPebble-code-completion/' target='_blank'>the blog post</a> for details and examples!"],
    ["CloudPebble is now available in English, German, French and Spanish, with the ironic exception of this message."],
    ["App installation is now simpler and works without your computer and phone on the same network. Make sure you have the latest software, enable the development server, and use the new buttons."],
    ["<strong>CloudPebble now has an emulator!</strong> By default, we will install into the emulator. You can toggle between the emulator and a physical pebble in the compilation pane",
     "Emulator tip: you can click in the screen to use the arrow keys as buttons, or X/Y/Z as taps. Use shift-X/Y/Z for taps in the negative direction.",
     "Emulator tip: you must update your configuration pages for the emulator. We will pass a return_to query parameter; when specified, use it instead of 'pebblejs://close#'"],
    ["CloudPebble now has fuzzy file search! Use cmd-P (Mac) or ctrl-P (Windows) in the editor to bring up an input prompt, then begin to type the name of a file you would like to open.",
     "You can scroll up and down the suggestions with the arrow keys, and press enter to select a file."],
    ["Fuzzy search has been expanded to help you do more on CloudPebble with your keyboard! Press cmd-shift-P (Mac) or ctrl-shift-P (Windows) in a project to try the new functions."],
    ["Introducing Pebble Round! CloudPebble has been upgraded to support the new platform (Chalk) and its SDK.",
     "Accordingly, resource management has changed significantly. Now you can tag each variant of a resource with tags such as \"Round\" or \"Monochrome\" to specify which platforms it should be used for.",
     "See <a href=\"http://developer.getpebble.com/sdk/round-getting-started/\">this guide</a> for more information"],
    ["It's once again possible to take screenshots of your apps directly from the emulator!",
     "You can find the screenshot button in the Compilation page, or you can run the \"Take Screenshots\" command from the fuzzy prompt (cmd-shift-P or ctrl-shift-P)"],
    ["CloudPebble has been updated to SDK 3.8! Aplite now uses SDK 3. Read more <a href='https://developer.getpebble.com/blog/2015/12/02/Bringing-the-Family-Back-Together/'>on our blog</a>.",
     "We have converted all your png and pbi resources to the new 'bitmap' format. Read more <a href='https://developer.getpebble.com/blog/2015/12/02/Bitmap-Resources/'> on our blog</a>."],
]


def get_new_things(user):
    user_settings = user.settings
    what = user_settings.whats_new

    if what < len(NEW_THINGS):
        user_settings.whats_new = len(NEW_THINGS)
        user_settings.save()

        return NEW_THINGS[what:][::-1]
    else:
        return []


def count_things():
    return len(NEW_THINGS)
