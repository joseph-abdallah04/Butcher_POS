-- ============================================================
-- 2. DIMENSION TABLES (Contextual Data)
-- ============================================================

-- Master Product List (Denormalized)
CREATE TABLE `Our_data_warehouse.dim_products` (
    product_id INT64,
    product_name STRING,
    category STRING,
    supplier STRING,
    current_retail_price FLOAT64,
    current_cost_price FLOAT64,
    unit_measure STRING
);

-- Store Locations
CREATE TABLE `Our_data_warehouse.dim_shops` (
    id INT64,
    shop_name STRING,
    location STRING,
    shop_code STRING
);

-- Employee Information
CREATE TABLE `Our_data_warehouse.dim_staff` (
    id INT64,
    staff_name STRING,
    role STRING,
    shop_id INT64
);

-- Customer Loyalty Data
CREATE TABLE `Our_data_warehouse.dim_customers` (
    id INT64,
    first_name STRING,
    last_name STRING,
    email STRING,
    loyalty_tier STRING
);

-- Marketing & Promotion Context
CREATE TABLE `Our_data_warehouse.dim_promotions` (
    promo_id INT64,
    promo_name STRING,
    discount_percent FLOAT64,
    is_active BOOLEAN
);

-- ============================================================
-- 3. FACT TABLES (Quantitative Performance)
-- ============================================================

-- FACT 1: Sales Performance (Core Revenue)
CREATE TABLE `Our_data_warehouse.fact_sales_performance` (
    sale_id INT64,
    shop_id INT64,
    staff_id INT64,
    product_id INT64,
    quantity FLOAT64,
    price_at_sale FLOAT64,
    discount_applied FLOAT64,
    cost_price FLOAT64,
    sale_timestamp TIMESTAMP,
    gross_revenue FLOAT64,
    net_revenue FLOAT64,
    total_cogs FLOAT64,
    net_profit FLOAT64,
    tax_amount FLOAT64,
    hour_of_day INT64,
    day_name STRING
)
PARTITION BY DATE(sale_timestamp);

-- FACT 2: Wastage & Loss (Operational Efficiency)
CREATE TABLE `Our_data_warehouse.fact_wastage_loss` (
    event_id INT64,
    shop_id INT64,
    product_id INT64,
    staff_id INT64,
    quantity_wasted FLOAT64,
    reason STRING,
    cost_price FLOAT64,
    event_timestamp TIMESTAMP,
    total_loss_value FLOAT64
)
PARTITION BY DATE(event_timestamp);

-- FACT 3: Marketing Impact (Campaign ROI)
CREATE TABLE `Our_data_warehouse.fact_marketing_impact` (
    sale_id INT64,
    product_id INT64,
    promo_id INT64,
    shop_id INT64,
    quantity FLOAT64,
    discount_value_given FLOAT64,
    gross_revenue_pre_discount FLOAT64,
    sale_timestamp TIMESTAMP
)
PARTITION BY DATE(sale_timestamp);