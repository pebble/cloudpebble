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
    ["CloudPebble is now using SDK 2.4; check out <a href='https://developer.getpebble.com/2/changelog-2.4.html'>release notes</a>."]
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
