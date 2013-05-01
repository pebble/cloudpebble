from registration.backends.simple.views import RegistrationView


class IdeRegistrationView(RegistrationView):
    def get_success_url(self, *args, **kwargs):
        return "/ide/"
