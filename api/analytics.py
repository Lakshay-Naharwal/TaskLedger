import pandas as pd

def generate_productivity_report(completed_tasks):
    """
    Generates JSON data for a productivity report from a list of completed task dicts.
    """
    if not completed_tasks:
        return {"complexity_data": [], "day_data": []}
        
    df = pd.DataFrame(completed_tasks)
    
    if 'end_date' not in df.columns or 'days_taken' not in df.columns or 'complexity' not in df.columns:
        return {"complexity_data": [], "day_data": []}
        
    # Data Cleaning and Preparation
    df['end_date'] = pd.to_datetime(df['end_date'])
    df['day_of_week'] = df['end_date'].dt.day_name()
    
    # Average Days Taken by Complexity
    complexity_summary = df.groupby('complexity')['days_taken'].mean().reset_index()
    # Fill missing complexities with 0 for better charts (1-10)
    all_complexities = pd.DataFrame({'complexity': range(1, 11)})
    complexity_summary = pd.merge(all_complexities, complexity_summary, on='complexity', how='left').fillna(0)
    complexity_data = complexity_summary.to_dict('records')
    
    # Tasks Completed by Day of the Week
    days_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    day_counts = df['day_of_week'].value_counts().reindex(days_order).fillna(0).reset_index()
    day_counts.columns = ['day', 'count']
    day_data = day_counts.to_dict('records')
    
    return {
        "complexity_data": complexity_data,
        "day_data": day_data
    }
