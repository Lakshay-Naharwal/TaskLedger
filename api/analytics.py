import json
import pandas as pd
import matplotlib.pyplot as plt
import io
import base64

def generate_productivity_report(data_file="tasks.json", output_file="productivity_report.png", raw_tasks=None, return_base64=False):
    """
    Generates a productivity report from completed tasks and saves it as an image or returns a base64 string.
    Returns True/False if saving to file, or returns the base64 string if return_base64=True.
    """
    if raw_tasks is not None:
        completed_tasks = raw_tasks
    else:
        try:
            with open(data_file, "r") as f:
                data = json.load(f)
                completed_tasks = data.get("completed", [])
        except (FileNotFoundError, json.JSONDecodeError):
            return False if not return_base64 else None
            
    if not completed_tasks:
        return False if not return_base64 else None
        
    # Convert to DataFrame
    df = pd.DataFrame(completed_tasks)
    
    # Ensure necessary columns exist
    if 'end_date' not in df.columns or 'days_taken' not in df.columns or 'complexity' not in df.columns:
        return False if not return_base64 else None
        
    # Data Cleaning and Preparation
    df['end_date'] = pd.to_datetime(df['end_date'])
    df['day_of_week'] = df['end_date'].dt.day_name()
    
    # Create a figure with two subplots side-by-side
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))
    
    # Subplot 1: Average Days Taken by Complexity
    # Group by complexity and get average days taken
    complexity_summary = df.groupby('complexity')['days_taken'].mean().reset_index()
    ax1.bar(complexity_summary['complexity'], complexity_summary['days_taken'], color='skyblue')
    ax1.set_title('Average Days to Complete by Complexity')
    ax1.set_xlabel('Complexity (1-10)')
    ax1.set_ylabel('Average Days Taken')
    ax1.set_xticks(range(1, 11))
    
    # Subplot 2: Tasks Completed by Day of the Week
    days_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    day_counts = df['day_of_week'].value_counts().reindex(days_order).fillna(0)
    
    ax2.bar(day_counts.index, day_counts.values, color='lightgreen')
    ax2.set_title('Tasks Completed by Day of the Week')
    ax2.set_xlabel('Day of the Week')
    ax2.set_ylabel('Number of Tasks')
    plt.setp(ax2.xaxis.get_majorticklabels(), rotation=45)
    
    # Adjust layout
    plt.tight_layout()
    
    if return_base64:
        buf = io.BytesIO()
        plt.savefig(buf, format='png')
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close()
        return img_base64
    else:
        plt.savefig(output_file)
        plt.close()
        return True

if __name__ == "__main__":
    success = generate_productivity_report()
    if success:
        print("Productivity report generated: productivity_report.png")
    else:
        print("Failed to generate report. Not enough data.")
