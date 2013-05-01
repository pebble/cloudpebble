from django.shortcuts import render, redirect


def index(request):
    if request.user.is_authenticated():
        return redirect("/ide/")
    else:
        return render(request, 'root/index.html')
