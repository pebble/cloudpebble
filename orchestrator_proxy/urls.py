from django.conf.urls import url

from orchestrator_proxy.api.get_artefact import get_artefact
from orchestrator_proxy.api.get_log import get_log
from orchestrator_proxy.api.get_test_info import get_test_info
from orchestrator_proxy.api.post_test import post_test
from orchestrator_proxy.api.notify_test import notify_test

urlpatterns = [
    url(r'^tests$', post_test, name="post_test"),
    url(r'^tests/(?P<uuid>[0-9a-f-]{36})$', get_test_info, name="get_test_info"),
    url(r'^logs/(?P<uuid>[0-9a-f-]{36})$', get_log, name="get_log"),
    url(r'^artefacts/(?P<filename>[0-9a-f]+\.(png|log))$', get_artefact, name="get_artefact"),
    url(r'^tests/(?P<private_uuid>[0-9a-f-]{36})/notify$', notify_test, name="notify_test")
]
