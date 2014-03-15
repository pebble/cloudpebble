from django.contrib.auth.models import User
from django.db import models

from ide.models.meta import IdeModel

__author__ = 'katharine'


class UserSettings(IdeModel):
    user = models.OneToOneField(User, primary_key=True)

    AUTOCOMPLETE_ALWAYS = 1
    AUTOCOMPLETE_EXPLICIT = 2
    AUTOCOMPLETE_NEVER = 3
    AUTOCOMPLETE_CHOICES = (
        (AUTOCOMPLETE_ALWAYS, 'As-you-type'),
        (AUTOCOMPLETE_EXPLICIT, 'When pressing Ctrl-Space'),
        (AUTOCOMPLETE_NEVER, 'Never')
    )

    KEYBIND_STANDARD = 'default'
    KEYBIND_VIM = 'vim'
    KEYBIND_EMACS = 'emacs'
    KEYBIND_CHOICES = (
        (KEYBIND_STANDARD, 'Standard'),
        (KEYBIND_VIM, 'vim-like'),
        (KEYBIND_EMACS, 'emacs-like')
    )

    THEME_CHOICES = (
        ('monokai', 'Monokai (Sublime Text)'),
        ('blackboard', 'Blackboard (TextMate)'),
        ('eclipse', 'Eclipse'),
        ('solarized light', 'Solarized (light)'),
        ('solarized dark', 'Solarized (dark)'),
    )

    def __unicode__(self):
        return self.user.name

    autocomplete = models.IntegerField(choices=AUTOCOMPLETE_CHOICES, default=AUTOCOMPLETE_ALWAYS)
    keybinds = models.CharField(max_length=20, choices=KEYBIND_CHOICES, default=KEYBIND_STANDARD)
    theme = models.CharField(max_length=50, choices=THEME_CHOICES, default='monokai')
    use_spaces = models.BooleanField(default=True, verbose_name="Indent using spaces")
    tab_width = models.PositiveSmallIntegerField(default=2)

    # Used for the Pebble ownership transition, when it was set to False.
    accepted_terms = models.BooleanField(default=True)

    # What "what's new" prompt have they seen?
    whats_new = models.PositiveIntegerField(default=0)

User.settings = property(lambda self: UserSettings.objects.get_or_create(user=self)[0])


class UserGithub(IdeModel):
    user = models.OneToOneField(User, primary_key=True, related_name='github')
    token = models.CharField(max_length=50, null=True, blank=True)
    nonce = models.CharField(max_length=36, null=True, blank=True)
    username = models.CharField(max_length=50, null=True, blank=True)
    avatar = models.CharField(max_length=255, null=True, blank=True)