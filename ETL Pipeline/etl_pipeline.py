import functions_framework
import pandas as pd
from sqlalchemy import create_engine
from google.cloud.sql.connector import Connector
from google.cloud import bigquery

# --- CONFIGURATION ---
PROJECT_ID = "project-1aeac36d-6e65-4529-9bd" 
INSTANCE_CONNECTION_NAME = f"{PROJECT_ID}:australia-southeast1:butchery-ops-db"
DB_USER = "postgres"
DB_PASS = "12345678Aa_"
DB_NAME = "ops_store"
DATASET = "Our_data_warehouse"

@functions_framework.http
def run_etl_process(request):
    connector = Connector()
    bq_client = bigquery.Client(project=PROJECT_ID)
    
    def getconn():
        return connector.connect(INSTANCE_CONNECTION_NAME, "pg8000", user=DB_USER, password=DB_PASS, db=DB_NAME)

    def upload_to_bq(df, table_name, write_mode="WRITE_APPEND"):
        table_id = f"{PROJECT_ID}.{DATASET}.{table_name}"
        job_config = bigquery.LoadJobConfig(write_disposition=write_mode)
        job = bq_client.load_table_from_dataframe(df, table_id, job_config=job_config)
        job.result()

    def truncate_bq(table_name):
        # FIX 1: Unconditionally wipe the BQ table before loading,
        # so old rows never survive an empty-Postgres run.
        bq_client.query(f"TRUNCATE TABLE `{PROJECT_ID}.{DATASET}.{table_name}`").result()

    try:
        engine = create_engine("postgresql+pg8000://", creator=getconn)
        
        # --- 1. SYNC DIMENSIONS (Full Refresh) ---
        print("Syncing Dimensions...")
        
        sql_prod = "SELECT p.id as product_id, p.product_name, c.name as category, s.company_name as supplier, p.unit_price as current_retail_price, p.cost_price as current_cost_price, p.unit_measure FROM products p JOIN product_categories c ON p.category_id = c.id JOIN suppliers s ON p.supplier_id = s.id"
        df_prod = pd.read_sql(sql_prod, engine)
        df_prod['unit_measure'] = df_prod['unit_measure'].fillna('').astype(str)
        df_prod['product_name'] = df_prod['product_name'].astype(str).str.title()
        df_prod['category'] = df_prod['category'].astype(str).str.upper()
        for c in ['current_retail_price', 'current_cost_price']: df_prod[c] = df_prod[c].astype(float)
        upload_to_bq(df_prod, "dim_products", "WRITE_TRUNCATE")
        
        df_promo = pd.read_sql("SELECT id as promo_id, promo_name, discount_percent, is_active FROM promotions", engine)
        df_promo['discount_percent'] = df_promo['discount_percent'].astype(float)
        upload_to_bq(df_promo, "dim_promotions", "WRITE_TRUNCATE")

        upload_to_bq(pd.read_sql("SELECT * FROM shops", engine), "dim_shops", "WRITE_TRUNCATE")
        upload_to_bq(pd.read_sql("SELECT * FROM shop_staff", engine), "dim_staff", "WRITE_TRUNCATE")
        upload_to_bq(pd.read_sql("SELECT * FROM customers", engine), "dim_customers", "WRITE_TRUNCATE")

        # --- 2. FACT 1: SALES PERFORMANCE (Full Refresh) ---
        print("Loading fact_sales_performance...")
        truncate_bq("fact_sales_performance")

        sql_sales = """
            SELECT si.sale_id, s.shop_id, s.staff_id, si.product_id,
                   si.quantity, si.price_at_sale, si.discount_applied,
                   COALESCE(p.cost_price, 0) as cost_price,
                   s.created_at as sale_timestamp
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            LEFT JOIN products p ON si.product_id = p.id
        """
        df_sales = pd.read_sql(sql_sales, engine)

        if not df_sales.empty:
            df_sales['gross_revenue'] = (df_sales['quantity'] * df_sales['price_at_sale']).astype(float)
            df_sales['net_revenue'] = (df_sales['gross_revenue'] - df_sales['discount_applied']).astype(float)
            df_sales['total_cogs'] = (df_sales['quantity'] * df_sales['cost_price']).astype(float)
            df_sales['net_profit'] = (df_sales['net_revenue'] - df_sales['total_cogs']).astype(float)
            df_sales['tax_amount'] = (df_sales['net_revenue'] * 0.1).round(2).astype(float)
            df_sales['sale_timestamp'] = pd.to_datetime(df_sales['sale_timestamp'])
            df_sales['hour_of_day'] = df_sales['sale_timestamp'].dt.hour.astype(int)
            df_sales['day_name'] = df_sales['sale_timestamp'].dt.day_name().astype(str)
            for c in ['quantity', 'price_at_sale', 'discount_applied', 'cost_price']: df_sales[c] = df_sales[c].astype(float)
            upload_to_bq(df_sales, "fact_sales_performance", "WRITE_APPEND")
            s_msg = f"Loaded {len(df_sales)} sales."
        else: s_msg = "No sales rows found."

        # --- 3. FACT 2: WASTAGE LOSS (Full Refresh) ---
        print("Loading fact_wastage_loss...")
        truncate_bq("fact_wastage_loss")

        sql_waste = """
            SELECT w.id as event_id, w.shop_id, w.product_id, w.staff_id,
                   w.quantity_wasted, w.reason,
                   COALESCE(p.cost_price, 0) as cost_price,
                   w.created_at as event_timestamp
            FROM wastage w
            LEFT JOIN products p ON w.product_id = p.id
        """
        df_waste = pd.read_sql(sql_waste, engine)

        if not df_waste.empty:
            df_waste['total_loss_value'] = (df_waste['quantity_wasted'] * df_waste['cost_price']).astype(float)
            df_waste['event_timestamp'] = pd.to_datetime(df_waste['event_timestamp'])
            df_waste['reason'] = df_waste['reason'].astype(str).str.upper()
            df_waste['quantity_wasted'] = df_waste['quantity_wasted'].astype(float)
            df_waste['cost_price'] = df_waste['cost_price'].astype(float)
            upload_to_bq(df_waste, "fact_wastage_loss", "WRITE_APPEND")
            w_msg = f"Loaded {len(df_waste)} wastage items."
        else: w_msg = "No wastage rows found."

        # --- 4. FACT 3: MARKETING IMPACT (Full Refresh) ---
        print("Loading fact_marketing_impact...")
        truncate_bq("fact_marketing_impact")

        sql_mkt = """
            SELECT s.id as sale_id, si.product_id, s.promo_id, s.shop_id,
                   si.quantity, si.discount_applied as discount_value_given,
                   (si.quantity * si.price_at_sale) as gross_revenue_pre_discount,
                   s.created_at as sale_timestamp
            FROM sales s
            JOIN sale_items si ON s.id = si.sale_id
            WHERE s.promo_id IS NOT NULL
        """
        df_mkt = pd.read_sql(sql_mkt, engine)

        if not df_mkt.empty:
            df_mkt['sale_timestamp'] = pd.to_datetime(df_mkt['sale_timestamp'])
            for c in ['quantity', 'discount_value_given', 'gross_revenue_pre_discount']: df_mkt[c] = df_mkt[c].astype(float)
            upload_to_bq(df_mkt, "fact_marketing_impact", "WRITE_APPEND")
            m_msg = f"Loaded {len(df_mkt)} promo events."
        else: m_msg = "No promo rows found."

        return f"ETL Success: {s_msg} | {w_msg} | {m_msg}", 200
        
    except Exception as e:
        return f"Critical ETL Error: {str(e)}", 500