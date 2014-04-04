NEW_THINGS = [
    ["You will now be alerted to new features on your first visit to the site after they're added. For instance, this one."],
    ["CloudPebble now lets you create appications using pure JavaScript! <a href='https://developer.getpebble.com/blog/2014/03/14/CloudPebble-now-supports-Simplyjs/' target='_blank'>Check out our blog post!</a>"],
    ["A longstanding issue preventing iOS users from installing apps larger than 64k has been resolved in iOS app 2.1.1."],
    ["iOS users can now more easily install apps on their phones by selecting it from a list!",
     "This requires iOS app 2.1.1. If you have 2.1.1 and your phone doesn't appear in the list, try killing and restarting the Pebble app.",
     "<a href='https://developer.getpebble.com/blog/2014/04/04/Easier-app-deployment-from-Cloudpebble/' target='_blank'>See the blog post!</a>"]
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
