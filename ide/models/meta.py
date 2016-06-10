from django.db import models


class IdeModel(models.Model):
    class Meta:
        abstract = True
        app_label = "ide"
