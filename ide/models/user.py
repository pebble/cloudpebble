from django.contrib.auth.models import User
from django.db import models
from django.utils.translation import ugettext_lazy as _
from django.utils.translation import pgettext_lazy

from ide.models.meta import IdeModel
from ide.utils.whatsnew import count_things

__author__ = 'katharine'


class UserSettings(IdeModel):
    user = models.OneToOneField(User, primary_key=True)

    AUTOCOMPLETE_ALWAYS = 1
    AUTOCOMPLETE_EXPLICIT = 2
    AUTOCOMPLETE_NEVER = 3
    AUTOCOMPLETE_CHOICES = (
        (AUTOCOMPLETE_ALWAYS, _('As-you-type')),
        (AUTOCOMPLETE_EXPLICIT, _('When pressing Ctrl-Space')),
        (AUTOCOMPLETE_NEVER, _('Never'))
    )

    KEYBIND_STANDARD = 'default'
    KEYBIND_VIM = 'vim'
    KEYBIND_EMACS = 'emacs'
    KEYBIND_CHOICES = (
        (KEYBIND_STANDARD, _('Standard')),
        (KEYBIND_VIM, _('vim-like')),
        (KEYBIND_EMACS, _('emacs-like')),
    )

    THEME_CHOICES = (
        ('cloudpebble', 'CloudPebble'),
        ('monokai', 'Monokai (Sublime Text)'),
        ('blackboard', 'Blackboard (TextMate)'),
        ('eclipse', 'Eclipse'),
        ('solarized light', 'Solarized (light)'),
        ('solarized dark', 'Solarized (dark)'),
    )

    USE_SPACES_CHOICES = (
        (True, _('Using spaces')),
        (False, _('Using tabs')),
    )

    def __unicode__(self):
        return self.user.name

    autocomplete = models.IntegerField(choices=AUTOCOMPLETE_CHOICES, verbose_name=_("Autocompletion"), default=AUTOCOMPLETE_ALWAYS)
    keybinds = models.CharField(max_length=20, verbose_name=_("Keybinds"), choices=KEYBIND_CHOICES, default=KEYBIND_STANDARD)
    theme = models.CharField(max_length=50, verbose_name=_("Theme"), choices=THEME_CHOICES, default='cloudpebble')
    use_spaces = models.BooleanField(default=True, verbose_name=pgettext_lazy("number of spaces", u"Indents"), choices=USE_SPACES_CHOICES)
    tab_width = models.PositiveSmallIntegerField(default=2, verbose_name=_("Tab width"))

    # Used for the Pebble ownership transition, when it was set to False.
    accepted_terms = models.BooleanField(default=True)

    # What "what's new" prompt have they seen?
    whats_new = models.PositiveIntegerField(default=count_things)

User.settings = property(lambda self: UserSettings.objects.get_or_create(user=self)[0])


class UserGithub(IdeModel):
    user = models.OneToOneField(User, primary_key=True, related_name='github')
    token = models.CharField(max_length=50, null=True, blank=True)
    nonce = models.CharField(max_length=36, null=True, blank=True)
    username = models.CharField(max_length=50, null=True, blank=True)
    avatar = models.CharField(max_length=255, null=True, blank=True)