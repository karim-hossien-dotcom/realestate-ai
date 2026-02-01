from flask import Flask, render_template, request, redirect, url_for

app = Flask(__name__)

@app.route("/")
def landing():
    return render_template("landing.html")

@app.route("/signin", methods=["GET", "POST"])
def signin():
    if request.method == "POST":
        # later: check email/password here
        email = request.form.get("signin-email")
        password = request.form.get("signin-password")
        # For now, we ignore them and just go to dashboard
        return redirect(url_for("dashboard"))

    # GET -> just show the sign-in page
    return render_template("signin.html")

@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")

@app.route("/leads")
def leads():
    return render_template("leads.html")

@app.route("/lead-details")
def lead_details():
    return render_template("lead_details.html")

@app.route("/campaigns")
def campaigns():
    return render_template("campaigns.html")

@app.route("/calendar")
def calendar():
    return render_template("calendar.html")

@app.route("/followups")
def followups():
    return render_template("followups.html")

@app.route("/conversations")
def conversations():
    return render_template("conversations.html")

@app.route("/onboarding")
def onboarding():
    return render_template("onboarding.html")

@app.route("/logs")
def logs():
    return render_template("logs.html")

@app.route("/settings")
def settings():
    return render_template("settings.html")

@app.route("/help")
def help_page():  # cannot name function "help"
    return render_template("help.html")

if __name__ == "__main__":
    app.run(debug=True)
