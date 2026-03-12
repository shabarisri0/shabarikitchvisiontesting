from flask import Flask, render_template, request
import os

from visionmodel.predict_ingredient import predict_food
from recipe.recipe_system import suggest_recipes
from nutrition.nutrition_system import get_nutrition

app = Flask(__name__)

UPLOAD_FOLDER = "uploads"
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# create uploads folder if it doesn't exist
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/predict", methods=["POST"])
def predict():

    if "image" not in request.files:
        return "No file uploaded"

    file = request.files["image"]

    if file.filename == "":
        return "No selected file"

    filepath = os.path.join(app.config["UPLOAD_FOLDER"], file.filename)
    file.save(filepath)

    # AI prediction
    ingredient = predict_food(filepath)

    # recipe suggestion
    recipes = suggest_recipes(ingredient)

    # nutrition info
    nutrition = get_nutrition(ingredient)

    return render_template(
        "index.html",
        food=ingredient,
        recipes=recipes,
        nutrition=nutrition
    )

if __name__ == "__main__":
   app.run(host="0.0.0.0", port=10000)