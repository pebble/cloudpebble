from django.forms import ModelForm

from ide.models import UserSettings


class SettingsForm(ModelForm):
    class Meta:
        model = UserSettings
        exclude = ('user', 'accepted_terms')
