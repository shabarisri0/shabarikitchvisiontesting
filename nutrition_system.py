import pandas as pd
import os

# Get correct path to the CSV file
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
csv_path = os.path.join(BASE_DIR, "Food_Nutrition_Dataset.csv")

# Load dataset
nutrition_data = pd.read_csv(csv_path)

def get_nutrition(food):

    food = food.lower()

    # Search for matching food
    result = nutrition_data[
        nutrition_data.apply(
            lambda row: food in str(row).lower(), axis=1
        )
    ]

    # If no result found
    if result.empty:
        return {
            "Calories": "Not Available",
            "Protein": "Not Available",
            "Carbs": "Not Available",
            "Fat": "Not Available",
            "Iron": "Not Available",
            "Vitamin C": "Not Available"
        }

    row = result.iloc[0]

    # Try to safely extract values
    def safe_value(column):
        try:
            return row[column]
        except:
            return "N/A"

    return {
        "Calories": safe_value("calories"),
        "Protein": safe_value("protein"),
        "Carbs": safe_value("carbs"),
        "Fat": safe_value("fat"),
        "Iron": safe_value("iron"),
        "Vitamin C": safe_value("vitamin_c")
    }