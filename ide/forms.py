from django.forms import ModelForm, Select

from ide.models.user import UserSettings


class SettingsForm(ModelForm):
    class Meta:
        model = UserSettings
        exclude = ('user', 'accepted_terms', 'whats_new')
        widgets = {
            'use_spaces': Select
        }
